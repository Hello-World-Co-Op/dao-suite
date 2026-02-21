/**
 * Burn Donation Service
 *
 * Service for executing DOM token burns and fetching burn pool data from the dom-token canister.
 * Provides hooks for React component integration.
 *
 * Story: 9-2-3-burn-donation
 * ACs: 1, 4
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { HttpAgent, Actor } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import { DelegationChain, DelegationIdentity, Ed25519KeyIdentity } from '@dfinity/identity';
import {
  $burnPool,
  $burnExecution,
  $burnHistory,
  $tokenBalance,
  setBurnPoolLoading,
  setBurnPoolData,
  setBurnPoolError,
  clearBurnPool,
  isBurnPoolStale,
  setBurnPending,
  setBurnSuccess,
  setBurnExecutionError,
  resetBurnExecution,
  addBurnRecord,
  updateBurnRecordStatus,
  getPendingBurnRecord,
  validateBurnAmount,
  generateBurnId,
  BURN_POOL_STALE_THRESHOLD_MS,
  type BurnState,
  type BurnExecutionState,
  type LocalBurnRecord,
} from '@/stores';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Configuration
// ============================================================================

/** DOM Token canister ID */
const DOM_TOKEN_CANISTER_ID = import.meta.env.VITE_DOM_TOKEN_CANISTER_ID || '';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30000;

/** Initial backoff delay for retries (1 second) */
const INITIAL_BACKOFF_MS = 1000;

/** Maximum backoff delay (30 seconds) */
const MAX_BACKOFF_MS = 30000;

/** Maximum retry attempts for queries */
const MAX_RETRY_ATTEMPTS = 3;

// ============================================================================
// Types
// ============================================================================

export interface FetchBurnPoolResult {
  success: boolean;
  totalBurned?: bigint;
  error?: string;
}

export interface ExecuteBurnResult {
  success: boolean;
  txIndex?: string;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** IC host for agent connections */
const IC_HOST = import.meta.env.VITE_IC_HOST || 'https://ic0.app';

/**
 * Minimal inline IDL for dom-token canister methods we need.
 */
const TransferErrorIDL = IDL.Variant({
  BadFee: IDL.Record({ expected_fee: IDL.Nat }),
  BadBurn: IDL.Record({ min_burn_amount: IDL.Nat }),
  InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
  TooOld: IDL.Null,
  CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
  Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
  TemporarilyUnavailable: IDL.Null,
  GenericError: IDL.Record({ error_code: IDL.Nat, message: IDL.Text }),
});
const domTokenIdl = IDL.Service({
  total_burned: IDL.Func([], [IDL.Nat], ['query']),
  icrc1_burn: IDL.Func(
    [IDL.Nat],
    [IDL.Variant({ Ok: IDL.Nat, Err: TransferErrorIDL })],
    [],
  ),
});

/** sessionStorage keys written by useIILogin in @hello-world-co-op/auth */
const II_DELEGATION_CHAIN_KEY = 'ii_delegation_chain';
const II_SESSION_KEY_KEY = 'ii_session_key';

/**
 * Reconstruct an authenticated DelegationIdentity from sessionStorage.
 * Returns null if II delegation is not available.
 */
function getAuthenticatedIdentity(): DelegationIdentity | null {
  const chainJson = sessionStorage.getItem(II_DELEGATION_CHAIN_KEY);
  const keyJson = sessionStorage.getItem(II_SESSION_KEY_KEY);
  if (!chainJson || !keyJson) return null;
  try {
    const chain = DelegationChain.fromJSON(chainJson);
    const key = Ed25519KeyIdentity.fromJSON(keyJson);
    return DelegationIdentity.fromDelegation(key, chain);
  } catch {
    return null;
  }
}

/**
 * Check if we're in mock/development mode
 */
function isMockMode(): boolean {
  return !DOM_TOKEN_CANISTER_ID;
}

/**
 * Create structured log entry
 */
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  if (import.meta.env.PROD && level !== 'error') return;

  const entry = {
    timestamp: new Date().toISOString(),
    service: 'BurnService',
    level,
    message,
    ...data,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_BACKOFF_MS);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute with timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Get amount bucket for analytics
 */
function getAmountBucket(amountE8s: bigint): string {
  const amount = Number(amountE8s / BigInt(100_000_000)); // Convert to whole tokens
  if (amount < 10) return '1-10';
  if (amount < 100) return '10-100';
  if (amount < 1000) return '100-1000';
  return '1000+';
}

// ============================================================================
// Mock Implementation
// ============================================================================

/** Mock total burned amount (increases with each mock burn) */
let mockTotalBurned = BigInt(0); // Start at 0 until canister integration

/** Mock transaction counter */
let mockTxCounter = 1000;

/**
 * Mock total burned fetch for development
 */
async function mockGetTotalBurned(): Promise<bigint> {
  log('info', 'Mock total_burned fetch');
  await sleep(500);
  return mockTotalBurned;
}

/**
 * Mock burn execution for development
 */
async function mockExecuteBurn(amount: bigint): Promise<string> {
  log('info', 'Mock icrc1_burn execution', { amount: amount.toString() });
  await sleep(1500); // Simulate longer transaction time

  // Simulate occasional failure for testing
  if (Math.random() < 0.1) {
    throw new Error('Mock: Transaction failed (simulated)');
  }

  // Update mock total
  mockTotalBurned += amount;
  mockTxCounter++;

  return mockTxCounter.toString();
}

// ============================================================================
// Canister Integration
// ============================================================================

/**
 * Fetch total burned from dom-token canister
 */
async function fetchTotalBurnedFromCanister(): Promise<bigint> {
  if (isMockMode()) {
    return mockGetTotalBurned();
  }

  const agent = HttpAgent.createSync({ host: IC_HOST });
  const actor = Actor.createActor(() => domTokenIdl, {
    agent,
    canisterId: DOM_TOKEN_CANISTER_ID,
  });
  return (await actor.total_burned()) as bigint;
}

/**
 * Execute burn on dom-token canister.
 * Requires an authenticated II delegation in sessionStorage.
 *
 * @param amount - Amount to burn in e8s
 * @returns Transaction index on success
 */
async function executeBurnOnCanister(amount: bigint): Promise<string> {
  if (isMockMode()) {
    return mockExecuteBurn(amount);
  }

  const identity = getAuthenticatedIdentity();
  if (!identity) {
    throw new Error('Internet Identity not connected. Please log in with II to burn tokens.');
  }

  const agent = HttpAgent.createSync({ host: IC_HOST, identity });
  const actor = Actor.createActor(() => domTokenIdl, {
    agent,
    canisterId: DOM_TOKEN_CANISTER_ID,
  });

  const result = (await actor.icrc1_burn(amount)) as Record<string, unknown>;
  if ('Err' in result) {
    // Format the TransferError variant into a readable message
    const err = result.Err as Record<string, unknown>;
    const errKey = Object.keys(err)[0];
    const errVal = err[errKey];
    const detail = errVal === null ? '' : `: ${JSON.stringify(errVal)}`;
    throw new Error(`${errKey}${detail}`);
  }
  return String(result.Ok);
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Fetch burn pool data with retry logic
 */
export async function fetchBurnPoolData(): Promise<FetchBurnPoolResult> {
  log('info', 'Fetching burn pool data');

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      setBurnPoolLoading(true);

      const totalBurned = await withTimeout(fetchTotalBurnedFromCanister(), REQUEST_TIMEOUT_MS);

      setBurnPoolData(totalBurned);

      log('info', 'Burn pool data fetched successfully', {
        totalBurned: totalBurned.toString(),
        attempt,
      });

      return { success: true, totalBurned };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      log('warn', `Burn pool fetch attempt ${attempt + 1} failed`, {
        error: lastError.message,
        attempt,
      });

      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const backoffDelay = getBackoffDelay(attempt);
        log('info', `Retrying after ${backoffDelay}ms`, { attempt });
        await sleep(backoffDelay);
      }
    }
  }

  const errorMessage = lastError?.message || 'Failed to fetch burn pool data';
  setBurnPoolError(errorMessage);

  log('error', 'Burn pool fetch failed after all retries', {
    error: errorMessage,
  });

  return { success: false, error: errorMessage };
}

/**
 * Execute a token burn
 *
 * @param amount - Amount to burn in e8s
 * @returns Result with success status and transaction index
 */
export async function executeBurn(amount: bigint): Promise<ExecuteBurnResult> {
  log('info', 'Executing burn', { amount: amount.toString() });

  // Validate amount
  const balance = $tokenBalance.get().balance;
  const validationError = validateBurnAmount(amount, balance);
  if (validationError) {
    log('warn', 'Burn validation failed', { error: validationError });

    trackEvent('burn_failed', {
      error_type: 'validation',
      error_message: validationError,
    });

    return { success: false, error: validationError };
  }

  // Check for pending burn (idempotency)
  const pendingRecord = getPendingBurnRecord();
  if (pendingRecord) {
    log('warn', 'Burn already pending', { id: pendingRecord.id });
    return { success: false, error: 'A burn is already in progress' };
  }

  // Create local record in pending state
  const burnId = generateBurnId();
  const record: LocalBurnRecord = {
    id: burnId,
    amount,
    timestamp: Date.now(),
    status: 'pending',
  };
  addBurnRecord(record);

  // Set execution state
  setBurnPending(amount);

  try {
    const txIndex = await withTimeout(executeBurnOnCanister(amount), REQUEST_TIMEOUT_MS);

    // Update record with tx index and confirm
    updateBurnRecordStatus(burnId, 'confirmed', txIndex);
    setBurnSuccess(txIndex);

    // Refresh burn pool total
    fetchBurnPoolData();

    log('info', 'Burn executed successfully', {
      txIndex,
      amount: amount.toString(),
    });

    // Track analytics
    trackEvent('burn_executed', {
      amount_bucket: getAmountBucket(amount),
      tx_index: txIndex,
    });

    return { success: true, txIndex };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update record as failed
    updateBurnRecordStatus(burnId, 'failed');
    setBurnExecutionError(errorMessage);

    log('error', 'Burn execution failed', {
      error: errorMessage,
      amount: amount.toString(),
    });

    // Track analytics
    trackEvent('burn_failed', {
      error_type: 'execution',
      error_message: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Refresh burn pool data (for manual refresh)
 */
export async function refreshBurnPoolData(): Promise<FetchBurnPoolResult> {
  log('info', 'Manual burn pool refresh triggered');
  return fetchBurnPoolData();
}

/**
 * Get current burn pool state
 */
export function getBurnPoolState(): BurnState {
  return $burnPool.get();
}

/**
 * Get current burn execution state
 */
export function getBurnExecutionState(): BurnExecutionState {
  return $burnExecution.get();
}

/**
 * Clear burn pool data (e.g., on logout)
 */
export function clearBurnData(): void {
  log('info', 'Clearing burn data');
  clearBurnPool();
  resetBurnExecution();
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseBurnDonationOptions {
  /** Whether to auto-fetch burn pool on mount */
  autoFetch?: boolean;
  /** Whether to refetch if data is stale */
  refetchIfStale?: boolean;
}

export interface UseBurnDonationResult {
  /** Current burn pool state */
  poolState: BurnState;
  /** Current burn execution state */
  executionState: BurnExecutionState;
  /** User's burn history from localStorage */
  burnHistory: LocalBurnRecord[];
  /** Whether burn pool is loading */
  isLoading: boolean;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Execute a burn transaction */
  executeBurn: (amount: bigint) => Promise<ExecuteBurnResult>;
  /** Refresh burn pool data */
  refresh: () => Promise<void>;
  /** Reset execution state (e.g., to allow new burn after success/error) */
  resetExecution: () => void;
  /** Clear all burn data */
  clear: () => void;
}

/**
 * React hook for burn donation functionality
 */
export function useBurnDonation(options: UseBurnDonationOptions = {}): UseBurnDonationResult {
  const { autoFetch = true, refetchIfStale = true } = options;

  const poolState = useStore($burnPool);
  const executionState = useStore($burnExecution);
  const burnHistory = useStore($burnHistory);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasFetchedRef = useRef(false);

  // Fetch burn pool data on mount
  useEffect(() => {
    const shouldFetch =
      autoFetch &&
      (!hasFetchedRef.current || (refetchIfStale && isBurnPoolStale(BURN_POOL_STALE_THRESHOLD_MS)));

    if (shouldFetch) {
      hasFetchedRef.current = true;

      // Track analytics event
      trackEvent('burn_donation_viewed', {});

      fetchBurnPoolData();
    }
  }, [autoFetch, refetchIfStale]);

  // Execute burn callback
  const handleExecuteBurn = useCallback(async (amount: bigint) => {
    return executeBurn(amount);
  }, []);

  // Manual refresh callback
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshBurnPoolData();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Reset execution callback
  const handleResetExecution = useCallback(() => {
    resetBurnExecution();
  }, []);

  // Clear callback
  const clear = useCallback(() => {
    clearBurnData();
    hasFetchedRef.current = false;
  }, []);

  return {
    poolState,
    executionState,
    burnHistory,
    isLoading: poolState.isLoading,
    isRefreshing,
    executeBurn: handleExecuteBurn,
    refresh,
    resetExecution: handleResetExecution,
    clear,
  };
}

// ============================================================================
// Export Service Object
// ============================================================================

export const BurnService = {
  fetchPoolData: fetchBurnPoolData,
  refreshPoolData: refreshBurnPoolData,
  executeBurn,
  getPoolState: getBurnPoolState,
  getExecutionState: getBurnExecutionState,
  clear: clearBurnData,
  isStale: isBurnPoolStale,
};

export default BurnService;
