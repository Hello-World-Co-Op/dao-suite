/**
 * Proposal Detail Page
 *
 * Displays a single proposal with full voting interface.
 * Shows proposal content, voting panel, tally, and countdown.
 *
 * Story: 9-1-1-think-tank-proposal-creation (initial page)
 * Story: 9-1-2-voting-interface (voting enhancements)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { Button } from '../components/ui/button';
import { GovernanceCanisterService, type ProposalStatus } from '../services/governanceCanister';
import { $proposals, type SubmittedProposal, showSuccess, showError } from '@/stores';
import { CanisterUnavailable } from '../components/CanisterUnavailable';
import {
  VotingPanel,
  VoteTally,
  VotingCountdown,
  useVoting,
  useVoteTallyPolling,
} from '../features/voting';

// Status badge configuration
const STATUS_BADGES: Record<string, { text: string; className: string }> = {
  active: { text: 'Voting Open', className: 'bg-green-100 text-green-700' },
  pending: { text: 'Pending Review', className: 'bg-yellow-100 text-yellow-700' },
  passed: { text: 'Passed', className: 'bg-teal-100 text-teal-700' },
  rejected: { text: 'Failed', className: 'bg-red-100 text-red-700' },
  expired: { text: 'Expired', className: 'bg-gray-100 text-gray-700' },
  withdrawn: { text: 'Withdrawn', className: 'bg-gray-100 text-gray-700' },
};

export function ProposalDetailPage() {
  const navigate = useNavigate();
  const { proposalId } = useParams<{ proposalId: string }>();
  const proposals = useStore($proposals);

  const [status, setStatus] = useState<ProposalStatus | null>(null);
  const [proposal, setProposal] = useState<SubmittedProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [forceRefreshTally, setForceRefreshTally] = useState(false);

  // Mock member status (in real app, would check SBT)
  const [isMember] = useState(true);

  // Fetch proposal status and details
  useEffect(() => {
    if (proposalId) {
      setLoading(true);

      // Get proposal from local store
      const storedProposal = proposals[proposalId];
      if (storedProposal) {
        setProposal(storedProposal);
      }

      // Get status from canister
      GovernanceCanisterService.getProposalStatus(proposalId).then((result) => {
        setStatus(result);
        setLoading(false);
      });
    }
  }, [proposalId, proposals]);

  // Voting hook
  const {
    userVote,
    isSubmitting,
    error: voteError,
    castVote,
  } = useVoting({
    proposalId: proposalId ?? '',
    onVoteSuccess: (vote) => {
      // Force refresh tally after successful vote
      setForceRefreshTally(true);
      setTimeout(() => setForceRefreshTally(false), 100);
      showSuccess(
        `Your vote has been recorded. You voted ${vote.vote.charAt(0).toUpperCase() + vote.vote.slice(1)}.`
      );
    },
    onVoteError: (errorMsg) => {
      showError(errorMsg);
    },
    onCrossTabVote: () => {
      // Refresh when vote detected from another tab
      setForceRefreshTally(true);
      setTimeout(() => setForceRefreshTally(false), 100);
    },
  });

  // Vote tally polling
  const {
    tally,
    isLoading: tallyLoading,
    error: tallyError,
    isPaused: tallyPaused,
    retryPolling,
  } = useVoteTallyPolling({
    proposalId: proposalId ?? '',
    enabled: !!proposalId && status?.status === 'active',
    forceRefresh: forceRefreshTally,
  });

  // Handle vote
  const handleVote = useCallback(
    async (vote: 'yes' | 'no' | 'abstain') => {
      await castVote(vote);
    },
    [castVote]
  );

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Proposal Not Found</h1>
          <p className="mt-2 text-gray-600">
            The proposal you're looking for doesn't exist or has been removed.
          </p>
          <Button className="mt-4" onClick={() => navigate('/proposals')}>
            Back to Proposals
          </Button>
        </div>
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[status.status] ?? STATUS_BADGES.pending;
  const isActive = status.status === 'active';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <button onClick={() => navigate('/proposals')} className="hover:text-gray-700">
          Proposals
        </button>
        <span>/</span>
        <span className="text-gray-900">{proposalId?.substring(0, 12)}...</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns on large screens */}
        <div className="lg:col-span-2 space-y-6">
          {/* Proposal Header */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge.className}`}
                >
                  {statusBadge.text}
                </span>
                <h1 className="mt-2 text-2xl font-bold text-gray-900">
                  {proposal?.title ?? `Proposal #${proposalId?.substring(0, 8)}`}
                </h1>
              </div>
            </div>

            {/* Proposal Content */}
            {proposal?.thinkTankOutput ? (
              <div className="mt-6 space-y-6">
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Problem Statement</h2>
                  <p className="text-gray-700">{proposal.thinkTankOutput.problemStatement}</p>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Proposed Solution</h2>
                  <p className="text-gray-700">{proposal.thinkTankOutput.proposedSolution}</p>
                </section>

                {proposal.thinkTankOutput.successMetrics.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">Success Metrics</h2>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      {proposal.thinkTankOutput.successMetrics.map((metric, i) => (
                        <li key={i}>{metric}</li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <div>
                    <span className="font-medium">Scale:</span>{' '}
                    <span className="capitalize">{proposal.scale}</span>
                  </div>
                  <div>
                    <span className="font-medium">Category:</span> {proposal.vertical}
                  </div>
                  <div>
                    <span className="font-medium">Submitted:</span>{' '}
                    {new Date(proposal.submittedAt).toLocaleDateString()}
                  </div>
                </section>
              </div>
            ) : (
              <div className="mt-6 py-8 text-center text-gray-500">
                <p>Proposal details are loading...</p>
              </div>
            )}
          </div>

          {/* Vote Error Message */}
          {voteError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-red-700">{voteError}</p>
            </div>
          )}

          {/* Voting Panel */}
          <VotingPanel
            proposalId={proposalId ?? ''}
            proposalTitle={proposal?.title ?? `Proposal #${proposalId?.substring(0, 8)}`}
            votingEndsAt={status.votingEnds}
            isActive={isActive}
            userVote={userVote}
            isMember={isMember}
            isSubmitting={isSubmitting}
            onVote={handleVote}
          />
        </div>

        {/* Sidebar - 1 column on large screens */}
        <div className="space-y-6">
          {/* Countdown Timer */}
          {isActive && (
            <VotingCountdown
              deadline={status.votingEnds}
              onExpired={() => {
                // Refresh status when voting ends
                if (proposalId) {
                  GovernanceCanisterService.getProposalStatus(proposalId).then(setStatus);
                }
              }}
            />
          )}

          {/* Vote Tally */}
          <VoteTally
            tally={tally}
            isLoading={tallyLoading && !tally}
            error={tallyError ?? undefined}
          />

          {/* Canister unavailable banner if polling paused */}
          {tallyPaused && (
            <CanisterUnavailable
              canisterName="Governance"
              onRetry={retryPolling}
              message="Unable to load vote tally. The governance canister may be unavailable."
            />
          )}

          {/* Additional Info */}
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Proposal Info</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Proposal ID</dt>
                <dd className="text-gray-900 font-mono text-xs">
                  {proposalId?.substring(0, 12)}...
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Status</dt>
                <dd className="text-gray-900 capitalize">{status.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Quorum</dt>
                <dd className="text-gray-900">
                  {status.quorumReached ? 'Reached' : 'Not reached'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Voting ends</dt>
                <dd className="text-gray-900">
                  {new Date(status.votingEnds).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProposalDetailPage;
