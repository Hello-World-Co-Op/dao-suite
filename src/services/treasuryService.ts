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

/**
 * Check if we're in mock/development mode
 */
function isMockMode(): boolean {
  return !TREASURY_CANISTER_ID || import.meta.env.DEV;
}

/**
 * Create structured log entry
 */
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
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

  // Return mock treasury balance
  // Total: 1,234,567.89 DOM operational + 500,000 pending + 250,000 escrow = ~2M DOM
  return {
    icpBalance: BigInt(50000000000), // 500 ICP
    domBalance: BigInt(123456789000000), // 1,234,567.89 DOM operational
    pendingPayoutsIcp: BigInt(10000000000), // 100 ICP pending
    pendingPayoutsDom: BigInt(50000000000000), // 500,000 DOM pending
    activeEscrowsIcp: BigInt(5000000000), // 50 ICP escrow
    activeEscrowsDom: BigInt(25000000000000), // 250,000 DOM escrow
  };
}

/**
 * Mock recent transactions fetch for development
 */
async function mockGetTransactions(limit: number): Promise<Transaction[]> {
  log('info', 'Mock transactions fetch', { limit });

  // Simulate network delay
  await sleep(400);

  const now = BigInt(Date.now() * 1_000_000); // Convert to nanoseconds
  const hour = BigInt(3600 * 1_000_000_000); // 1 hour in nanoseconds
  const day = BigInt(24) * hour;

  // Return mock transactions
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-001',
      type: 'deposit',
      amount: BigInt(10000000000000), // 100,000 DOM
      timestamp: now - hour * BigInt(2),
      description: 'Membership dues deposit',
      tokenType: 'DOM',
    },
    {
      id: 'tx-002',
      type: 'payout',
      amount: BigInt(5000000000000), // 50,000 DOM
      timestamp: now - hour * BigInt(5),
      description: 'Community grant payout',
      tokenType: 'DOM',
    },
    {
      id: 'tx-003',
      type: 'burn',
      amount: BigInt(2500000000000), // 25,000 DOM
      timestamp: now - day,
      description: 'Ecological donation burn',
      tokenType: 'DOM',
    },
    {
      id: 'tx-004',
      type: 'escrow_release',
      amount: BigInt(1500000000), // 15 ICP
      timestamp: now - day * BigInt(2),
      description: 'Project milestone release',
      tokenType: 'ICP',
    },
    {
      id: 'tx-005',
      type: 'deposit',
      amount: BigInt(2000000000), // 20 ICP
      timestamp: now - day * BigInt(3),
      description: 'ICP contribution',
      tokenType: 'ICP',
    },
    {
      id: 'tx-006',
      type: 'transfer',
      amount: BigInt(1000000000000), // 10,000 DOM
      timestamp: now - day * BigInt(5),
      description: 'Internal transfer to escrow',
      tokenType: 'DOM',
    },
  ];

  return mockTransactions.slice(0, limit);
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

  // TODO: Replace with actual IC Agent call when @dfinity/agent is configured
  // const agent = new HttpAgent({ host: IC_HOST });
  // const actor = Actor.createActor(treasuryIdlFactory, {
  //   agent,
  //   canisterId: TREASURY_CANISTER_ID,
  // });
  // const result = await actor.get_treasury_balance();
  // if ('Err' in result) throw new Error(result.Err);
  // return {
  //   icpBalance: result.Ok.icp_balance,
  //   domBalance: result.Ok.dom_balance,
  //   pendingPayoutsIcp: result.Ok.pending_payouts_icp,
  //   pendingPayoutsDom: result.Ok.pending_payouts_dom,
  //   activeEscrowsIcp: result.Ok.active_escrows_icp,
  //   activeEscrowsDom: result.Ok.active_escrows_dom,
  // };

  // For now, use mock
  return mockGetTreasuryBalance();
}

/**
 * Fetch recent transactions from canister
 *
 * @param limit - Number of transactions to fetch
 * @returns List of recent transactions
 */
async function fetchTransactionsFromCanister(limit: number): Promise<Transaction[]> {
  if (isMockMode()) {
    return mockGetTransactions(limit);
  }

  // TODO: Replace with actual IC Agent call when @dfinity/agent is configured
  // const agent = new HttpAgent({ host: IC_HOST });
  // const actor = Actor.createActor(treasuryIdlFactory, {
  //   agent,
  //   canisterId: TREASURY_CANISTER_ID,
  // });
  // const result = await actor.get_recent_transactions(limit);
  // return result.map(tx => ({
  //   id: tx.id,
  //   type: tx.type as TransactionType,
  //   amount: tx.amount,
  //   timestamp: tx.timestamp,
  //   description: tx.description || undefined,
  //   tokenType: tx.token_type as 'DOM' | 'ICP',
  // }));

  // For now, use mock
  return mockGetTransactions(limit);
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
