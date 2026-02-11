/**
 * Proposal List State Management
 *
 * Nanostores atoms for managing proposal listing state with filters,
 * sorting, pagination, and cross-tab synchronization.
 *
 * Story: 9-1-3-proposal-listing
 * ACs: 1, 2, 3, 4, 5, 7, 8, 9
 */

import { atom, computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import type {
  ProposalListItem,
  ProposalFilters,
  ProposalSort,
  ProposalStatusCounts,
} from '../types';
import { $userVotes } from './votes';

// Re-export types for convenience
export type { ProposalListItem, ProposalFilters, ProposalSort, ProposalStatusCounts } from '../types';

// Storage keys
const PROPOSAL_FILTERS_KEY = 'hwdao:proposal-filters';

// Default filter state
const DEFAULT_FILTERS: ProposalFilters = {
  status: [],
  search: '',
  myProposals: false,
  notVoted: false,
};

/**
 * Current list of proposals (not persisted - fetched from canister)
 */
export const $proposalList = atom<ProposalListItem[]>([]);

/**
 * Current filter state (persisted for user convenience)
 */
export const $proposalFilters = persistentAtom<ProposalFilters>(
  PROPOSAL_FILTERS_KEY,
  DEFAULT_FILTERS,
  {
    encode: JSON.stringify,
    decode: (value) => {
      try {
        const parsed = JSON.parse(value);
        // Validate parsed filters have expected shape
        return {
          status: Array.isArray(parsed.status) ? parsed.status : [],
          search: typeof parsed.search === 'string' ? parsed.search : '',
          myProposals: typeof parsed.myProposals === 'boolean' ? parsed.myProposals : false,
          notVoted: typeof parsed.notVoted === 'boolean' ? parsed.notVoted : false,
        };
      } catch {
        return DEFAULT_FILTERS;
      }
    },
  }
);

/**
 * Current sort selection (not persisted - defaults to newest)
 */
export const $proposalSort = atom<ProposalSort>('newest');

/**
 * Current page number (1-indexed)
 */
export const $proposalPage = atom<number>(1);

/**
 * Total count of proposals matching current filters
 */
export const $proposalTotalCount = atom<number>(0);

/**
 * Loading state for proposal list
 */
export const $proposalListLoading = atom<boolean>(false);

/**
 * Error state for proposal list
 */
export const $proposalListError = atom<string | null>(null);

/**
 * Proposal counts by status (for filter badges)
 */
export const $proposalStatusCounts = atom<ProposalStatusCounts>({
  Active: 0,
  Passed: 0,
  Failed: 0,
  Pending: 0,
});

/**
 * Derived atom: Set of proposal IDs the user has voted on
 * Used for "You voted ✓" indicators on ProposalCard
 */
export const $userVotedProposalIds = computed($userVotes, (userVotes) => {
  return new Set(Object.keys(userVotes));
});

/**
 * Derived atom: Check if user has voted on a specific proposal
 */
export function hasUserVoted(proposalId: string): boolean {
  return $userVotedProposalIds.get().has(proposalId);
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Set the proposal list
 */
export function setProposalList(proposals: ProposalListItem[]): void {
  $proposalList.set(proposals);
}

/**
 * Set total proposal count
 */
export function setProposalTotalCount(count: number): void {
  $proposalTotalCount.set(count);
}

/**
 * Set loading state
 */
export function setProposalListLoading(loading: boolean): void {
  $proposalListLoading.set(loading);
}

/**
 * Set error state
 */
export function setProposalListError(error: string | null): void {
  $proposalListError.set(error);
}

/**
 * Set proposal status counts
 */
export function setProposalStatusCounts(counts: ProposalStatusCounts): void {
  $proposalStatusCounts.set(counts);
}

/**
 * Set complete filter state
 */
export function setProposalFilters(filters: ProposalFilters): void {
  $proposalFilters.set(filters);
}

/**
 * Update filters and reset to page 1
 */
export function updateFilters(updates: Partial<ProposalFilters>): void {
  const current = $proposalFilters.get();
  $proposalFilters.set({ ...current, ...updates });
  $proposalPage.set(1); // Reset to page 1 when filters change
}

/**
 * Toggle a status filter
 */
export function toggleStatusFilter(status: ProposalFilters['status'][number]): void {
  const current = $proposalFilters.get();
  const statusList = current.status.includes(status)
    ? current.status.filter((s) => s !== status)
    : [...current.status, status];
  updateFilters({ status: statusList });
}

/**
 * Clear all filters
 */
export function clearAllFilters(): void {
  $proposalFilters.set(DEFAULT_FILTERS);
  $proposalPage.set(1);
}

/**
 * Clear search only (preserves other filters)
 */
export function clearSearch(): void {
  const current = $proposalFilters.get();
  $proposalFilters.set({ ...current, search: '' });
  $proposalPage.set(1);
}

/**
 * Set sort option and reset to page 1
 */
export function setProposalSort(sort: ProposalSort): void {
  $proposalSort.set(sort);
  $proposalPage.set(1); // Reset to page 1 when sort changes
}

/**
 * Set current page
 */
export function setProposalPage(page: number): void {
  // Clamp to valid range
  const maxPage = Math.max(1, Math.ceil($proposalTotalCount.get() / 20));
  const clampedPage = Math.max(1, Math.min(page, maxPage));
  $proposalPage.set(clampedPage);
}

/**
 * Go to next page
 */
export function nextPage(): void {
  const current = $proposalPage.get();
  const maxPage = Math.max(1, Math.ceil($proposalTotalCount.get() / 20));
  if (current < maxPage) {
    $proposalPage.set(current + 1);
  }
}

/**
 * Go to previous page
 */
export function previousPage(): void {
  const current = $proposalPage.get();
  if (current > 1) {
    $proposalPage.set(current - 1);
  }
}

/**
 * Initialize filters from URL query params
 */
export function initFromUrlParams(params: URLSearchParams): void {
  const status = params.get('status')?.split(',').filter(Boolean) as ProposalFilters['status'] | undefined;
  const search = params.get('search') || '';
  const myProposals = params.get('myProposals') === 'true';
  const notVoted = params.get('notVoted') === 'true';
  const sort = params.get('sort') as ProposalSort | null;
  const page = parseInt(params.get('page') || '1', 10);

  // Set filters without triggering page reset (we'll set page explicitly)
  const currentFilters = $proposalFilters.get();
  $proposalFilters.set({
    status: status && status.length > 0 ? status : currentFilters.status,
    search: search || currentFilters.search,
    myProposals: myProposals !== undefined ? myProposals : currentFilters.myProposals,
    notVoted: notVoted !== undefined ? notVoted : currentFilters.notVoted,
  });

  if (sort) {
    $proposalSort.set(sort);
  }

  if (!isNaN(page) && page >= 1) {
    $proposalPage.set(page);
  }
}

/**
 * Get URL query params from current state
 */
export function getUrlParams(): URLSearchParams {
  const filters = $proposalFilters.get();
  const sort = $proposalSort.get();
  const page = $proposalPage.get();
  const params = new URLSearchParams();

  if (filters.status.length > 0) {
    params.set('status', filters.status.join(','));
  }
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (filters.myProposals) {
    params.set('myProposals', 'true');
  }
  if (filters.notVoted) {
    params.set('notVoted', 'true');
  }
  if (sort !== 'newest') {
    params.set('sort', sort);
  }
  if (page > 1) {
    params.set('page', String(page));
  }

  return params;
}

/**
 * Cross-tab synchronization for proposal list
 * Listens for changes to filters from other tabs
 */
export function setupProposalListCrossTabSync(
  onFilterChange?: (filters: ProposalFilters) => void
): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === PROPOSAL_FILTERS_KEY && event.newValue) {
      try {
        const newFilters = JSON.parse(event.newValue) as ProposalFilters;
        if (onFilterChange) {
          onFilterChange(newFilters);
        }
      } catch {
        // Ignore parse errors
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange);
    }
  };
}

/**
 * Actions object for convenient access
 */
export const proposalListActions = {
  setProposalList,
  setProposalTotalCount,
  setProposalListLoading,
  setProposalListError,
  setProposalStatusCounts,
  updateFilters,
  toggleStatusFilter,
  clearAllFilters,
  clearSearch,
  setProposalSort,
  setProposalPage,
  nextPage,
  previousPage,
  initFromUrlParams,
  getUrlParams,
  setupProposalListCrossTabSync,
  hasUserVoted,
};
