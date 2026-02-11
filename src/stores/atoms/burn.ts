/**
 * Burn Donation State Management
 *
 * Manages DOM token burn donation state using nanostores.
 * Follows the treasury.ts pattern for state management.
 *
 * Story: 9-2-3-burn-donation
 * ACs: 1, 2, 5
 */

import { atom, computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import { formatTokenAmount, TOKEN_DECIMALS } from './tokenBalance';

// ============================================================================
// Types
// ============================================================================

/**
 * Burn record status
 */
export type BurnRecordStatus = 'pending' | 'confirmed' | 'failed';

/**
 * Local burn record stored in localStorage
 * Since on-chain burn_history() is global, we track user's burns locally
 */
export interface LocalBurnRecord {
  /** UUID generated client-side */
  id: string;
  /** Tokens burned (in e8s) */
  amount: bigint;
  /** Unix ms timestamp */
  timestamp: number;
  /** Transaction index from icrc1_burn result */
  txIndex?: string;
  /** Burn status */
  status: BurnRecordStatus;
}

/**
 * Burn pool totals from canister
 */
export interface BurnPool {
  /** Total tokens burned across all accounts (from total_burned() query) */
  totalBurned: bigint;
}

/**
 * Burn state with loading/error handling
 */
export interface BurnState {
  /** Burn pool totals */
  pool: BurnPool | null;
  /** Last successful fetch timestamp */
  lastUpdated: number | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

/**
 * Burn execution state (separate from pool state)
 */
export interface BurnExecutionState {
  /** Currently executing burn */
  isPending: boolean;
  /** Current burn amount being executed (in e8s) */
  pendingAmount: bigint | null;
  /** Success state after burn */
  isSuccess: boolean;
  /** Last successful burn tx index */
  lastTxIndex: string | null;
  /** Error message if burn failed */
  error: string | null;
}

/**
 * Serializable format for localStorage persistence
 */
interface SerializedBurnRecord {
  id: string;
  amount: string; // BigInt as string
  timestamp: number;
  txIndex?: string;
  status: BurnRecordStatus;
}

// ============================================================================
// Configuration
// ============================================================================

/** Stale threshold for burn pool data (2 minutes) */
export const BURN_POOL_STALE_THRESHOLD_MS = 2 * 60 * 1000;

/** Minimum burn amount (1 DOM in e8s) */
export const MIN_BURN_AMOUNT = BigInt(100_000_000); // 1 DOM

/** Transaction fee reserve for burns (currently 0 - burns are fee-free per ICRC-1) */
export const BURN_TX_FEE_RESERVE = BigInt(0); // Set to 0; burns don't require fees

/** Maximum burn history records to keep in localStorage */
export const MAX_BURN_HISTORY_RECORDS = 100;

/** LocalStorage key for burn history */
export const BURN_HISTORY_STORAGE_KEY = 'hwdao-burn-history';

/** Initial burn pool state */
const INITIAL_POOL_STATE: BurnState = {
  pool: null,
  lastUpdated: null,
  isLoading: false,
  error: null,
};

/** Initial burn execution state */
const INITIAL_EXECUTION_STATE: BurnExecutionState = {
  isPending: false,
  pendingAmount: null,
  isSuccess: false,
  lastTxIndex: null,
  error: null,
};

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Main burn pool state store
 */
export const $burnPool = atom<BurnState>({ ...INITIAL_POOL_STATE });

/**
 * Burn execution state store
 */
export const $burnExecution = atom<BurnExecutionState>({ ...INITIAL_EXECUTION_STATE });

/**
 * User's burn history stored in localStorage
 * Using persistentAtom for automatic persistence
 */
export const $userBurnHistory = persistentAtom<SerializedBurnRecord[]>(
  BURN_HISTORY_STORAGE_KEY,
  [],
  {
    encode: JSON.stringify,
    decode: (str) => {
      try {
        return JSON.parse(str) as SerializedBurnRecord[];
      } catch {
        return [];
      }
    },
  }
);

// ============================================================================
// Computed Atoms
// ============================================================================

/**
 * Loading state convenience atom
 */
export const $burnPoolLoading = computed($burnPool, (state) => state.isLoading);

/**
 * Error state convenience atom
 */
export const $burnPoolError = computed($burnPool, (state) => state.error);

/**
 * Has burn pool data been fetched
 */
export const $hasBurnPoolData = computed($burnPool, (state) => state.lastUpdated !== null);

/**
 * Total burned tokens (formatted for display)
 */
export const $formattedTotalBurned = computed($burnPool, (state) => {
  if (!state.pool) return '0.00';
  return formatTokenAmount(state.pool.totalBurned, TOKEN_DECIMALS);
});

/**
 * Burn execution pending state
 */
export const $isBurnPending = computed($burnExecution, (state) => state.isPending);

/**
 * Burn execution success state
 */
export const $isBurnSuccess = computed($burnExecution, (state) => state.isSuccess);

/**
 * Burn execution error
 */
export const $burnExecutionError = computed($burnExecution, (state) => state.error);

/**
 * Deserialized burn history (converts BigInt strings back)
 */
export const $burnHistory = computed($userBurnHistory, (records): LocalBurnRecord[] => {
  return records.map((record) => ({
    ...record,
    amount: BigInt(record.amount),
  }));
});

/**
 * Confirmed burns only
 */
export const $confirmedBurns = computed($burnHistory, (records) =>
  records.filter((r) => r.status === 'confirmed')
);

/**
 * User's total burned amount (from localStorage)
 */
export const $userTotalBurned = computed($confirmedBurns, (records) =>
  records.reduce((sum, r) => sum + r.amount, BigInt(0))
);

/**
 * Formatted user's total burned
 */
export const $formattedUserTotalBurned = computed($userTotalBurned, (total) =>
  formatTokenAmount(total, TOKEN_DECIMALS)
);

/**
 * Number of burn contributions
 */
export const $burnCount = computed($confirmedBurns, (records) => records.length);

// ============================================================================
// Actions - Burn Pool
// ============================================================================

/**
 * Set loading state for burn pool fetch
 */
export function setBurnPoolLoading(isLoading: boolean): void {
  const current = $burnPool.get();
  $burnPool.set({
    ...current,
    isLoading,
    error: isLoading ? null : current.error,
  });
}

/**
 * Set burn pool data after successful fetch
 * @param totalBurned - Total tokens burned
 */
export function setBurnPoolData(totalBurned: bigint): void {
  $burnPool.set({
    pool: { totalBurned },
    lastUpdated: Date.now(),
    isLoading: false,
    error: null,
  });
}

/**
 * Set error state after failed burn pool fetch
 * @param error - Error message
 */
export function setBurnPoolError(error: string): void {
  const current = $burnPool.get();
  $burnPool.set({
    ...current,
    isLoading: false,
    error,
  });
}

/**
 * Clear burn pool state
 */
export function clearBurnPool(): void {
  $burnPool.set({ ...INITIAL_POOL_STATE });
}

/**
 * Check if burn pool data is stale
 * @param thresholdMs - Stale threshold in milliseconds
 */
export function isBurnPoolStale(thresholdMs: number = BURN_POOL_STALE_THRESHOLD_MS): boolean {
  const state = $burnPool.get();
  if (!state.lastUpdated) return true;
  return Date.now() - state.lastUpdated > thresholdMs;
}

// ============================================================================
// Actions - Burn Execution
// ============================================================================

/**
 * Set burn execution to pending state
 * @param amount - Amount being burned (in e8s)
 */
export function setBurnPending(amount: bigint): void {
  $burnExecution.set({
    isPending: true,
    pendingAmount: amount,
    isSuccess: false,
    lastTxIndex: null,
    error: null,
  });
}

/**
 * Set burn execution success
 * @param txIndex - Transaction index from canister
 */
export function setBurnSuccess(txIndex: string): void {
  $burnExecution.set({
    isPending: false,
    pendingAmount: null,
    isSuccess: true,
    lastTxIndex: txIndex,
    error: null,
  });
}

/**
 * Set burn execution error
 * @param error - Error message
 */
export function setBurnExecutionError(error: string): void {
  const current = $burnExecution.get();
  $burnExecution.set({
    ...current,
    isPending: false,
    isSuccess: false,
    error,
  });
}

/**
 * Reset burn execution state (e.g., to allow new burn)
 */
export function resetBurnExecution(): void {
  $burnExecution.set({ ...INITIAL_EXECUTION_STATE });
}

// ============================================================================
// Actions - Burn History (localStorage)
// ============================================================================

/**
 * Add a burn record to localStorage history
 * @param record - Burn record to add
 */
export function addBurnRecord(record: LocalBurnRecord): void {
  const serialized: SerializedBurnRecord = {
    ...record,
    amount: record.amount.toString(),
  };

  const current = $userBurnHistory.get();
  const updated = [serialized, ...current].slice(0, MAX_BURN_HISTORY_RECORDS);
  $userBurnHistory.set(updated);
}

/**
 * Update a burn record status (e.g., pending -> confirmed)
 * @param id - Record ID
 * @param status - New status
 * @param txIndex - Transaction index (if confirming)
 */
export function updateBurnRecordStatus(
  id: string,
  status: BurnRecordStatus,
  txIndex?: string
): void {
  const current = $userBurnHistory.get();
  const updated = current.map((record) =>
    record.id === id ? { ...record, status, txIndex: txIndex ?? record.txIndex } : record
  );
  $userBurnHistory.set(updated);
}

/**
 * Remove a burn record from history
 * @param id - Record ID to remove
 */
export function removeBurnRecord(id: string): void {
  const current = $userBurnHistory.get();
  const updated = current.filter((record) => record.id !== id);
  $userBurnHistory.set(updated);
}

/**
 * Clear all burn history from localStorage
 */
export function clearBurnHistory(): void {
  $userBurnHistory.set([]);
}

/**
 * Get pending burn record (if any)
 */
export function getPendingBurnRecord(): LocalBurnRecord | null {
  const records = $burnHistory.get();
  const pending = records.find((r) => r.status === 'pending');
  return pending ?? null;
}

/**
 * Export burn history as CSV
 */
export function exportBurnHistoryCSV(): string {
  const records = $burnHistory.get();
  if (records.length === 0) return '';

  const headers = ['Date', 'Amount (DOM)', 'Transaction Index', 'Status'];
  const rows = records.map((record) => {
    const date = new Date(record.timestamp).toISOString();
    const amount = formatTokenAmount(record.amount, TOKEN_DECIMALS);
    return [date, amount, record.txIndex ?? 'N/A', record.status];
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate burn amount
 * @param amount - Amount in e8s
 * @param balance - User's current balance in e8s
 * @returns Error message or null if valid
 */
export function validateBurnAmount(amount: bigint, balance: bigint): string | null {
  if (amount <= BigInt(0)) {
    return 'Amount must be greater than 0';
  }

  if (amount < MIN_BURN_AMOUNT) {
    return `Minimum burn is ${formatTokenAmount(MIN_BURN_AMOUNT, TOKEN_DECIMALS)} DOM`;
  }

  const maxBurn = balance - BURN_TX_FEE_RESERVE;
  if (amount > maxBurn) {
    if (maxBurn < MIN_BURN_AMOUNT) {
      return 'Insufficient balance for burn (fee reserve required)';
    }
    return `Maximum burn is ${formatTokenAmount(maxBurn, TOKEN_DECIMALS)} DOM (fee reserved)`;
  }

  return null;
}

/**
 * Calculate maximum burnable amount (balance minus fee reserve)
 * @param balance - User's current balance in e8s
 */
export function getMaxBurnAmount(balance: bigint): bigint {
  const max = balance - BURN_TX_FEE_RESERVE;
  return max > BigInt(0) ? max : BigInt(0);
}

/**
 * Generate a unique ID for burn records
 */
export function generateBurnId(): string {
  return `burn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ============================================================================
// Export Actions Object
// ============================================================================

export const burnActions = {
  // Pool actions
  setPoolLoading: setBurnPoolLoading,
  setPoolData: setBurnPoolData,
  setPoolError: setBurnPoolError,
  clearPool: clearBurnPool,
  isPoolStale: isBurnPoolStale,

  // Execution actions
  setPending: setBurnPending,
  setSuccess: setBurnSuccess,
  setExecutionError: setBurnExecutionError,
  resetExecution: resetBurnExecution,

  // History actions
  addRecord: addBurnRecord,
  updateRecordStatus: updateBurnRecordStatus,
  removeRecord: removeBurnRecord,
  clearHistory: clearBurnHistory,
  getPendingRecord: getPendingBurnRecord,
  exportCSV: exportBurnHistoryCSV,

  // Validation
  validateAmount: validateBurnAmount,
  getMaxAmount: getMaxBurnAmount,
  generateId: generateBurnId,
};
