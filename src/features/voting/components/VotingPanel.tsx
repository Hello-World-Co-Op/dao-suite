/**
 * VotingPanel Component
 *
 * Displays vote buttons (Yes/No/Abstain) with confirmation dialog.
 * Handles member verification and vote submission states.
 *
 * Story: 9-1-2-voting-interface
 * ACs: 2, 5, 6, 7, 8
 */

import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import type { VoteChoice, UserVote } from '@/stores';

export interface VotingPanelProps {
  proposalId: string;
  proposalTitle: string;
  votingEndsAt: number;
  isActive: boolean;
  userVote?: UserVote | null;
  isMember: boolean;
  isSubmitting?: boolean;
  onVote: (vote: VoteChoice) => Promise<void>;
}

interface ConfirmDialogState {
  isOpen: boolean;
  selectedVote: VoteChoice | null;
}

export function VotingPanel({
  proposalId: _proposalId,
  proposalTitle,
  votingEndsAt,
  isActive,
  userVote,
  isMember,
  isSubmitting = false,
  onVote,
}: VotingPanelProps) {
  const navigate = useNavigate();
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    selectedVote: null,
  });
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const lastFocusedButtonRef = useRef<HTMLButtonElement | null>(null);

  const hasVoted = !!userVote;
  const isVotingClosed = Date.now() > votingEndsAt;
  const canVote = isMember && isActive && !hasVoted && !isVotingClosed;
  const submitting = isSubmitting || localSubmitting;

  // Calculate time remaining for deadline warning
  const timeRemaining = votingEndsAt - Date.now();
  const showDeadlineWarning = timeRemaining > 0 && timeRemaining < 30000; // < 30 seconds

  const handleVoteClick = useCallback(
    (vote: VoteChoice, buttonRef: React.RefObject<HTMLButtonElement | null>) => {
      if (!canVote || submitting) return;

      lastFocusedButtonRef.current = buttonRef.current;
      setConfirmDialog({ isOpen: true, selectedVote: vote });
    },
    [canVote, submitting]
  );

  const handleConfirm = useCallback(async () => {
    if (!confirmDialog.selectedVote) return;

    setLocalSubmitting(true);
    setConfirmDialog({ isOpen: false, selectedVote: null });

    try {
      await onVote(confirmDialog.selectedVote);
    } finally {
      setLocalSubmitting(false);
      // Return focus to the button that was clicked
      if (lastFocusedButtonRef.current) {
        lastFocusedButtonRef.current.focus();
      }
    }
  }, [confirmDialog.selectedVote, onVote]);

  const handleCancel = useCallback(() => {
    setConfirmDialog({ isOpen: false, selectedVote: null });
    // Return focus to the button that was clicked
    if (lastFocusedButtonRef.current) {
      lastFocusedButtonRef.current.focus();
    }
  }, []);

  const getVoteLabel = (vote: VoteChoice): string => {
    switch (vote) {
      case 'yes':
        return 'Yes';
      case 'no':
        return 'No';
      case 'abstain':
        return 'Abstain';
    }
  };

  // Refs for each button
  const yesButtonRef = useRef<HTMLButtonElement>(null);
  const noButtonRef = useRef<HTMLButtonElement>(null);
  const abstainButtonRef = useRef<HTMLButtonElement>(null);

  // Non-member state
  if (!isMember) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-gray-600 mb-4">Membership required to vote on proposals.</p>
        <Button onClick={() => navigate('/membership')} className="min-h-[44px] min-w-[120px]">
          Join to Vote
        </Button>
      </div>
    );
  }

  // Already voted state
  if (hasVoted && userVote) {
    return (
      <div className="rounded-lg border border-teal-200 bg-teal-50 p-6">
        <div className="flex items-center gap-2 text-teal-700">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">You voted {getVoteLabel(userVote.vote)}</span>
        </div>
        <p className="mt-2 text-sm text-teal-600">Votes are final and cannot be changed.</p>
        {userVote.transactionId && (
          <p className="mt-1 text-xs text-teal-500 font-mono">
            Transaction: {userVote.transactionId}
          </p>
        )}
      </div>
    );
  }

  // Voting closed state
  if (isVotingClosed) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-gray-600">Voting has ended for this proposal.</p>
      </div>
    );
  }

  // Submitting state
  if (submitting) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <div className="flex items-center justify-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-blue-700 font-medium">Submitting your vote...</span>
        </div>
        <p className="mt-2 text-sm text-blue-600 text-center">
          Please wait while your vote is being recorded on-chain.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Vote Buttons */}
      <div className="rounded-lg border border-gray-200 p-6">
        <h3 className="font-medium text-gray-900 mb-4">Cast Your Vote</h3>

        <div className="flex flex-wrap gap-3" role="group" aria-label="Vote options">
          <Button
            ref={yesButtonRef}
            onClick={() => handleVoteClick('yes', yesButtonRef)}
            disabled={!canVote}
            className="min-h-[44px] min-w-[100px] bg-green-600 hover:bg-green-700 text-white"
            aria-label={`Vote Yes on ${proposalTitle}`}
          >
            Yes
          </Button>

          <Button
            ref={noButtonRef}
            onClick={() => handleVoteClick('no', noButtonRef)}
            disabled={!canVote}
            className="min-h-[44px] min-w-[100px] bg-red-600 hover:bg-red-700 text-white"
            aria-label={`Vote No on ${proposalTitle}`}
          >
            No
          </Button>

          <div className="relative group">
            <Button
              ref={abstainButtonRef}
              onClick={() => handleVoteClick('abstain', abstainButtonRef)}
              disabled={!canVote}
              variant="outline"
              className="min-h-[44px] min-w-[100px]"
              aria-label={`Vote Abstain on ${proposalTitle}`}
              aria-describedby="abstain-tooltip"
            >
              Abstain
            </Button>
            {/* Tooltip for Abstain */}
            <div
              id="abstain-tooltip"
              role="tooltip"
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
            >
              Abstain counts toward quorum but not for or against the proposal.
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && confirmDialog.selectedVote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 id="confirm-dialog-title" className="text-xl font-bold text-gray-900 mb-4">
              Confirm Your Vote
            </h2>

            <p className="text-gray-700 mb-2">
              Vote <span className="font-semibold">{getVoteLabel(confirmDialog.selectedVote)}</span>{' '}
              on:
            </p>
            <p className="text-gray-900 font-medium mb-4">"{proposalTitle}"</p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-amber-800 text-sm font-medium">This action cannot be undone.</p>
              <p className="text-amber-700 text-sm mt-1">
                Votes are final and cannot be changed once submitted.
              </p>
            </div>

            {showDeadlineWarning && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-red-800 text-sm font-medium flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Voting ends in {Math.ceil(timeRemaining / 1000)} seconds!
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={handleCancel} className="min-h-[44px]">
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                className="min-h-[44px] bg-teal-600 hover:bg-teal-700 text-white"
              >
                Confirm Vote
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default VotingPanel;
