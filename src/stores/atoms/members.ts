/**
 * Member Directory State Management
 *
 * Manages member directory state using nanostores.
 * Follows the escrow.ts pattern for state management.
 *
 * Story: 9-3-1-member-directory
 * ACs: 1, 2, 3
 *
 * NOTE: Membership canister lacks display name, avatar, archetype, and visibility
 * fields. This implementation uses mock data until canister is extended.
 */

import { atom, computed } from 'nanostores';

// ============================================================================
// Types
// ============================================================================

/**
 * Member visibility setting
 */
export type Visibility = 'public' | 'members-only' | 'private';

/**
 * Member archetype - evolves through Otter Camp gameplay based on member actions.
 * NOT user-selected; reflects how the member engages with the DAO.
 * - Builder: Creates and contributes to projects
 * - Guardian: Focuses on security and protection
 * - Visionary: Proposes ideas and future direction
 * - Connector: Bridges communities and facilitates collaboration
 * - Steward: Manages resources and governance
 */
export type Archetype = 'Builder' | 'Guardian' | 'Visionary' | 'Connector' | 'Steward';

/**
 * Member profile (extended beyond canister data for directory)
 */
export interface MemberProfile {
  /** Member's principal ID */
  principal: string;
  /** Display name (not in canister yet) */
  displayName: string;
  /** Avatar URL (not in canister yet) */
  avatar?: string;
  /** Join date timestamp in nanoseconds */
  memberSince: bigint;
  /** Member archetype - evolves through Otter Camp gameplay (not user-selected) */
  archetype?: Archetype;
  /** Visibility setting (not in canister yet) */
  visibility: Visibility;
  /** Whether membership is currently active */
  isActive: boolean;
  /** Bio/description (not in canister yet) */
  bio?: string;
}

/**
 * Contact request status
 */
export type ContactStatus = 'pending' | 'approved' | 'rejected';

/**
 * Contact request between members
 */
export interface ContactRequest {
  /** Request ID */
  id: string;
  /** Sender principal */
  from: string;
  /** Recipient principal */
  to: string;
  /** Initial message */
  message: string;
  /** Request status */
  status: ContactStatus;
  /** Created timestamp in nanoseconds */
  createdAt: bigint;
  /** Response timestamp in nanoseconds */
  respondedAt?: bigint;
}

/**
 * Member directory state with loading/error handling
 */
export interface MemberDirectoryState {
  /** List of visible members */
  members: MemberProfile[];
  /** Last successful fetch timestamp */
  lastUpdated: number | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Current page (0-indexed) */
  currentPage: number;
  /** Total count of visible members */
  totalCount: number;
}

/**
 * Pagination configuration
 */
export const MEMBERS_PER_PAGE = 20;

/**
 * Stale threshold for member data (2 minutes)
 */
export const MEMBER_STALE_THRESHOLD_MS = 2 * 60 * 1000;

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_MEMBER_STATE: MemberDirectoryState = {
  members: [],
  lastUpdated: null,
  isLoading: false,
  error: null,
  currentPage: 0,
  totalCount: 0,
};

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Main member directory state store
 */
export const $memberDirectory = atom<MemberDirectoryState>({ ...INITIAL_MEMBER_STATE });

/**
 * Selected member for profile view
 */
export const $selectedMember = atom<MemberProfile | null>(null);

/**
 * Current search query
 */
export const $memberSearchQuery = atom<string>('');

/**
 * Current user's visibility setting
 */
export const $userVisibility = atom<Visibility>('private');

// ============================================================================
// Computed Atoms
// ============================================================================

/**
 * Loading state convenience atom
 */
export const $memberLoading = computed($memberDirectory, (state) => state.isLoading);

/**
 * Error state convenience atom
 */
export const $memberError = computed($memberDirectory, (state) => state.error);

/**
 * Has member data been fetched
 */
export const $hasMemberData = computed($memberDirectory, (state) => state.lastUpdated !== null);

/**
 * All members list
 */
export const $allMembers = computed($memberDirectory, (state) => state.members);

/**
 * Total member count
 */
export const $memberCount = computed($memberDirectory, (state) => state.totalCount);

/**
 * Current page
 */
export const $currentPage = computed($memberDirectory, (state) => state.currentPage);

/**
 * Total pages
 */
export const $totalPages = computed($memberDirectory, (state) =>
  Math.ceil(state.totalCount / MEMBERS_PER_PAGE)
);

/**
 * Filtered members based on search query
 */
export const $filteredMembers = computed(
  [$memberDirectory, $memberSearchQuery],
  (state, query) => {
    if (!query.trim()) {
      return state.members;
    }
    const lowerQuery = query.toLowerCase().trim();
    return state.members.filter(
      (member) =>
        member.displayName.toLowerCase().includes(lowerQuery) ||
        member.archetype?.toLowerCase().includes(lowerQuery) ||
        member.bio?.toLowerCase().includes(lowerQuery)
    );
  }
);

/**
 * Filtered member count
 */
export const $filteredMemberCount = computed($filteredMembers, (members) => members.length);

/**
 * Members grouped by archetype for summary
 */
export const $membersByArchetype = computed($memberDirectory, (state) => {
  const grouped: Record<Archetype | 'None', MemberProfile[]> = {
    Builder: [],
    Guardian: [],
    Visionary: [],
    Connector: [],
    Steward: [],
    None: [],
  };
  state.members.forEach((m) => {
    const key = m.archetype || 'None';
    grouped[key].push(m);
  });
  return grouped;
});

/**
 * Archetype counts for filter badges
 */
export const $archetypeCounts = computed($membersByArchetype, (grouped) => ({
  All: Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0),
  Builder: grouped.Builder.length,
  Guardian: grouped.Guardian.length,
  Visionary: grouped.Visionary.length,
  Connector: grouped.Connector.length,
  Steward: grouped.Steward.length,
  None: grouped.None.length,
}));

// ============================================================================
// Actions - Member Directory
// ============================================================================

/**
 * Set loading state for member fetch
 */
export function setMemberLoading(isLoading: boolean): void {
  const current = $memberDirectory.get();
  $memberDirectory.set({
    ...current,
    isLoading,
    error: isLoading ? null : current.error,
  });
}

/**
 * Set members after successful fetch
 * @param members - List of visible members
 * @param totalCount - Total count of members (for pagination)
 */
export function setMembers(members: MemberProfile[], totalCount?: number): void {
  $memberDirectory.set({
    members,
    lastUpdated: Date.now(),
    isLoading: false,
    error: null,
    currentPage: $memberDirectory.get().currentPage,
    totalCount: totalCount ?? members.length,
  });
}

/**
 * Set error state after failed member fetch
 * @param error - Error message
 */
export function setMemberError(error: string): void {
  const current = $memberDirectory.get();
  $memberDirectory.set({
    ...current,
    isLoading: false,
    error,
  });
}

/**
 * Set current page
 * @param page - Page number (0-indexed)
 */
export function setCurrentPage(page: number): void {
  const current = $memberDirectory.get();
  $memberDirectory.set({
    ...current,
    currentPage: page,
  });
}

/**
 * Clear member directory state
 */
export function clearMembers(): void {
  $memberDirectory.set({ ...INITIAL_MEMBER_STATE });
  $selectedMember.set(null);
  $memberSearchQuery.set('');
}

/**
 * Set selected member for profile view
 * @param member - Member to select or null to clear
 */
export function setSelectedMember(member: MemberProfile | null): void {
  $selectedMember.set(member);
}

/**
 * Set search query
 * @param query - Search string
 */
export function setMemberSearchQuery(query: string): void {
  $memberSearchQuery.set(query);
}

/**
 * Clear search query
 */
export function clearMemberSearch(): void {
  $memberSearchQuery.set('');
}

/**
 * Set user's visibility preference
 * @param visibility - New visibility setting
 */
export function setUserVisibility(visibility: Visibility): void {
  $userVisibility.set(visibility);
}

/**
 * Check if member data is stale
 * @param thresholdMs - Stale threshold in milliseconds
 */
export function isMemberDataStale(thresholdMs: number = MEMBER_STALE_THRESHOLD_MS): boolean {
  const state = $memberDirectory.get();
  if (!state.lastUpdated) return true;
  return Date.now() - state.lastUpdated > thresholdMs;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format member since date
 * @param nanos - Timestamp in nanoseconds
 */
export function formatMemberSince(nanos: bigint): string {
  const millis = Number(nanos / BigInt(1_000_000));
  return new Date(millis).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  });
}

/**
 * Get archetype color for styling
 * @param archetype - Member archetype
 */
export function getArchetypeColor(archetype?: Archetype): string {
  switch (archetype) {
    case 'Builder':
      return 'text-orange-600 bg-orange-100';
    case 'Guardian':
      return 'text-blue-600 bg-blue-100';
    case 'Visionary':
      return 'text-purple-600 bg-purple-100';
    case 'Connector':
      return 'text-green-600 bg-green-100';
    case 'Steward':
      return 'text-teal-600 bg-teal-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Get visibility label
 * @param visibility - Visibility setting
 */
export function getVisibilityLabel(visibility: Visibility): string {
  switch (visibility) {
    case 'public':
      return 'Public';
    case 'members-only':
      return 'Members Only';
    case 'private':
      return 'Private';
    default:
      return 'Unknown';
  }
}

/**
 * Get visibility description
 * @param visibility - Visibility setting
 */
export function getVisibilityDescription(visibility: Visibility): string {
  switch (visibility) {
    case 'public':
      return 'Anyone can see your profile in the directory';
    case 'members-only':
      return 'Only verified DAO members can see your profile';
    case 'private':
      return 'Your profile is hidden from the directory';
    default:
      return '';
  }
}

/**
 * Get contact status color
 * @param status - Contact request status
 */
export function getContactStatusColor(status: ContactStatus): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    case 'approved':
      return 'text-green-600 bg-green-100';
    case 'rejected':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Generate initials from display name for avatar fallback
 * @param displayName - Display name
 */
export function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.substring(0, 2).toUpperCase();
}

// ============================================================================
// Export Actions Object
// ============================================================================

export const memberActions = {
  setLoading: setMemberLoading,
  setMembers,
  setError: setMemberError,
  setPage: setCurrentPage,
  clear: clearMembers,
  setSelected: setSelectedMember,
  setSearch: setMemberSearchQuery,
  clearSearch: clearMemberSearch,
  setVisibility: setUserVisibility,
  isStale: isMemberDataStale,
};
