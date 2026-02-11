/**
 * Treasury State Management
 *
 * Manages DAO treasury balance display using nanostores.
 * Follows the tokenBalance.ts pattern for state management.
 *
 * Story: 9-2-2-treasury-view
 * ACs: 1, 2, 3, 4
 */

import { atom, computed } from 'nanostores';
import { formatTokenAmount, TOKEN_DECIMALS } from './tokenBalance';

// ============================================================================
// Types
// ============================================================================

/**
 * Transaction type
 */
export type TransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'burn' | 'payout' | 'escrow_release';

/**
 * Transaction record from treasury
 */
export interface Transaction {
  /** Transaction ID */
  id: string;
  /** Transaction type */
  type: TransactionType;
  /** Amount in e8s */
  amount: bigint;
  /** Timestamp (nanoseconds from IC) */
  timestamp: bigint;
  /** Optional description */
  description?: string;
  /** Token type (DOM or ICP) */
  tokenType: 'DOM' | 'ICP';
}

/**
 * Treasury balance breakdown
 * Maps to canister TreasuryBalance struct
 */
export interface TreasuryBalance {
  /** ICP balance in e8s */
  icpBalance: bigint;
  /** DOM token balance in e8s */
  domBalance: bigint;
  /** Pending ICP payouts */
  pendingPayoutsIcp: bigint;
  /** Pending DOM payouts */
  pendingPayoutsDom: bigint;
  /** Active ICP escrows */
  activeEscrowsIcp: bigint;
  /** Active DOM escrows */
  activeEscrowsDom: bigint;
}

/**
 * Treasury state with loading/error handling
 */
export interface TreasuryState {
  /** Treasury balance breakdown */
  balance: TreasuryBalance | null;
  /** Recent transactions */
  transactions: Transaction[];
  /** Last successful fetch timestamp */
  lastUpdated: number | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

/**
 * Fund allocation category for display
 */
export interface FundAllocation {
  /** Category name */
  name: string;
  /** Amount in e8s */
  amount: bigint;
  /** Percentage of total (0-100) */
  percentage: number;
  /** Display color */
  color: string;
}

// ============================================================================
// Configuration
// ============================================================================

/** Stale threshold for treasury data (5 minutes) */
export const TREASURY_STALE_THRESHOLD_MS = 5 * 60 * 1000;

/** Default treasury balance */
const DEFAULT_BALANCE: TreasuryBalance = {
  icpBalance: BigInt(0),
  domBalance: BigInt(0),
  pendingPayoutsIcp: BigInt(0),
  pendingPayoutsDom: BigInt(0),
  activeEscrowsIcp: BigInt(0),
  activeEscrowsDom: BigInt(0),
};

/** Initial treasury state */
const INITIAL_STATE: TreasuryState = {
  balance: null,
  transactions: [],
  lastUpdated: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Main treasury state store
 */
export const $treasury = atom<TreasuryState>({ ...INITIAL_STATE });

/**
 * Loading state convenience atom
 */
export const $treasuryLoading = computed($treasury, (state) => state.isLoading);

/**
 * Error state convenience atom
 */
export const $treasuryError = computed($treasury, (state) => state.error);

/**
 * Has treasury data been fetched
 */
export const $hasTreasuryData = computed($treasury, (state) => state.lastUpdated !== null);

/**
 * Treasury balance (or default if not fetched)
 */
export const $treasuryBalance = computed($treasury, (state) => state.balance ?? DEFAULT_BALANCE);

/**
 * Recent transactions
 */
export const $treasuryTransactions = computed($treasury, (state) => state.transactions);

/**
 * Total DOM balance (available + pending + escrow)
 */
export const $totalDomBalance = computed($treasuryBalance, (balance) => {
  return balance.domBalance + balance.pendingPayoutsDom + balance.activeEscrowsDom;
});

/**
 * Total ICP balance (available + pending + escrow)
 */
export const $totalIcpBalance = computed($treasuryBalance, (balance) => {
  return balance.icpBalance + balance.pendingPayoutsIcp + balance.activeEscrowsIcp;
});

/**
 * Formatted total DOM balance
 */
export const $formattedDomBalance = computed($totalDomBalance, (balance) => {
  return formatTokenAmount(balance, TOKEN_DECIMALS);
});

/**
 * Formatted total ICP balance
 */
export const $formattedIcpBalance = computed($totalIcpBalance, (balance) => {
  return formatTokenAmount(balance, TOKEN_DECIMALS);
});

/**
 * DOM fund allocations for breakdown display
 */
export const $domFundAllocations = computed($treasuryBalance, (balance): FundAllocation[] => {
  const total = balance.domBalance + balance.pendingPayoutsDom + balance.activeEscrowsDom;

  if (total === BigInt(0)) {
    return [
      { name: 'Operational', amount: BigInt(0), percentage: 0, color: 'bg-teal-500' },
      { name: 'Pending Payouts', amount: BigInt(0), percentage: 0, color: 'bg-amber-500' },
      { name: 'Escrow', amount: BigInt(0), percentage: 0, color: 'bg-purple-500' },
    ];
  }

  const calculatePercentage = (amount: bigint): number => {
    return Number((amount * BigInt(10000)) / total) / 100;
  };

  return [
    {
      name: 'Operational',
      amount: balance.domBalance,
      percentage: calculatePercentage(balance.domBalance),
      color: 'bg-teal-500',
    },
    {
      name: 'Pending Payouts',
      amount: balance.pendingPayoutsDom,
      percentage: calculatePercentage(balance.pendingPayoutsDom),
      color: 'bg-amber-500',
    },
    {
      name: 'Escrow',
      amount: balance.activeEscrowsDom,
      percentage: calculatePercentage(balance.activeEscrowsDom),
      color: 'bg-purple-500',
    },
  ];
});

/**
 * ICP fund allocations for breakdown display
 */
export const $icpFundAllocations = computed($treasuryBalance, (balance): FundAllocation[] => {
  const total = balance.icpBalance + balance.pendingPayoutsIcp + balance.activeEscrowsIcp;

  if (total === BigInt(0)) {
    return [
      { name: 'Operational', amount: BigInt(0), percentage: 0, color: 'bg-blue-500' },
      { name: 'Pending Payouts', amount: BigInt(0), percentage: 0, color: 'bg-orange-500' },
      { name: 'Escrow', amount: BigInt(0), percentage: 0, color: 'bg-indigo-500' },
    ];
  }

  const calculatePercentage = (amount: bigint): number => {
    return Number((amount * BigInt(10000)) / total) / 100;
  };

  return [
    {
      name: 'Operational',
      amount: balance.icpBalance,
      percentage: calculatePercentage(balance.icpBalance),
      color: 'bg-blue-500',
    },
    {
      name: 'Pending Payouts',
      amount: balance.pendingPayoutsIcp,
      percentage: calculatePercentage(balance.pendingPayoutsIcp),
      color: 'bg-orange-500',
    },
    {
      name: 'Escrow',
      amount: balance.activeEscrowsIcp,
      percentage: calculatePercentage(balance.activeEscrowsIcp),
      color: 'bg-indigo-500',
    },
  ];
});

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format timestamp from nanoseconds to human-readable date
 * @param timestamp - Timestamp in nanoseconds
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: bigint): string {
  // Convert nanoseconds to milliseconds
  const ms = Number(timestamp / BigInt(1_000_000));
  const date = new Date(ms);

  // Format as relative time if recent, otherwise full date
  const now = Date.now();
  const diffMs = now - ms;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Get transaction type display label
 * @param type - Transaction type
 * @returns Human-readable label
 */
export function getTransactionTypeLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    deposit: 'Deposit',
    withdrawal: 'Withdrawal',
    transfer: 'Transfer',
    burn: 'Burn',
    payout: 'Payout',
    escrow_release: 'Escrow Release',
  };
  return labels[type] || type;
}

/**
 * Get transaction type icon color
 * @param type - Transaction type
 * @returns Tailwind color class
 */
export function getTransactionTypeColor(type: TransactionType): string {
  const colors: Record<TransactionType, string> = {
    deposit: 'text-green-600',
    withdrawal: 'text-red-600',
    transfer: 'text-blue-600',
    burn: 'text-orange-600',
    payout: 'text-purple-600',
    escrow_release: 'text-teal-600',
  };
  return colors[type] || 'text-gray-600';
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Set loading state
 */
export function setTreasuryLoading(isLoading: boolean): void {
  const current = $treasury.get();
  $treasury.set({
    ...current,
    isLoading,
    error: isLoading ? null : current.error, // Clear error when starting new fetch
  });
}

/**
 * Set treasury data after successful fetch
 * @param balance - Treasury balance breakdown
 * @param transactions - Recent transactions
 */
export function setTreasuryData(balance: TreasuryBalance, transactions: Transaction[]): void {
  $treasury.set({
    balance,
    transactions,
    lastUpdated: Date.now(),
    isLoading: false,
    error: null,
  });
}

/**
 * Set error state after failed fetch
 * @param error - Error message
 */
export function setTreasuryError(error: string): void {
  const current = $treasury.get();
  $treasury.set({
    ...current,
    isLoading: false,
    error,
  });
}

/**
 * Clear treasury state (e.g., on logout)
 */
export function clearTreasury(): void {
  $treasury.set({ ...INITIAL_STATE });
}

/**
 * Check if treasury data is stale (older than threshold)
 * @param thresholdMs - Stale threshold in milliseconds (default 5 minutes)
 * @returns true if data should be refreshed
 */
export function isTreasuryStale(thresholdMs: number = TREASURY_STALE_THRESHOLD_MS): boolean {
  const state = $treasury.get();
  if (!state.lastUpdated) return true;
  return Date.now() - state.lastUpdated > thresholdMs;
}

/**
 * Get current treasury balance
 * @returns Current treasury balance or null if not fetched
 */
export function getTreasuryBalance(): TreasuryBalance | null {
  return $treasury.get().balance;
}

// ============================================================================
// Export Actions Object
// ============================================================================

export const treasuryActions = {
  setLoading: setTreasuryLoading,
  setData: setTreasuryData,
  setError: setTreasuryError,
  clear: clearTreasury,
  isStale: isTreasuryStale,
  getBalance: getTreasuryBalance,
  formatTimestamp,
  getTransactionTypeLabel,
  getTransactionTypeColor,
};
