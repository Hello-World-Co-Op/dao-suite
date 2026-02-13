/**
 * Proposals List Page
 *
 * Displays list of all proposals with filtering, sorting, and search.
 * Entry point to the governance dashboard.
 *
 * Story: 9-1-1-think-tank-proposal-creation (drafts)
 * Story: 9-1-3-proposal-listing (proposal list)
 * Story: 9-1-6-draft-proposal-management (drafts list)
 */

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import {
  $draftsList,
  $userVotedProposalIds,
  initFromUrlParams,
  getUrlParams,
  $proposalFilters,
  $proposalSort,
  $proposalPage,
} from '@/stores';
import { Button } from '../components/ui/button';
import { isAuthenticated } from '../utils/auth';
import { useMembership } from '@/hooks/useMembership';
import {
  ProposalCard,
  ProposalFilters,
  ProposalSort,
  ProposalSearch,
  Pagination,
  DraftsList,
  useProposalList,
} from '../features/proposals';
import { OfflineBanner } from '../components/OfflineBanner';
import { CanisterUnavailable } from '../components/CanisterUnavailable';

// Skeleton loader for proposal cards
function ProposalCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
      </div>
      <div className="flex gap-4 mb-3">
        <div className="h-4 bg-gray-200 rounded w-16"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded w-32"></div>
    </div>
  );
}

// Empty state components
function EmptyStateNoProposals({ isMember }: { isMember: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p className="mt-2 text-gray-900 font-medium">Be the first to create a proposal!</p>
      <p className="text-sm text-gray-500">
        Start a conversation about ideas that matter to the community.
      </p>
      {isMember && (
        <Button onClick={() => navigate('/proposals/create')} className="mt-4">
          Create Proposal
        </Button>
      )}
    </div>
  );
}

function EmptyStateFiltered() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <p className="mt-2 text-gray-900 font-medium">No proposals match your filters</p>
      <p className="text-sm text-gray-500">Try adjusting your filters or search terms.</p>
    </div>
  );
}

function EmptyStateNotVoted() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
      <svg
        className="mx-auto h-12 w-12 text-green-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="mt-2 text-gray-900 font-medium">You've voted on all proposals!</p>
      <p className="text-sm text-gray-500">Great job staying engaged with the community.</p>
    </div>
  );
}

export function ProposalsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const userIsAuthenticated = isAuthenticated();
  const { isActiveMember } = useMembership();
  const drafts = useStore($draftsList);
  const votedProposalIds = useStore($userVotedProposalIds);
  const filters = useStore($proposalFilters);
  const sort = useStore($proposalSort);
  const page = useStore($proposalPage);

  const proposalListRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  // Get proposal list data
  const { proposals, totalCount, isLoading, error, refetch, isPollingPaused } = useProposalList();

  // Initialize filters from URL params on mount (synchronously)
  useEffect(() => {
    if (!isInitializedRef.current) {
      initFromUrlParams(searchParams);
      isInitializedRef.current = true;
    }
  }, [searchParams]);

  // Sync URL params when filters/sort/page change
  useEffect(() => {
    if (!isInitializedRef.current) return;
    const params = getUrlParams();
    const currentParamsString = searchParams.toString();
    const newParamsString = params.toString();
    if (currentParamsString !== newParamsString) {
      setSearchParams(params, { replace: true });
    }
  }, [filters, sort, page, searchParams, setSearchParams]);

  // Focus first proposal card when page changes
  const handlePageChange = useCallback(() => {
    setTimeout(() => {
      const firstCard = proposalListRef.current?.querySelector('[role="article"]') as HTMLElement;
      firstCard?.focus();
    }, 100);
  }, []);

  // Determine which empty state to show
  const emptyState = useMemo(() => {
    if (proposals.length > 0) return null;
    if (isLoading) return null;

    const hasFilters =
      filters.status.length > 0 ||
      filters.myProposals ||
      filters.notVoted ||
      filters.search.length > 0;

    if (filters.notVoted && totalCount === 0) {
      return <EmptyStateNotVoted />;
    }
    if (hasFilters) {
      return <EmptyStateFiltered />;
    }
    return <EmptyStateNoProposals isMember={isActiveMember} />;
  }, [proposals.length, isLoading, filters, totalCount, isActiveMember]);

  // Result count message for aria-live
  const resultMessage = useMemo(() => {
    if (isLoading) return 'Loading proposals...';
    if (proposals.length === 0) return 'No proposals found';
    return `Showing ${proposals.length} of ${totalCount} proposals`;
  }, [proposals.length, totalCount, isLoading]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Offline indicator with reconnection handling */}
      <div className="mb-4">
        <OfflineBanner onReconnect={refetch} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proposals</h1>
          <p className="mt-1 text-gray-600">Browse and vote on governance proposals</p>
        </div>
        {userIsAuthenticated && (
          <div className="relative group">
            <Button
              onClick={() => navigate('/proposals/create')}
              disabled={!isActiveMember}
            >
              Create Proposal
            </Button>
            {!isActiveMember && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Full membership required to create proposals
              </span>
            )}
          </div>
        )}
      </div>

      {/* Drafts Section (only for authenticated users with drafts) */}
      {userIsAuthenticated && drafts.length > 0 && (
        <div className="mb-8">
          <DraftsList showControls={true} />
        </div>
      )}

      {/* Main Content: Filters + Proposals */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar: Filters */}
        <aside className="lg:w-64 flex-shrink-0">
          <ProposalFilters isAuthenticated={userIsAuthenticated} />
        </aside>

        {/* Main: Search, Sort, List, Pagination */}
        <main className="flex-1 min-w-0">
          {/* Search and Sort Row */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <ProposalSearch />
            </div>
            <div className="sm:w-48">
              <ProposalSort />
            </div>
          </div>

          {/* Error State - Show CanisterUnavailable when polling paused */}
          {isPollingPaused && (
            <div className="mb-6">
              <CanisterUnavailable
                canisterName="Governance"
                onRetry={refetch}
                message={
                  error ?? 'Unable to load proposals. The governance canister may be unavailable.'
                }
              />
            </div>
          )}

          {/* Non-critical error (polling still active) */}
          {error && !isPollingPaused && (
            <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
              <p className="text-sm text-yellow-800">{error}</p>
            </div>
          )}

          {/* Aria-live region for screen readers */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {resultMessage}
          </div>

          {/* Proposal List */}
          <div ref={proposalListRef} className="space-y-4 mb-6">
            {isLoading && proposals.length === 0 ? (
              // Show skeleton cards during initial load
              <>
                <ProposalCardSkeleton />
                <ProposalCardSkeleton />
                <ProposalCardSkeleton />
                <ProposalCardSkeleton />
                <ProposalCardSkeleton />
              </>
            ) : proposals.length > 0 ? (
              proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  hasVoted={votedProposalIds.has(proposal.id)}
                />
              ))
            ) : (
              emptyState
            )}
          </div>

          {/* Pagination */}
          {totalCount > 0 && <Pagination onPageChange={handlePageChange} />}
        </main>
      </div>
    </div>
  );
}

export default ProposalsPage;
