/**
 * Token Balance Service
 *
 * Service for fetching DOM token balances from the dom-token canister.
 * Provides hooks for React component integration.
 *
 * Story: 9-2-1-token-balance-display
 * ACs: 1, 2, 3
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { HttpAgent, Actor } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';
import {
  $tokenBalance,
  $tokenBalanceLoading,
  setTokenBalanceLoading,
  setTokenBalance,
  setTokenBalanceError,
  clearTokenBalance,
  isBalanceStale,
  type TokenBalanceState,
} from '@/stores';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Configuration
// ============================================================================

/** DOM token canister ID */
const DOM_TOKEN_CANISTER_ID = import.meta.env.VITE_DOM_TOKEN_CANISTER_ID || '';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15000;

/** Initial backoff delay for retries (1 second) */
const INITIAL_BACKOFF_MS = 1000;

/** Maximum backoff delay (30 seconds) */
const MAX_BACKOFF_MS = 30000;

/** Maximum retry attempts */
const MAX_RETRY_ATTEMPTS = 3;

/** Stale threshold for balance (2 minutes) */
const STALE_THRESHOLD_MS = 2 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface FetchBalanceResult {
  success: boolean;
  balance?: bigint;
  error?: string;
}

export interface TokenServiceState {
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
 * Check if we're in mock/development mode
 */
function isMockMode(): boolean {
  return !DOM_TOKEN_CANISTER_ID || import.meta.env.DEV;
}

/**
 * Minimal IDL factory for ICRC-1 balance_of query.
 * Only defines the single method we need — avoids importing a full .did binding.
 */
const icrc1BalanceOfIdl = IDL.Service({
  icrc1_balance_of: IDL.Func(
    [IDL.Record({ owner: IDL.Principal, subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)) })],
    [IDL.Nat],
    ['query'],
  ),
});

/**
 * Create structured log entry
 */
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'TokenService',
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
 * Mock balance fetch for development
 */
async function mockGetBalance(principal: string): Promise<bigint> {
  log('info', 'Mock balance fetch', { principal });

  // Simulate network delay
  await sleep(800);

  // Return a mock balance (e.g., 1,234.56789012 DOM in e8s)
  // Different mock balances for different principals for testing
  const mockBalances: Record<string, bigint> = {
    'mock-user': BigInt(123456789012), // 1,234.56789012 DOM
    'mock-whale': BigInt(42000000000000000), // 420,000,000 DOM (whale)
    'mock-new': BigInt(0), // 0 DOM (new user)
  };

  // Default to a reasonable balance for any unknown principal
  return mockBalances[principal] ?? BigInt(500000000000); // 5,000 DOM
}

// ============================================================================
// Canister Integration
// ============================================================================

/**
 * Fetch balance from dom-token canister
 *
 * @param principal - The principal text to fetch balance for
 * @returns The balance in e8s
 */
async function fetchBalanceFromCanister(principal: string): Promise<bigint> {
  if (isMockMode()) {
    return mockGetBalance(principal);
  }

  // Validate that the string is a valid IC principal before making the call.
  // Dashboard may pass a user-service ID (e.g. "user-42") which is not a
  // valid principal — return 0 rather than crashing.
  let owner: Principal;
  try {
    owner = Principal.fromText(principal);
  } catch {
    log('warn', 'Invalid principal format, returning zero balance', { principal });
    return BigInt(0);
  }

  // Anonymous agent is safe — icrc1_balance_of is a public query method
  const agent = HttpAgent.createSync({ host: IC_HOST });
  const actor = Actor.createActor(() => icrc1BalanceOfIdl, {
    agent,
    canisterId: DOM_TOKEN_CANISTER_ID,
  });
  const balance = (await actor.icrc1_balance_of({ owner, subaccount: [] })) as bigint;
  return balance;
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Fetch token balance with retry logic
 *
 * @param principal - The principal to fetch balance for
 * @returns Result with success status and balance or error
 */
export async function fetchTokenBalance(principal: string): Promise<FetchBalanceResult> {
  log('info', 'Fetching token balance', { principal });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      setTokenBalanceLoading(true);

      const balance = await withTimeout(fetchBalanceFromCanister(principal), REQUEST_TIMEOUT_MS);

      setTokenBalance(balance, principal);

      log('info', 'Balance fetched successfully', {
        principal,
        balance: balance.toString(),
        attempt,
      });

      return { success: true, balance };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      log('warn', `Balance fetch attempt ${attempt + 1} failed`, {
        principal,
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
  const errorMessage = lastError?.message || 'Failed to fetch balance';
  setTokenBalanceError(errorMessage);

  log('error', 'Balance fetch failed after all retries', {
    principal,
    error: errorMessage,
  });

  return { success: false, error: errorMessage };
}

/**
 * Refresh token balance (for manual refresh button)
 *
 * @param principal - The principal to refresh balance for
 * @returns Result with success status
 */
export async function refreshTokenBalance(principal: string): Promise<FetchBalanceResult> {
  log('info', 'Manual balance refresh triggered', { principal });

  // Track analytics event
  trackEvent('token_balance_refreshed', { principal });

  return fetchTokenBalance(principal);
}

/**
 * Get current balance state
 */
export function getBalanceState(): TokenBalanceState {
  return $tokenBalance.get();
}

/**
 * Clear balance (e.g., on logout)
 */
export function clearBalance(): void {
  log('info', 'Clearing token balance');
  clearTokenBalance();
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseTokenBalanceOptions {
  /** Principal to fetch balance for */
  principal: string | null;
  /** Whether to auto-fetch on mount */
  autoFetch?: boolean;
  /** Whether to refetch if balance is stale */
  refetchIfStale?: boolean;
}

export interface UseTokenBalanceResult {
  /** Current balance state */
  state: TokenBalanceState;
  /** Whether balance is loading */
  isLoading: boolean;
  /** Fetch/refresh the balance */
  refresh: () => Promise<void>;
  /** Clear the balance */
  clear: () => void;
  /** Whether a refresh is in progress (separate from initial load) */
  isRefreshing: boolean;
}

/**
 * React hook for token balance
 *
 * @param options - Hook options
 * @returns Balance state and actions
 */
export function useTokenBalance(options: UseTokenBalanceOptions): UseTokenBalanceResult {
  const { principal, autoFetch = true, refetchIfStale = true } = options;

  const state = useStore($tokenBalance);
  const isLoading = useStore($tokenBalanceLoading);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasFetchedRef = useRef(false);

  // Fetch balance on mount or when principal changes
  useEffect(() => {
    if (!principal) {
      return;
    }

    const shouldFetch =
      autoFetch &&
      (!hasFetchedRef.current ||
        state.principal !== principal ||
        (refetchIfStale && isBalanceStale(STALE_THRESHOLD_MS)));

    if (shouldFetch) {
      hasFetchedRef.current = true;

      // Track analytics event
      trackEvent('token_balance_viewed', { principal });

      fetchTokenBalance(principal);
    }
  }, [principal, autoFetch, refetchIfStale, state.principal]);

  // Manual refresh callback
  const refresh = useCallback(async () => {
    if (!principal) {
      return;
    }

    setIsRefreshing(true);
    try {
      await refreshTokenBalance(principal);
    } finally {
      setIsRefreshing(false);
    }
  }, [principal]);

  // Clear callback
  const clear = useCallback(() => {
    clearBalance();
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

export const TokenService = {
  fetchBalance: fetchTokenBalance,
  refreshBalance: refreshTokenBalance,
  getState: getBalanceState,
  clear: clearBalance,
  isStale: isBalanceStale,
};

export default TokenService;
