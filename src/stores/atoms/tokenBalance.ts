/**
 * Token Balance State Management
 *
 * Manages DOM token balance display using nanostores.
 * Follows the notifications.ts pattern for state management.
 *
 * Story: 9-2-1-token-balance-display
 * ACs: 1, 2, 3, 4
 */

import { atom, computed } from 'nanostores';

// ============================================================================
// Types
// ============================================================================

/**
 * Token balance state
 */
export interface TokenBalanceState {
  /** Balance in e8s (8 decimal places) */
  balance: bigint;
  /** Last successful fetch timestamp */
  lastUpdated: number | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Principal owner of the balance */
  principal: string | null;
}

/**
 * Token metadata
 */
export interface TokenMetadata {
  /** Token symbol (e.g., "DOM") */
  symbol: string;
  /** Number of decimal places */
  decimals: number;
  /** Token name */
  name: string;
}

// ============================================================================
// Configuration
// ============================================================================

/** Default token decimals for DOM token */
export const TOKEN_DECIMALS = 8;

/** Default token symbol */
export const TOKEN_SYMBOL = 'DOM';

/** Default token name */
export const TOKEN_NAME = 'Decentralized Otter Money';

/** Default token metadata */
export const DEFAULT_TOKEN_METADATA: TokenMetadata = {
  symbol: TOKEN_SYMBOL,
  decimals: TOKEN_DECIMALS,
  name: TOKEN_NAME,
};

/** Initial balance state */
const INITIAL_STATE: TokenBalanceState = {
  balance: BigInt(0),
  lastUpdated: null,
  isLoading: false,
  error: null,
  principal: null,
};

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Main token balance store
 */
export const $tokenBalance = atom<TokenBalanceState>({ ...INITIAL_STATE });

/**
 * Token metadata store (rarely changes, so separate atom)
 */
export const $tokenMetadata = atom<TokenMetadata>({ ...DEFAULT_TOKEN_METADATA });

/**
 * Loading state convenience atom
 */
export const $tokenBalanceLoading = computed($tokenBalance, (state) => state.isLoading);

/**
 * Error state convenience atom
 */
export const $tokenBalanceError = computed($tokenBalance, (state) => state.error);

/**
 * Formatted balance for display
 */
export const $formattedBalance = computed([$tokenBalance, $tokenMetadata], (state, metadata) => {
  return formatTokenAmount(state.balance, metadata.decimals);
});

/**
 * Has balance been fetched at least once
 */
export const $hasBalance = computed($tokenBalance, (state) => state.lastUpdated !== null);

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format token amount from e8s to human-readable string
 * @param e8s - Amount in smallest units (e8s for 8 decimals)
 * @param decimals - Number of decimal places (default 8)
 * @returns Formatted string with 2 decimal places and thousands separators
 */
export function formatTokenAmount(e8s: bigint, decimals: number = TOKEN_DECIMALS): string {
  if (e8s === BigInt(0)) {
    return '0.00';
  }

  const divisor = BigInt(10 ** decimals);
  const whole = e8s / divisor;
  const fractional = e8s % divisor;

  // Format whole part with locale separators
  const wholeStr = whole.toLocaleString('en-US');

  // Format fractional part (padded to decimals, then take first 2)
  const fractionalStr = fractional.toString().padStart(decimals, '0').slice(0, 2);

  return `${wholeStr}.${fractionalStr}`;
}

/**
 * Parse token amount from string to e8s
 * @param amount - Amount as string (e.g., "123.45")
 * @param decimals - Number of decimal places (default 8)
 * @returns Amount in e8s
 */
export function parseTokenAmount(amount: string, decimals: number = TOKEN_DECIMALS): bigint {
  // Remove any commas from input
  const cleaned = amount.replace(/,/g, '');
  const parts = cleaned.split('.');
  const wholePart = parts[0] || '0';
  const fractionalPart = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals);

  const wholeE8s = BigInt(wholePart) * BigInt(10 ** decimals);
  const fractionalE8s = BigInt(fractionalPart);

  return wholeE8s + fractionalE8s;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Set loading state
 */
export function setTokenBalanceLoading(isLoading: boolean): void {
  const current = $tokenBalance.get();
  $tokenBalance.set({
    ...current,
    isLoading,
    error: isLoading ? null : current.error, // Clear error when starting new fetch
  });
}

/**
 * Set balance after successful fetch
 * @param balance - Balance in e8s
 * @param principal - Principal of the account owner
 */
export function setTokenBalance(balance: bigint, principal: string): void {
  $tokenBalance.set({
    balance,
    lastUpdated: Date.now(),
    isLoading: false,
    error: null,
    principal,
  });
}

/**
 * Set error state after failed fetch
 * @param error - Error message
 */
export function setTokenBalanceError(error: string): void {
  const current = $tokenBalance.get();
  $tokenBalance.set({
    ...current,
    isLoading: false,
    error,
  });
}

/**
 * Clear balance state (e.g., on logout)
 */
export function clearTokenBalance(): void {
  $tokenBalance.set({ ...INITIAL_STATE });
}

/**
 * Update token metadata
 * @param metadata - Partial metadata to update
 */
export function updateTokenMetadata(metadata: Partial<TokenMetadata>): void {
  const current = $tokenMetadata.get();
  $tokenMetadata.set({
    ...current,
    ...metadata,
  });
}

/**
 * Get current balance value
 * @returns Current balance in e8s
 */
export function getTokenBalanceValue(): bigint {
  return $tokenBalance.get().balance;
}

/**
 * Check if balance is stale (older than threshold)
 * @param thresholdMs - Stale threshold in milliseconds (default 2 minutes)
 * @returns true if balance should be refreshed
 */
export function isBalanceStale(thresholdMs: number = 2 * 60 * 1000): boolean {
  const state = $tokenBalance.get();
  if (!state.lastUpdated) return true;
  return Date.now() - state.lastUpdated > thresholdMs;
}

// ============================================================================
// Export Actions Object
// ============================================================================

export const tokenBalanceActions = {
  setLoading: setTokenBalanceLoading,
  setBalance: setTokenBalance,
  setError: setTokenBalanceError,
  clear: clearTokenBalance,
  getValue: getTokenBalanceValue,
  isStale: isBalanceStale,
  format: formatTokenAmount,
  parse: parseTokenAmount,
  updateMetadata: updateTokenMetadata,
};
