/**
 * Member Directory Service
 *
 * Service for querying member data via oracle-bridge proxy.
 * All canister calls go through oracle-bridge — no direct IC agent usage.
 * Provides hooks for React component integration.
 *
 * Story: BL-021.2
 * ACs: 1, 4, 5, 9
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { getOracleBridgeUrl } from '@/utils/oracleBridge';
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

/** Debounce delay for search (300ms) */
const SEARCH_DEBOUNCE_MS = 300;

// ============================================================================
// Types
// ============================================================================

/** Oracle-bridge DirectoryEntry (snake_case from API) */
interface DirectoryEntryResponse {
  principal: string;
  display_name: string | null;
  avatar?: string | null;
  archetype: string;
  bio?: string | null;
  join_date: string;
  is_active: boolean;
}

/** Oracle-bridge directory response shape */
interface DirectoryResponse {
  entries: DirectoryEntryResponse[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/** Oracle-bridge visibility response */
interface VisibilityResponse {
  visibility: 'Public' | 'MembersOnly' | 'Private';
}

export interface FetchMembersResult {
  success: boolean;
  members?: MemberProfile[];
  totalCount?: number;
  hasMore?: boolean;
  error?: string;
}

export interface FetchMemberProfileResult {
  success: boolean;
  member?: MemberProfile;
  error?: string;
}

export interface UpdateProfileData {
  display_name?: string;
  avatar?: string;
  archetype?: string;
  bio?: string;
}

export interface UpdateProfileResult {
  success: boolean;
  error?: string;
}

export interface VisibilityResult {
  success: boolean;
  visibility?: string;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

// Re-export for consumers (and tests) that import getOracleBridgeUrl from this module
export { getOracleBridgeUrl } from '@/utils/oracleBridge';

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
 * Map oracle-bridge snake_case DirectoryEntry to MemberProfile (camelCase).
 */
function mapDirectoryEntry(entry: DirectoryEntryResponse): MemberProfile {
  return {
    principal: entry.principal,
    displayName: entry.display_name || 'Anonymous Member',
    avatar: entry.avatar ?? undefined,
    archetype: entry.archetype,
    bio: entry.bio ?? undefined,
    joinDate: entry.join_date,
    isActive: entry.is_active,
  };
}

// ============================================================================
// Public API — Oracle-Bridge Fetch Functions
// ============================================================================

/**
 * Fetch visible members from oracle-bridge (paginated, with optional search).
 * Oracle-bridge pages are 1-indexed. The store uses 0-indexed pages internally,
 * so we convert: store page 0 = API page 1.
 */
export async function fetchMembers(
  page: number = 1,
  pageSize: number = MEMBERS_PER_PAGE,
  search?: string
): Promise<FetchMembersResult> {
  const baseUrl = getOracleBridgeUrl();
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (search && search.trim()) {
    params.set('search', search.trim());
  }

  const url = `${baseUrl}/api/members/directory?${params.toString()}`;
  log('info', 'Fetching members from oracle-bridge', { url, page, pageSize, search });

  try {
    const response = await fetch(url, { credentials: 'include' });

    if (response.status === 401) {
      return { success: false, error: 'Authentication required' };
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Server error: ${response.status} ${text}` };
    }

    const data: DirectoryResponse = await response.json();
    const members = data.entries.map(mapDirectoryEntry);

    return {
      success: true,
      members,
      totalCount: data.total_count,
      hasMore: data.has_more,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to fetch members', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch a single member profile by principal.
 */
export async function fetchMemberProfile(principal: string): Promise<FetchMemberProfileResult> {
  const baseUrl = getOracleBridgeUrl();
  const url = `${baseUrl}/api/members/profile/${encodeURIComponent(principal)}`;
  log('info', 'Fetching member profile', { principal });

  try {
    const response = await fetch(url, { credentials: 'include' });

    if (response.status === 404) {
      return { success: false, error: 'Member not found' };
    }

    if (response.status === 401) {
      return { success: false, error: 'Authentication required' };
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Server error: ${response.status} ${text}` };
    }

    const data: DirectoryEntryResponse = await response.json();
    return { success: true, member: mapDirectoryEntry(data) };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to fetch member profile', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Update own profile via oracle-bridge.
 */
export async function updateOwnProfile(data: UpdateProfileData): Promise<UpdateProfileResult> {
  const baseUrl = getOracleBridgeUrl();
  const url = `${baseUrl}/api/members/profile`;
  log('info', 'Updating own profile', { data });

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (response.status === 401) {
      return { success: false, error: 'Authentication required' };
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Server error: ${response.status} ${text}` };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to update profile', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Get own visibility setting from oracle-bridge.
 */
export async function getOwnVisibility(): Promise<VisibilityResult> {
  const baseUrl = getOracleBridgeUrl();
  const url = `${baseUrl}/api/members/visibility`;
  log('info', 'Fetching own visibility');

  try {
    const response = await fetch(url, { credentials: 'include' });

    if (response.status === 401) {
      return { success: false, error: 'Authentication required' };
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Server error: ${response.status} ${text}` };
    }

    const data: VisibilityResponse = await response.json();
    return { success: true, visibility: data.visibility };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to fetch visibility', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Set own visibility via oracle-bridge.
 */
export async function setOwnVisibility(
  visibility: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getOracleBridgeUrl();
  const url = `${baseUrl}/api/members/visibility`;
  log('info', 'Setting own visibility', { visibility });

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visibility }),
    });

    if (response.status === 401) {
      return { success: false, error: 'Authentication required' };
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Server error: ${response.status} ${text}` };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log('error', 'Failed to set visibility', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
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
  /** Current page (0-indexed internally) */
  currentPage: number;
  /** Total pages */
  totalPages: number;
  /** Whether there are more pages (from oracle-bridge has_more) */
  hasMore: boolean;
  /** Is loading state */
  isLoading: boolean;
  /** Is refreshing (loading after initial fetch) */
  isRefreshing: boolean;
  /** Refresh member data */
  refresh: () => Promise<void>;
  /** Go to specific page (0-indexed) */
  goToPage: (page: number) => Promise<void>;
  /** Go to next page */
  nextPage: () => Promise<void>;
  /** Go to previous page */
  prevPage: () => Promise<void>;
  /** Set search query (debounced, triggers server-side search) */
  setSearch: (query: string) => void;
  /** Clear search */
  clearSearch: () => void;
  /** Select a member for detail view */
  selectMember: (member: MemberProfile | null) => void;
  /** Clear all member data */
  clear: () => void;
}

/**
 * Hook for member directory component integration.
 * Fetches data from oracle-bridge API with pagination and search.
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

  // Local state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Debounce timeout ref for search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track if initial fetch has been done
  const initialFetchDone = useRef(false);

  /**
   * Load members for a given page with current search query.
   * Converts 0-indexed store page to 1-indexed API page.
   */
  const loadMembers = useCallback(
    async (storePage: number = 0, isRefresh: boolean = false, search?: string) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setMemberLoading(true);
      }

      const apiPage = storePage + 1; // oracle-bridge is 1-indexed
      log('info', 'Loading members', { storePage, apiPage, isRefresh, search });

      try {
        const result = await fetchMembers(apiPage, MEMBERS_PER_PAGE, search);

        if (result.success && result.members) {
          setMembers(result.members, result.totalCount);
          setCurrentPage(storePage);
          setHasMore(result.hasMore ?? false);
          log('info', 'Members loaded successfully', {
            count: result.members.length,
            totalCount: result.totalCount,
            storePage,
          });
        } else {
          setMemberError(result.error || 'Failed to fetch members');
          log('error', 'Failed to load members', { error: result.error });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setMemberError(errorMessage);
        log('error', 'Exception during member load', { error: errorMessage });
      } finally {
        if (isRefresh) {
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  /**
   * Refresh member data (resets to page 0)
   */
  const refresh = useCallback(async () => {
    const currentSearch = $memberSearchQuery.get();
    await loadMembers(0, true, currentSearch || undefined);
  }, [loadMembers]);

  /**
   * Go to specific page (0-indexed)
   */
  const goToPage = useCallback(
    async (page: number) => {
      if (page >= 0 && page < totalPagesValue) {
        const currentSearch = $memberSearchQuery.get();
        await loadMembers(page, false, currentSearch || undefined);
      }
    },
    [loadMembers, totalPagesValue]
  );

  /**
   * Go to next page
   * Uses hasMore as the authoritative signal when available, falling back to totalPages.
   * This prevents the Next button being enabled (via hasMore) while the guard silently
   * blocks navigation (via totalPages-only check).
   */
  const nextPage = useCallback(async () => {
    // hasMore from oracle-bridge is authoritative: if it says there's more, trust it.
    const canGoNext = hasMore || currentPageValue < totalPagesValue - 1;
    if (canGoNext) {
      const currentSearch = $memberSearchQuery.get();
      await loadMembers(currentPageValue + 1, false, currentSearch || undefined);
    }
  }, [loadMembers, currentPageValue, totalPagesValue, hasMore]);

  /**
   * Go to previous page
   */
  const prevPage = useCallback(async () => {
    if (currentPageValue > 0) {
      const currentSearch = $memberSearchQuery.get();
      await loadMembers(currentPageValue - 1, false, currentSearch || undefined);
    }
  }, [loadMembers, currentPageValue]);

  /**
   * Set search query with debounce.
   * After debounce, triggers a server-side fetch with the search param.
   */
  const setSearch = useCallback(
    (query: string) => {
      // Cancel previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Debounce the search (300ms)
      searchTimeoutRef.current = setTimeout(() => {
        setMemberSearchQuery(query);
        // Trigger server-side search by reloading page 0
        loadMembers(0, false, query || undefined);
      }, SEARCH_DEBOUNCE_MS);
    },
    [loadMembers]
  );

  /**
   * Clear search
   */
  const clearSearchHandler = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setMemberSearchQuery('');
    // Reload without search
    loadMembers(0, false, undefined);
  }, [loadMembers]);

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
        loadMembers(0);
      }
    }
  }, [autoFetch, refetchIfStale, memberState.lastUpdated, loadMembers]);

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
    hasMore,
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
