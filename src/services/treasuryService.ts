/**
 * Treasury Service
 *
 * Service for fetching DAO treasury balances and transactions from the treasury canister.
 * Provides hooks for React component integration.
 *
 * Story: 9-2-2-treasury-view
 * ACs: 1, 2, 3
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { HttpAgent, Actor } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
import {
  $treasury,
  $treasuryLoading,
  setTreasuryLoading,
  setTreasuryData,
  setTreasuryError,
  clearTreasury,
  isTreasuryStale,
  TREASURY_STALE_THRESHOLD_MS,
  type TreasuryState,
  type TreasuryBalance,
  type Transaction,
} from '@/stores';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Configuration
// ============================================================================

/** Treasury canister ID */
const TREASURY_CANISTER_ID = import.meta.env.VITE_TREASURY_CANISTER_ID || '';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15000;

/** Initial backoff delay for retries (1 second) */
const INITIAL_BACKOFF_MS = 1000;

/** Maximum backoff delay (30 seconds) */
const MAX_BACKOFF_MS = 30000;

/** Maximum retry attempts */
const MAX_RETRY_ATTEMPTS = 3;

/** Default number of transactions to fetch */
const DEFAULT_TRANSACTION_LIMIT = 10;

// ============================================================================
// Types
// ============================================================================

export interface FetchTreasuryResult {
  success: boolean;
  balance?: TreasuryBalance;
  transactions?: Transaction[];
  error?: string;
}

export interface TreasuryServiceState {
  isRefreshing: boolean;
  retryCount: number;
  lastError: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

/** IC host for agent connections */
const IC_HOST = import.meta.env.VITE_IC_HOST || 'https://ic0.app';

/**
 * Minimal inline IDL for treasury canister methods we need.
 */
const TokenTypeIDL = IDL.Variant({ ICP: IDL.Null, DOM: IDL.Null });
const PayoutStatusIDL = IDL.Variant({
  Proposed: IDL.Null,
  Approved: IDL.Null,
  Executed: IDL.Null,
  Failed: IDL.Null,
});
const TreasuryBalanceIDL = IDL.Record({
  icp_balance: IDL.Nat,
  dom_balance: IDL.Nat,
  pending_payouts_icp: IDL.Nat,
  pending_payouts_dom: IDL.Nat,
  active_escrows_icp: IDL.Nat,
  active_escrows_dom: IDL.Nat,
});
const PayoutIDL = IDL.Record({
  id: IDL.Nat64,
  to: IDL.Principal,
  amount: IDL.Nat,
  reason: IDL.Text,
  token_type: TokenTypeIDL,
  status: PayoutStatusIDL,
  approved_by: IDL.Vec(IDL.Principal),
  proposed_at: IDL.Nat64,
  executed_at: IDL.Opt(IDL.Nat64),
  tx_id: IDL.Opt(IDL.Text),
});
const treasuryIdl = IDL.Service({
  // get_treasury_balance is NOT a query in the .did — it's an update call
  get_treasury_balance: IDL.Func(
    [],
    [IDL.Variant({ Ok: TreasuryBalanceIDL, Err: IDL.Text })],
    [],
  ),
  list_payouts: IDL.Func(
    [IDL.Opt(PayoutStatusIDL)],
    [IDL.Vec(PayoutIDL)],
    ['query'],
  ),
});

/**
 * Extract the key from a Candid variant object, e.g. { ICP: null } → 'ICP'
 */
function extractVariant(variant: Record<string, unknown>): string {
  return Object.keys(variant)[0];
}

/**
 * Check if we're in mock/development mode
 */
function isMockMode(): boolean {
  return !TREASURY_CANISTER_ID;
}

/**
 * Create structured log entry
 */
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  if (import.meta.env.PROD && level !== 'error') return;

  const entry = {
    timestamp: new Date().toISOString(),
    service: 'TreasuryService',
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

// ============================================================================
// Mock Implementation
// ============================================================================

/**
 * Mock treasury balance fetch for development
 */
async function mockGetTreasuryBalance(): Promise<TreasuryBalance> {
  log('info', 'Mock treasury balance fetch');

  // Simulate network delay
  await sleep(600);

  // Return empty treasury balance — zero values until canister integration
  return {
    icpBalance: BigInt(0),
    domBalance: BigInt(0),
    pendingPayoutsIcp: BigInt(0),
    pendingPayoutsDom: BigInt(0),
    activeEscrowsIcp: BigInt(0),
    activeEscrowsDom: BigInt(0),
  };
}

/**
 * Mock recent transactions fetch for development
 */
async function mockGetTransactions(limit: number): Promise<Transaction[]> {
  log('info', 'Mock transactions fetch', { limit });

  // Simulate network delay
  await sleep(400);

  // Return empty transactions — no mock data until canister integration
  return [];
}

// ============================================================================
// Canister Integration
// ============================================================================

/**
 * Fetch treasury balance from canister
 *
 * @returns The treasury balance breakdown
 */
async function fetchBalanceFromCanister(): Promise<TreasuryBalance> {
  if (isMockMode()) {
    return mockGetTreasuryBalance();
  }

  const agent = HttpAgent.createSync({ host: IC_HOST });
  const actor = Actor.createActor(() => treasuryIdl, {
    agent,
    canisterId: TREASURY_CANISTER_ID,
  });

  const result = (await actor.get_treasury_balance()) as Record<string, Record<string, bigint>>;
  if ('Err' in result) throw new Error(String(result.Err));

  const ok = result.Ok;
  return {
    icpBalance: ok.icp_balance,
    domBalance: ok.dom_balance,
    pendingPayoutsIcp: ok.pending_payouts_icp,
    pendingPayoutsDom: ok.pending_payouts_dom,
    activeEscrowsIcp: ok.active_escrows_icp,
    activeEscrowsDom: ok.active_escrows_dom,
  };
}

/**
 * Fetch recent transactions from canister via list_payouts.
 * Treasury has no get_recent_transactions — payouts are the primary transaction source.
 *
 * @param limit - Number of transactions to return
 * @returns List of recent transactions mapped from Payout records
 */
async function fetchTransactionsFromCanister(limit: number): Promise<Transaction[]> {
  if (isMockMode()) {
    return mockGetTransactions(limit);
  }

  const agent = HttpAgent.createSync({ host: IC_HOST });
  const actor = Actor.createActor(() => treasuryIdl, {
    agent,
    canisterId: TREASURY_CANISTER_ID,
  });

  // Fetch all payouts (no status filter)
  const payouts = (await actor.list_payouts([])) as Record<string, unknown>[];

  // Map Payout → Transaction, sort newest first, apply limit
  return payouts
    .map((p) => ({
      id: String(p.id),
      type: 'payout' as const,
      amount: p.amount as bigint,
      timestamp: ((p.executed_at as bigint[])[0] ?? (p.proposed_at as bigint)) as bigint,
      description: p.reason as string,
      tokenType: extractVariant(p.token_type as Record<string, unknown>) as 'DOM' | 'ICP',
    }))
    .sort((a, b) => (b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0))
    .slice(0, limit);
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Fetch treasury data with retry logic
 *
 * @returns Result with success status and treasury data or error
 */
export async function fetchTreasuryData(): Promise<FetchTreasuryResult> {
  log('info', 'Fetching treasury data');

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      setTreasuryLoading(true);

      // Fetch balance and transactions in parallel
      const [balance, transactions] = await withTimeout(
        Promise.all([
          fetchBalanceFromCanister(),
          fetchTransactionsFromCanister(DEFAULT_TRANSACTION_LIMIT),
        ]),
        REQUEST_TIMEOUT_MS
      );

      setTreasuryData(balance, transactions);

      log('info', 'Treasury data fetched successfully', {
        domBalance: balance.domBalance.toString(),
        icpBalance: balance.icpBalance.toString(),
        transactionCount: transactions.length,
        attempt,
      });

      return { success: true, balance, transactions };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      log('warn', `Treasury fetch attempt ${attempt + 1} failed`, {
        error: lastError.message,
        attempt,
      });

      // Don't retry on last attempt
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const backoffDelay = getBackoffDelay(attempt);
        log('info', `Retrying after ${backoffDelay}ms`, { attempt });
        await sleep(backoffDelay);
      }
    }
  }

  // All retries failed
  const errorMessage = lastError?.message || 'Failed to fetch treasury data';
  setTreasuryError(errorMessage);

  log('error', 'Treasury fetch failed after all retries', {
    error: errorMessage,
  });

  return { success: false, error: errorMessage };
}

/**
 * Refresh treasury data (for manual refresh button)
 *
 * @returns Result with success status
 */
export async function refreshTreasuryData(): Promise<FetchTreasuryResult> {
  log('info', 'Manual treasury refresh triggered');

  // Track analytics event
  trackEvent('treasury_refreshed', {});

  return fetchTreasuryData();
}

/**
 * Get current treasury state
 */
export function getTreasuryState(): TreasuryState {
  return $treasury.get();
}

/**
 * Clear treasury data (e.g., on logout)
 */
export function clearTreasuryData(): void {
  log('info', 'Clearing treasury data');
  clearTreasury();
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseTreasuryBalanceOptions {
  /** Whether to auto-fetch on mount */
  autoFetch?: boolean;
  /** Whether to refetch if data is stale */
  refetchIfStale?: boolean;
}

export interface UseTreasuryBalanceResult {
  /** Current treasury state */
  state: TreasuryState;
  /** Whether treasury is loading */
  isLoading: boolean;
  /** Fetch/refresh the treasury data */
  refresh: () => Promise<void>;
  /** Clear the treasury data */
  clear: () => void;
  /** Whether a refresh is in progress (separate from initial load) */
  isRefreshing: boolean;
}

/**
 * React hook for treasury balance
 *
 * @param options - Hook options
 * @returns Treasury state and actions
 */
export function useTreasuryBalance(
  options: UseTreasuryBalanceOptions = {}
): UseTreasuryBalanceResult {
  const { autoFetch = true, refetchIfStale = true } = options;

  const state = useStore($treasury);
  const isLoading = useStore($treasuryLoading);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasFetchedRef = useRef(false);

  // Fetch data on mount
  useEffect(() => {
    const shouldFetch =
      autoFetch &&
      (!hasFetchedRef.current || (refetchIfStale && isTreasuryStale(TREASURY_STALE_THRESHOLD_MS)));

    if (shouldFetch) {
      hasFetchedRef.current = true;

      // Track analytics event
      trackEvent('treasury_view_viewed', {});

      fetchTreasuryData();
    }
  }, [autoFetch, refetchIfStale]);

  // Manual refresh callback
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshTreasuryData();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Clear callback
  const clear = useCallback(() => {
    clearTreasuryData();
    hasFetchedRef.current = false;
  }, []);

  return {
    state,
    isLoading,
    refresh,
    clear,
    isRefreshing,
  };
}

// ============================================================================
// Export Service Object
// ============================================================================

export const TreasuryService = {
  fetchData: fetchTreasuryData,
  refreshData: refreshTreasuryData,
  getState: getTreasuryState,
  clear: clearTreasuryData,
  isStale: isTreasuryStale,
};

export default TreasuryService;
