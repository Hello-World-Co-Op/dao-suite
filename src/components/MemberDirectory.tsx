/**
 * Member Directory Component
 *
 * Displays a directory of DAO members who have opted into visibility.
 * Includes search, pagination, member cards, and profile detail view.
 * Data is fetched from oracle-bridge API endpoints.
 *
 * Story: 9-3-1-member-directory, BL-021.2
 * ACs: 1, 2, 3, 4, 5, 6, 7, 8
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Users,
  AlertCircle,
  HelpCircle,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Shield,
} from 'lucide-react';
import {
  formatMemberSince,
  getArchetypeColor,
  type MemberProfile,
} from '@/stores';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { useMemberDirectory } from '../services/memberService';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Loading Skeleton
// ============================================================================

function MemberSkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-6">
      {/* Search skeleton */}
      <div className="h-10 bg-gray-200 rounded-lg w-full max-w-md" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg" />
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex justify-center gap-2">
        <div className="h-10 w-24 bg-gray-200 rounded-md" />
        <div className="h-10 w-20 bg-gray-200 rounded-md" />
        <div className="h-10 w-24 bg-gray-200 rounded-md" />
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}

function ErrorState({ error, onRetry, isRetrying }: ErrorStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-10 w-10 text-red-500 mb-3" aria-hidden="true" />
      <p className="text-red-600 font-medium mb-2">Failed to load member directory</p>
      <p className="text-gray-500 text-sm mb-4">{error}</p>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="
            inline-flex items-center gap-2 px-4 py-2
            text-sm font-medium text-white
            bg-teal-600 hover:bg-teal-700
            rounded-md
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
            transition-colors duration-150
          "
        >
          <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : 'Retry'}
        </button>
        <a
          href="mailto:support@helloworlddao.com?subject=Member%20Directory%20Issue"
          className="
            inline-flex items-center gap-2 px-4 py-2
            text-sm font-medium text-gray-700
            bg-gray-100 hover:bg-gray-200
            rounded-md
            focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
            transition-colors duration-150
          "
        >
          <HelpCircle className="h-4 w-4" />
          Get Help
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  isSearchEmpty?: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
}

function EmptyState({
  isSearchEmpty,
  searchQuery,
  onClearSearch,
}: EmptyStateProps): React.ReactElement {
  if (isSearchEmpty && searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No members found</h3>
        <p className="text-gray-500 text-sm mb-4">
          No members match your search for &quot;{searchQuery}&quot;
        </p>
        {onClearSearch && (
          <button
            onClick={onClearSearch}
            className="
              inline-flex items-center gap-2 px-4 py-2
              text-sm font-medium text-teal-600
              bg-teal-50 hover:bg-teal-100
              rounded-md
              focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
              transition-colors duration-150
            "
          >
            <X className="h-4 w-4" />
            Clear Search
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users className="h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No members in directory</h3>
      <p className="text-gray-500 text-sm max-w-md">
        No members have opted into the member directory yet. Members can choose to make their
        profile visible in their settings.
      </p>
    </div>
  );
}

// ============================================================================
// Search Input
// ============================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search members...',
}: SearchInputProps): React.ReactElement {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value with prop
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleClear = () => {
    setLocalValue('');
    onClear();
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-md">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-10 py-2
          text-sm
          border border-gray-300 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500
          placeholder:text-gray-400
        "
        aria-label="Search members"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="
            absolute right-3 top-1/2 -translate-y-1/2
            p-1 rounded-full
            text-gray-400 hover:text-gray-600 hover:bg-gray-100
            focus:outline-none focus:ring-2 focus:ring-teal-500
          "
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Pagination Controls
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

function Pagination({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  hasMore,
  isLoading,
}: PaginationProps): React.ReactElement {
  if (totalPages <= 1) return <></>;

  // Use hasMore from oracle-bridge if available, otherwise fall back to page calculation
  const isNextDisabled = hasMore !== undefined ? !hasMore : currentPage >= totalPages - 1;

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <button
        onClick={onPrevPage}
        disabled={currentPage === 0 || isLoading}
        className="
          inline-flex items-center gap-1 px-3 py-2
          text-sm font-medium
          text-gray-700 bg-white border border-gray-300
          rounded-md
          hover:bg-gray-50
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
        "
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </button>

      <span className="px-4 py-2 text-sm text-gray-600">
        Page {currentPage + 1} of {totalPages}
      </span>

      <button
        onClick={onNextPage}
        disabled={isNextDisabled || isLoading}
        className="
          inline-flex items-center gap-1 px-3 py-2
          text-sm font-medium
          text-gray-700 bg-white border border-gray-300
          rounded-md
          hover:bg-gray-50
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
        "
        aria-label="Next page"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

// ============================================================================
// Bio Snippet Helper
// ============================================================================

/**
 * Truncate bio to maxLength characters, appending "..." if truncated.
 */
function truncateBio(bio: string | undefined, maxLength: number = 80): string | null {
  if (!bio) return null;
  if (bio.length <= maxLength) return bio;
  return bio.substring(0, maxLength) + '...';
}

// ============================================================================
// Member Card
// ============================================================================

interface MemberCardProps {
  member: MemberProfile;
  isCurrentUser?: boolean;
}

function MemberCard({
  member,
  isCurrentUser,
}: MemberCardProps): React.ReactElement {
  const archetypeColorClass = member.archetype ? getArchetypeColor(member.archetype) : '';
  const bioSnippet = truncateBio(member.bio, 80);

  return (
    <Link
      to={`/members/${member.principal}`}
      className="
        block w-full p-4 text-left
        bg-white border border-gray-200 rounded-lg
        hover:border-teal-300 hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
        transition-all duration-150
      "
    >
      {/* Header with avatar and name */}
      <div className="flex items-start gap-3 mb-3">
        <MemberAvatar displayName={member.displayName} avatar={member.avatar} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {member.displayName}
            {isCurrentUser && (
              <span className="ml-2 text-xs font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">You</span>
            )}
          </h3>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatMemberSince(member.joinDate)}
          </p>
        </div>
      </div>

      {/* Archetype badge */}
      {member.archetype && (
        <span
          className={`
          inline-flex items-center gap-1 px-2 py-1 mb-2
          text-xs font-medium rounded-full
          ${archetypeColorClass}
        `}
        >
          <Shield className="h-3 w-3" />
          {member.archetype}
        </span>
      )}

      {/* Bio snippet (truncated at 80 chars) */}
      {bioSnippet && <p className="text-sm text-gray-600 line-clamp-2 mb-2">{bioSnippet}</p>}
    </Link>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface MemberDirectoryProps {
  /** Current user's IC principal (for identifying own profile via "You" badge) */
  userPrincipal?: string;
  /** Additional CSS class */
  className?: string;
}

export function MemberDirectory({
  userPrincipal,
  className = '',
}: MemberDirectoryProps): React.ReactElement {
  // Member directory hook
  const {
    memberState,
    filteredMembers,
    searchQuery,
    currentPage,
    totalPages,
    hasMore,
    isLoading,
    isRefreshing,
    refresh,
    nextPage,
    prevPage,
    setSearch,
    clearSearch,
  } = useMemberDirectory();

  // Track when component loads
  const hasTrackedLoad = useRef(false);
  useEffect(() => {
    if (!hasTrackedLoad.current && memberState.lastUpdated) {
      hasTrackedLoad.current = true;
      trackEvent('member_directory_loaded', {
        member_count: memberState.totalCount,
        page_count: totalPages,
      });
    }
  }, [memberState.lastUpdated, memberState.totalCount, totalPages]);

  // Track search
  const searchTrackedRef = useRef<string>('');
  useEffect(() => {
    if (searchQuery && searchQuery !== searchTrackedRef.current) {
      searchTrackedRef.current = searchQuery;
      trackEvent('member_search_performed', {
        query_length: searchQuery.length,
        result_count: filteredMembers.length,
      });
    }
  }, [searchQuery, filteredMembers.length]);

  // Loading state
  if (isLoading && !memberState.lastUpdated) {
    return (
      <div className={`member-directory ${className}`}>
        <MemberSkeleton />
      </div>
    );
  }

  // Error state
  if (memberState.error && !memberState.lastUpdated) {
    return (
      <div className={`member-directory ${className}`}>
        <ErrorState error={memberState.error} onRetry={refresh} isRetrying={isRefreshing} />
      </div>
    );
  }

  // Empty state (no members at all)
  if (!memberState.members.length && !searchQuery) {
    return (
      <div className={`member-directory ${className}`}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={`member-directory ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-600" />
            Member Directory
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {memberState.totalCount} member{memberState.totalCount !== 1 ? 's' : ''} in directory
          </p>
        </div>

        {/* Refresh button */}
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="
            inline-flex items-center gap-2 px-4 py-2
            text-sm font-medium text-gray-700
            bg-white border border-gray-300
            rounded-md
            hover:bg-gray-50
            disabled:opacity-50
            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
            transition-colors duration-150
          "
          aria-label="Refresh member list"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchInput
          value={searchQuery}
          onChange={setSearch}
          onClear={clearSearch}
          placeholder="Search by name, archetype, or bio..."
        />
      </div>

      {/* Inline error banner for post-initial-load errors (pagination/search failures) */}
      {memberState.error && memberState.lastUpdated && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1">{memberState.error}</span>
          <button
            onClick={refresh}
            className="font-medium underline hover:no-underline focus:outline-none"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search empty state */}
      {searchQuery && filteredMembers.length === 0 ? (
        <EmptyState isSearchEmpty searchQuery={searchQuery} onClearSearch={clearSearch} />
      ) : (
        <>
          {/* Member grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.principal}
                member={member}
                isCurrentUser={userPrincipal != null && member.principal === userPrincipal}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPrevPage={prevPage}
            onNextPage={nextPage}
            hasMore={hasMore}
            isLoading={isLoading}
          />
        </>
      )}

    </div>
  );
}

export default MemberDirectory;
