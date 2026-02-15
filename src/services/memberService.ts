/**
 * Member Directory Service
 *
 * Service for querying member data from the membership canister.
 * Provides hooks for React component integration.
 *
 * Story: 9-3-1-member-directory
 * ACs: 1, 2, 3
 *
 * NOTE: Membership canister lacks display name, avatar, archetype, and visibility
 * fields. This implementation uses mock data until canister is extended.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  $memberDirectory,
  $selectedMember,
  $memberSearchQuery,
  $filteredMembers,
  $currentPage,
  $totalPages,
  $archetypeCounts,
  setMemberLoading,
  setMembers,
  setMemberError,
  setCurrentPage,
  clearMembers,
  setSelectedMember,
  setMemberSearchQuery,
  isMemberDataStale,
  MEMBERS_PER_PAGE,
  type MemberProfile,
  type MemberDirectoryState,
} from '@/stores';

// ============================================================================
// Configuration
// ============================================================================

/** Membership canister ID */
const MEMBERSHIP_CANISTER_ID = import.meta.env.VITE_MEMBERSHIP_CANISTER_ID || '';

/** Initial backoff delay for retries (1 second) */
const INITIAL_BACKOFF_MS = 1000;

/** Maximum backoff delay (30 seconds) */
const MAX_BACKOFF_MS = 30000;

/** Maximum retry attempts for queries */
const MAX_RETRY_ATTEMPTS = 3;

/** Debounce delay for search (300ms) */
const SEARCH_DEBOUNCE_MS = 300;

// ============================================================================
// Types
// ============================================================================

export interface FetchMembersResult {
  success: boolean;
  members?: MemberProfile[];
  totalCount?: number;
  error?: string;
}

export interface FetchMemberProfileResult {
  success: boolean;
  member?: MemberProfile;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if we're in mock/development mode
 */
function isMockMode(): boolean {
  return !MEMBERSHIP_CANISTER_ID || import.meta.env.DEV;
}

/**
 * Create structured log entry
 */
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'MemberService',
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

// ============================================================================
// Mock Implementation
// ============================================================================

/**
 * Get mock members — empty until canister integration
 */
function getMockMembers(): MemberProfile[] {
  return [];
}

/**
 * Mock: List visible members with pagination
 */
async function mockListMembers(
  page: number = 0,
  perPage: number = MEMBERS_PER_PAGE
): Promise<FetchMembersResult> {
  log('info', 'Mock members fetch', { page, perPage });

  // Simulate network delay
  await sleep(300 + Math.random() * 200);

  const allMembers = getMockMembers();
  const start = page * perPage;
  const end = start + perPage;
  const paginatedMembers = allMembers.slice(start, end);

  return {
    success: true,
    members: paginatedMembers,
    totalCount: allMembers.length,
  };
}

/**
 * Mock: Get member profile by principal
 */
async function mockGetMemberProfile(principal: string): Promise<FetchMemberProfileResult> {
  log('info', 'Mock member profile fetch', { principal });

  // Simulate network delay
  await sleep(200 + Math.random() * 100);

  const allMembers = getMockMembers();
  const member = allMembers.find((m) => m.principal === principal);

  if (member) {
    return { success: true, member };
  }

  return { success: false, error: 'Member not found' };
}

// ============================================================================
// Canister Implementation (Placeholder)
// ============================================================================

/**
 * List visible members from canister with pagination
 *
 * NOTE: The membership canister currently only has get_active_members() which
 * returns principals, not full profile data. Extended endpoints needed.
 */
async function canisterListMembers(
  page: number = 0,
  perPage: number = MEMBERS_PER_PAGE,
  attempt: number = 0
): Promise<FetchMembersResult> {
  log('info', 'Fetching members from canister', { page, perPage, attempt });

  try {
    // TODO: When membership canister is extended with profile data:
    // 1. Create HttpAgent and Actor
    // 2. Call list_visible_members({ page, per_page })
    // 3. Transform response to MemberProfile[]

    // For now, fall back to mock data
    log('warn', 'Canister not available, using mock data');
    return mockListMembers(page, perPage);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Canister list members failed', { error: errorMessage, attempt });

    // Retry with exponential backoff
    if (attempt < MAX_RETRY_ATTEMPTS - 1) {
      const delay = getBackoffDelay(attempt);
      log('info', 'Retrying list members', { attempt: attempt + 1, delay });
      await sleep(delay);
      return canisterListMembers(page, perPage, attempt + 1);
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Get member profile from canister
 */
async function canisterGetMemberProfile(
  principal: string,
  attempt: number = 0
): Promise<FetchMemberProfileResult> {
  log('info', 'Fetching member profile from canister', { principal, attempt });

  try {
    // TODO: When membership canister is extended:
    // 1. Create HttpAgent and Actor
    // 2. Call get_member_profile(principal)
    // 3. Transform response to MemberProfile

    // For now, fall back to mock data
    log('warn', 'Canister not available, using mock data');
    return mockGetMemberProfile(principal);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Canister get member profile failed', { error: errorMessage, attempt });

    // Retry with exponential backoff
    if (attempt < MAX_RETRY_ATTEMPTS - 1) {
      const delay = getBackoffDelay(attempt);
      log('info', 'Retrying get member profile', { attempt: attempt + 1, delay });
      await sleep(delay);
      return canisterGetMemberProfile(principal, attempt + 1);
    }

    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch visible members (paginated)
 */
export async function getVisibleMembers(
  page: number = 0,
  perPage: number = MEMBERS_PER_PAGE
): Promise<FetchMembersResult> {
  if (isMockMode()) {
    return mockListMembers(page, perPage);
  }
  return canisterListMembers(page, perPage);
}

/**
 * Fetch member profile by principal
 */
export async function getMemberProfile(principal: string): Promise<FetchMemberProfileResult> {
  if (isMockMode()) {
    return mockGetMemberProfile(principal);
  }
  return canisterGetMemberProfile(principal);
}

/**
 * Search members by name (client-side filtering)
 */
export function searchMembers(members: MemberProfile[], query: string): MemberProfile[] {
  if (!query.trim()) {
    return members;
  }

  const lowerQuery = query.toLowerCase().trim();
  return members.filter(
    (member) =>
      member.displayName.toLowerCase().includes(lowerQuery) ||
      member.archetype?.toLowerCase().includes(lowerQuery) ||
      member.bio?.toLowerCase().includes(lowerQuery)
  );
}

// ============================================================================
// React Hooks
// ============================================================================

export interface UseMemberDirectoryOptions {
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Refetch if data is stale (default: true) */
  refetchIfStale?: boolean;
}

export interface UseMemberDirectoryResult {
  /** Current member directory state */
  memberState: MemberDirectoryState;
  /** Filtered members based on search query */
  filteredMembers: MemberProfile[];
  /** Archetype counts for filtering */
  archetypeCounts: Record<string, number>;
  /** Current search query */
  searchQuery: string;
  /** Selected member for detail view */
  selectedMember: MemberProfile | null;
  /** Current page (0-indexed) */
  currentPage: number;
  /** Total pages */
  totalPages: number;
  /** Is loading state */
  isLoading: boolean;
  /** Is refreshing (loading after initial fetch) */
  isRefreshing: boolean;
  /** Refresh member data */
  refresh: () => Promise<void>;
  /** Go to specific page */
  goToPage: (page: number) => Promise<void>;
  /** Go to next page */
  nextPage: () => Promise<void>;
  /** Go to previous page */
  prevPage: () => Promise<void>;
  /** Set search query (debounced) */
  setSearch: (query: string) => void;
  /** Clear search */
  clearSearch: () => void;
  /** Select a member for detail view */
  selectMember: (member: MemberProfile | null) => void;
  /** Clear all member data */
  clear: () => void;
}

/**
 * Hook for member directory component integration
 */
export function useMemberDirectory(
  options: UseMemberDirectoryOptions = {}
): UseMemberDirectoryResult {
  const { autoFetch = true, refetchIfStale = true } = options;

  // Subscribe to stores
  const memberState = useStore($memberDirectory);
  const filteredMembersValue = useStore($filteredMembers);
  const archetypeCountsValue = useStore($archetypeCounts);
  const searchQuery = useStore($memberSearchQuery);
  const selectedMember = useStore($selectedMember);
  const currentPageValue = useStore($currentPage);
  const totalPagesValue = useStore($totalPages);

  // Local state for refreshing indicator
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Debounce timeout ref for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if initial fetch has been done
  const initialFetchDone = useRef(false);

  /**
   * Fetch members for current page
   */
  const fetchMembers = useCallback(
    async (page: number = currentPageValue, isRefresh: boolean = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setMemberLoading(true);
      }

      log('info', 'Fetching members', { page, isRefresh });

      try {
        const result = await getVisibleMembers(page, MEMBERS_PER_PAGE);

        if (result.success && result.members) {
          setMembers(result.members, result.totalCount);
          setCurrentPage(page);
          log('info', 'Members fetched successfully', {
            count: result.members.length,
            totalCount: result.totalCount,
            page,
          });
        } else {
          setMemberError(result.error || 'Failed to fetch members');
          log('error', 'Failed to fetch members', { error: result.error });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setMemberError(errorMessage);
        log('error', 'Exception during member fetch', { error: errorMessage });
      } finally {
        if (isRefresh) {
          setIsRefreshing(false);
        }
      }
    },
    [currentPageValue]
  );

  /**
   * Refresh member data
   */
  const refresh = useCallback(async () => {
    await fetchMembers(0, true);
  }, [fetchMembers]);

  /**
   * Go to specific page
   */
  const goToPage = useCallback(
    async (page: number) => {
      if (page >= 0 && page < totalPagesValue) {
        await fetchMembers(page);
      }
    },
    [fetchMembers, totalPagesValue]
  );

  /**
   * Go to next page
   */
  const nextPage = useCallback(async () => {
    if (currentPageValue < totalPagesValue - 1) {
      await fetchMembers(currentPageValue + 1);
    }
  }, [fetchMembers, currentPageValue, totalPagesValue]);

  /**
   * Go to previous page
   */
  const prevPage = useCallback(async () => {
    if (currentPageValue > 0) {
      await fetchMembers(currentPageValue - 1);
    }
  }, [fetchMembers, currentPageValue]);

  /**
   * Set search query with debounce
   */
  const setSearch = useCallback((query: string) => {
    // Cancel previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      setMemberSearchQuery(query);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  /**
   * Clear search
   */
  const clearSearchHandler = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setMemberSearchQuery('');
  }, []);

  /**
   * Select member for detail view
   */
  const selectMember = useCallback((member: MemberProfile | null) => {
    setSelectedMember(member);
  }, []);

  /**
   * Clear all member data
   */
  const clear = useCallback(() => {
    clearMembers();
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && !initialFetchDone.current) {
      const shouldFetch = !memberState.lastUpdated || (refetchIfStale && isMemberDataStale());

      if (shouldFetch) {
        initialFetchDone.current = true;
        fetchMembers(0);
      }
    }
  }, [autoFetch, refetchIfStale, memberState.lastUpdated, fetchMembers]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    memberState,
    filteredMembers: filteredMembersValue,
    archetypeCounts: archetypeCountsValue,
    searchQuery,
    selectedMember,
    currentPage: currentPageValue,
    totalPages: totalPagesValue,
    isLoading: memberState.isLoading,
    isRefreshing,
    refresh,
    goToPage,
    nextPage,
    prevPage,
    setSearch,
    clearSearch: clearSearchHandler,
    selectMember,
    clear,
  };
}
