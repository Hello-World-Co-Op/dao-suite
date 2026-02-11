/**
 * ProposalCard Component
 *
 * Displays a proposal summary card with title, status badge, vote counts,
 * deadline countdown, and voted indicator.
 *
 * Story: 9-1-3-proposal-listing
 * ACs: 1, 6, 7
 */

import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProposalListItem, ProposalStatus } from '@/stores';

export interface ProposalCardProps {
  proposal: ProposalListItem;
  hasVoted?: boolean;
  onNavigate?: (proposalId: string) => void;
}

/**
 * Get status badge styling based on proposal status
 */
function getStatusBadge(status: ProposalStatus): { color: string; text: string; bgColor: string } {
  switch (status) {
    case 'Active':
      return { color: 'text-green-700', text: 'Voting Open', bgColor: 'bg-green-100' };
    case 'Pending':
      return { color: 'text-yellow-700', text: 'Pending Review', bgColor: 'bg-yellow-100' };
    case 'Passed':
      return { color: 'text-teal-700', text: 'Passed', bgColor: 'bg-teal-100' };
    case 'Failed':
      return { color: 'text-red-700', text: 'Failed', bgColor: 'bg-red-100' };
    default:
      return { color: 'text-gray-700', text: status, bgColor: 'bg-gray-100' };
  }
}

/**
 * Format deadline countdown or "Voting Ended"
 */
function formatDeadline(votingEndsAt: number | undefined | null): string {
  if (votingEndsAt === undefined || votingEndsAt === null || isNaN(votingEndsAt)) {
    return 'Deadline unknown';
  }

  const now = Date.now();
  if (votingEndsAt <= now) {
    return 'Voting Ended';
  }

  const diff = votingEndsAt - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  } else {
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m remaining`;
  }
}

export function ProposalCard({ proposal, hasVoted = false, onNavigate }: ProposalCardProps) {
  const navigate = useNavigate();

  // Defensive defaults for proposal fields
  const title = proposal?.title || 'Untitled Proposal';
  const status = proposal?.status || 'Pending';
  const votesFor = proposal?.votesFor ?? 0;
  const votesAgainst = proposal?.votesAgainst ?? 0;
  const votesAbstain = proposal?.votesAbstain ?? 0;
  const votingEndsAt = proposal?.votingEndsAt;
  const proposalId = proposal?.id || '';

  const statusBadge = useMemo(() => getStatusBadge(status), [status]);
  const deadline = useMemo(() => formatDeadline(votingEndsAt), [votingEndsAt]);

  // Calculate isEndingSoon - time-sensitive calculation, updated via 30s polling
  const isEndingSoon = (() => {
    if (!votingEndsAt) return false;
    const now = Date.now();
    if (votingEndsAt <= now) return false;
    const hoursRemaining = (votingEndsAt - now) / (1000 * 60 * 60);
    return hoursRemaining < 24;
  })();

  const handleClick = useCallback(() => {
    if (onNavigate) {
      onNavigate(proposalId);
    } else {
      navigate(`/proposals/${proposalId}`);
    }
  }, [navigate, proposalId, onNavigate]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <article
      role="article"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      aria-label={`Proposal: ${title}. Status: ${statusBadge.text}. ${hasVoted ? 'You have voted on this proposal.' : ''}`}
    >
      {/* Header: Title and Status Badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-medium text-gray-900 line-clamp-2 flex-1" title={title}>
          {title}
        </h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.bgColor} ${statusBadge.color} whitespace-nowrap`}
        >
          {statusBadge.text}
        </span>
      </div>

      {/* Vote Summary */}
      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
        <span className="flex items-center gap-1">
          <span className="text-green-600 font-medium">{votesFor}</span>
          <span>Yes</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-red-600 font-medium">{votesAgainst}</span>
          <span>No</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-gray-500 font-medium">{votesAbstain}</span>
          <span>Abstain</span>
        </span>
      </div>

      {/* Footer: Deadline and Voted Indicator */}
      <div className="flex items-center justify-between text-sm">
        <span className={`${isEndingSoon ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
          {deadline}
        </span>

        {hasVoted && (
          <span
            className="inline-flex items-center gap-1 text-green-600 font-medium"
            aria-label="You have voted on this proposal"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            You voted
          </span>
        )}
      </div>
    </article>
  );
}

export default ProposalCard;
