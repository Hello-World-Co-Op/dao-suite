/**
 * Escrow View State Management
 *
 * Manages escrow view state using nanostores.
 * Follows the burn.ts and treasury.ts patterns for state management.
 *
 * Story: 9-2-4-escrow-view
 * ACs: 1, 2, 3, 4
 */

import { atom, computed } from 'nanostores';
import { formatTokenAmount, TOKEN_DECIMALS } from './tokenBalance';

// ============================================================================
// Types
// ============================================================================

/**
 * Escrow status (from treasury canister)
 */
export type EscrowStatus = 'Active' | 'Released' | 'Cancelled' | 'Expired';

/**
 * Milestone status (from treasury canister)
 */
export type MilestoneStatus = 'Pending' | 'Approved' | 'Released' | 'Disputed' | 'Cancelled';

/**
 * Token type
 */
export type TokenType = 'ICP' | 'DOM';

/**
 * Release authority type (from treasury canister)
 */
export type ReleaseAuthority =
  | { Controller: null }
  | { Governance: null }
  | { SpecificPrincipal: string };

/**
 * Milestone (from treasury canister)
 */
export interface Milestone {
  /** Milestone name/title */
  name: string;
  /** Milestone description */
  description: string;
  /** Amount for this milestone (in e8s) */
  amount: bigint;
  /** Deadline timestamp in nanoseconds */
  deadline: bigint;
  /** Milestone status */
  status: MilestoneStatus;
  /** Timestamp when approved */
  approved_at?: bigint;
  /** Timestamp when released */
  released_at?: bigint;
  /** Reason if disputed */
  dispute_reason?: string;
  /** Transaction ID if released */
  tx_id?: string;
}

/**
 * Escrow (from treasury canister)
 */
export interface Escrow {
  /** Escrow ID */
  id: bigint;
  /** Recipient principal */
  recipient: string;
  /** Total escrow amount (in e8s) */
  amount: bigint;
  /** Amount already released (in e8s) */
  released_amount: bigint;
  /** Token type (ICP or DOM) */
  token_type: TokenType;
  /** Escrow conditions/description */
  conditions: string;
  /** Release authority */
  release_authority: ReleaseAuthority;
  /** Escrow status */
  status: EscrowStatus;
  /** Created timestamp in nanoseconds */
  created_at: bigint;
  /** Expiry timestamp in nanoseconds */
  expiry: bigint;
  /** Milestones (empty for simple escrows) */
  milestones: Milestone[];
}

/**
 * Escrow state with loading/error handling
 */
export interface EscrowState {
  /** User's escrows list */
  escrows: Escrow[];
  /** Last successful fetch timestamp */
  lastUpdated: number | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
}

/**
 * Status filter type
 */
export type EscrowStatusFilter = EscrowStatus | 'All';

// ============================================================================
// Configuration
// ============================================================================

/** Stale threshold for escrow data (2 minutes) */
export const ESCROW_STALE_THRESHOLD_MS = 2 * 60 * 1000;

/** Initial escrow state */
const INITIAL_ESCROW_STATE: EscrowState = {
  escrows: [],
  lastUpdated: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Main escrow state store
 */
export const $escrow = atom<EscrowState>({ ...INITIAL_ESCROW_STATE });

/**
 * Selected escrow for detail view
 */
export const $selectedEscrow = atom<Escrow | null>(null);

/**
 * Current status filter
 */
export const $escrowStatusFilter = atom<EscrowStatusFilter>('All');

// ============================================================================
// Computed Atoms
// ============================================================================

/**
 * Loading state convenience atom
 */
export const $escrowLoading = computed($escrow, (state) => state.isLoading);

/**
 * Error state convenience atom
 */
export const $escrowError = computed($escrow, (state) => state.error);

/**
 * Has escrow data been fetched
 */
export const $hasEscrowData = computed($escrow, (state) => state.lastUpdated !== null);

/**
 * User's escrows list
 */
export const $userEscrows = computed($escrow, (state) => state.escrows);

/**
 * Active escrows only
 */
export const $activeEscrows = computed($escrow, (state) =>
  state.escrows.filter((e) => e.status === 'Active')
);

/**
 * Completed escrows (Released or Cancelled or Expired)
 */
export const $completedEscrows = computed($escrow, (state) =>
  state.escrows.filter((e) => e.status !== 'Active')
);

/**
 * Escrows count
 */
export const $escrowCount = computed($escrow, (state) => state.escrows.length);

/**
 * Active escrows count
 */
export const $activeEscrowCount = computed($activeEscrows, (escrows) => escrows.length);

/**
 * Total escrowed amount across all active escrows (in e8s)
 */
export const $totalEscrowedAmount = computed($activeEscrows, (escrows) =>
  escrows.reduce((sum, e) => sum + e.amount, BigInt(0))
);

/**
 * Total released amount across all escrows (in e8s)
 */
export const $totalReleasedAmount = computed($escrow, (state) =>
  state.escrows.reduce((sum, e) => sum + e.released_amount, BigInt(0))
);

/**
 * Formatted total escrowed amount
 */
export const $formattedTotalEscrowed = computed($totalEscrowedAmount, (total) =>
  formatTokenAmount(total, TOKEN_DECIMALS)
);

/**
 * Formatted total released amount
 */
export const $formattedTotalReleased = computed($totalReleasedAmount, (total) =>
  formatTokenAmount(total, TOKEN_DECIMALS)
);

/**
 * Filtered escrows based on status filter
 */
export const $filteredEscrows = computed(
  [$escrow, $escrowStatusFilter],
  (state, filter) => {
    if (filter === 'All') {
      return state.escrows;
    }
    return state.escrows.filter((e: Escrow) => e.status === filter);
  }
);

/**
 * Escrows grouped by status for summary
 */
export const $escrowsByStatus = computed($escrow, (state) => {
  const grouped: Record<EscrowStatus, Escrow[]> = {
    Active: [],
    Released: [],
    Cancelled: [],
    Expired: [],
  };
  state.escrows.forEach((e) => {
    grouped[e.status].push(e);
  });
  return grouped;
});

/**
 * Status counts for filter badges
 */
export const $escrowStatusCounts = computed($escrowsByStatus, (grouped) => ({
  All: Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0),
  Active: grouped.Active.length,
  Released: grouped.Released.length,
  Cancelled: grouped.Cancelled.length,
  Expired: grouped.Expired.length,
}));

// ============================================================================
// Actions - Escrow State
// ============================================================================

/**
 * Set loading state for escrow fetch
 */
export function setEscrowLoading(isLoading: boolean): void {
  const current = $escrow.get();
  $escrow.set({
    ...current,
    isLoading,
    error: isLoading ? null : current.error,
  });
}

/**
 * Set user's escrows after successful fetch
 * @param escrows - Escrows where user is recipient
 */
export function setUserEscrows(escrows: Escrow[]): void {
  $escrow.set({
    escrows,
    lastUpdated: Date.now(),
    isLoading: false,
    error: null,
  });
}

/**
 * Set error state after failed escrow fetch
 * @param error - Error message
 */
export function setEscrowError(error: string): void {
  const current = $escrow.get();
  $escrow.set({
    ...current,
    isLoading: false,
    error,
  });
}

/**
 * Clear escrow state
 */
export function clearEscrow(): void {
  $escrow.set({ ...INITIAL_ESCROW_STATE });
  $selectedEscrow.set(null);
  $escrowStatusFilter.set('All');
}

/**
 * Set selected escrow for detail view
 * @param escrow - Escrow to select or null to clear
 */
export function setSelectedEscrow(escrow: Escrow | null): void {
  $selectedEscrow.set(escrow);
}

/**
 * Set status filter
 * @param filter - Status to filter by or 'All'
 */
export function setEscrowStatusFilter(filter: EscrowStatusFilter): void {
  $escrowStatusFilter.set(filter);
}

/**
 * Check if escrow data is stale
 * @param thresholdMs - Stale threshold in milliseconds
 */
export function isEscrowStale(thresholdMs: number = ESCROW_STALE_THRESHOLD_MS): boolean {
  const state = $escrow.get();
  if (!state.lastUpdated) return true;
  return Date.now() - state.lastUpdated > thresholdMs;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get milestone progress for an escrow
 * @param escrow - Escrow to get progress for
 * @returns { released, total, percentage }
 */
export function getMilestoneProgress(escrow: Escrow): {
  released: number;
  total: number;
  percentage: number;
} {
  const total = escrow.milestones.length;
  if (total === 0) {
    // Simple escrow without milestones - calculate based on amount
    const releasedPercent =
      escrow.amount > BigInt(0)
        ? Number((escrow.released_amount * BigInt(100)) / escrow.amount)
        : escrow.status === 'Released'
          ? 100
          : 0;
    return {
      released: escrow.status === 'Released' ? 1 : 0,
      total: 1,
      percentage: releasedPercent,
    };
  }

  const released = escrow.milestones.filter((m) => m.status === 'Released').length;
  const percentage = total > 0 ? Math.round((released / total) * 100) : 0;

  return { released, total, percentage };
}

/**
 * Get remaining amount for an escrow
 * @param escrow - Escrow to calculate remaining for
 */
export function getRemainingAmount(escrow: Escrow): bigint {
  return escrow.amount - escrow.released_amount;
}

/**
 * Format escrow amount with token type
 * @param amount - Amount in e8s
 * @param tokenType - Token type (ICP or DOM)
 */
export function formatEscrowAmount(amount: bigint, tokenType: TokenType): string {
  return `${formatTokenAmount(amount, TOKEN_DECIMALS)} ${tokenType}`;
}

/**
 * Format nanosecond timestamp to readable date
 * @param nanos - Timestamp in nanoseconds
 */
export function formatEscrowDate(nanos: bigint): string {
  const millis = Number(nanos / BigInt(1_000_000));
  return new Date(millis).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format nanosecond timestamp to full date/time
 * @param nanos - Timestamp in nanoseconds
 */
export function formatEscrowDateTime(nanos: bigint): string {
  const millis = Number(nanos / BigInt(1_000_000));
  return new Date(millis).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Check if escrow is expiring soon (within 7 days)
 * @param escrow - Escrow to check
 */
export function isExpiringSoon(escrow: Escrow): boolean {
  if (escrow.status !== 'Active') return false;
  const expiryMillis = Number(escrow.expiry / BigInt(1_000_000));
  const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return expiryMillis <= sevenDaysFromNow;
}

/**
 * Get status color for escrow
 * @param status - Escrow status
 */
export function getEscrowStatusColor(status: EscrowStatus): string {
  switch (status) {
    case 'Active':
      return 'text-green-600 bg-green-100';
    case 'Released':
      return 'text-blue-600 bg-blue-100';
    case 'Cancelled':
      return 'text-gray-600 bg-gray-100';
    case 'Expired':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Get status color for milestone
 * @param status - Milestone status
 */
export function getMilestoneStatusColor(status: MilestoneStatus): string {
  switch (status) {
    case 'Pending':
      return 'text-gray-600 bg-gray-100';
    case 'Approved':
      return 'text-blue-600 bg-blue-100';
    case 'Released':
      return 'text-green-600 bg-green-100';
    case 'Disputed':
      return 'text-orange-600 bg-orange-100';
    case 'Cancelled':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

// ============================================================================
// Export Actions Object
// ============================================================================

export const escrowActions = {
  setLoading: setEscrowLoading,
  setEscrows: setUserEscrows,
  setError: setEscrowError,
  clear: clearEscrow,
  setSelected: setSelectedEscrow,
  setFilter: setEscrowStatusFilter,
  isStale: isEscrowStale,
};
