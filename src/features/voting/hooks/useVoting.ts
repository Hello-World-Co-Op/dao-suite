/**
 * useVoting Hook
 *
 * Manages vote casting logic with confirmation-first UI pattern.
 * Handles SBT verification, pending votes, and cross-tab sync.
 *
 * Story: 9-1-2-voting-interface
 * ACs: 2, 5, 6, 7, 8
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  $userVotes,
  $pendingVotes,
  setUserVote,
  setPendingVote,
  clearPendingVote,
  setupCrossTabSync,
  type VoteChoice,
  type UserVote,
} from '@/stores';
import {
  castVote as castVoteService,
  getUserVote as getUserVoteService,
  verifyVoteStatus,
  type CastVoteResponse,
} from '../../../services/governanceCanister';

export interface UseVotingOptions {
  proposalId: string;
  onVoteSuccess?: (vote: UserVote) => void;
  onVoteError?: (error: string) => void;
  onQuorumReached?: () => void;
  onCrossTabVote?: (vote: UserVote) => void;
}

export interface UseVotingResult {
  userVote: UserVote | null;
  isSubmitting: boolean;
  error: string | null;
  castVote: (vote: VoteChoice) => Promise<boolean>;
  refreshVoteStatus: () => Promise<void>;
}

// Timeout for vote submission
const VOTE_TIMEOUT_MS = 30000; // 30 seconds

export function useVoting({
  proposalId,
  onVoteSuccess,
  onVoteError,
  onQuorumReached: _onQuorumReached,
  onCrossTabVote,
}: UseVotingOptions): UseVotingResult {
  const userVotes = useStore($userVotes);
  const pendingVotes = useStore($pendingVotes);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const submissionRef = useRef<AbortController | null>(null);

  // Get current user vote from store
  const userVote = userVotes[proposalId] ?? null;
  const pendingVote = pendingVotes[proposalId] ?? null;

  // Check for pending votes on mount and verify status
  useEffect(() => {
    if (pendingVote && !userVote) {
      // There's a pending vote but no confirmed vote - verify status
      verifyVoteStatus(proposalId).then((confirmedVote) => {
        if (!mountedRef.current) return;

        if (confirmedVote) {
          // Vote was confirmed on-chain, update local state
          setUserVote(proposalId, confirmedVote);
          clearPendingVote(proposalId);
        } else {
          // Vote wasn't confirmed - clear pending (something went wrong)
          clearPendingVote(proposalId);
        }
      });
    }
  }, [proposalId, pendingVote, userVote]);

  // Fetch initial vote status on mount
  useEffect(() => {
    if (!userVote) {
      getUserVoteService(proposalId).then((vote) => {
        if (vote && mountedRef.current) {
          setUserVote(proposalId, vote);
        }
      });
    }
  }, [proposalId, userVote]);

  // Setup cross-tab synchronization
  useEffect(() => {
    const cleanup = setupCrossTabSync((votedProposalId, vote) => {
      if (votedProposalId === proposalId && mountedRef.current) {
        onCrossTabVote?.(vote);
      }
    });

    return cleanup;
  }, [proposalId, onCrossTabVote]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      // Verify vote status on reconnection
      verifyVoteStatus(proposalId).then((vote) => {
        if (vote && mountedRef.current) {
          setUserVote(proposalId, vote);
          clearPendingVote(proposalId);
        }
      });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [proposalId]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submissionRef.current?.abort();
    };
  }, []);

  /**
   * Cast a vote with confirmation-first UI pattern
   * Returns true if vote was successful, false otherwise
   */
  const castVote = useCallback(
    async (vote: VoteChoice): Promise<boolean> => {
      if (isSubmitting || userVote) {
        return false;
      }

      // Cancel any existing submission
      submissionRef.current?.abort();
      submissionRef.current = new AbortController();

      setIsSubmitting(true);
      setError(null);

      // Set pending vote for persistence across page refresh
      setPendingVote(proposalId, vote);

      try {
        // Create timeout promise
        const timeoutPromise = new Promise<CastVoteResponse>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error('Vote submission timed out. Please check your connection and try again.')
            );
          }, VOTE_TIMEOUT_MS);
        });

        // Race between vote submission and timeout
        const result = await Promise.race([castVoteService(proposalId, vote), timeoutPromise]);

        if (!mountedRef.current) {
          return false;
        }

        if (result.success && result.transactionId) {
          // Vote confirmed - update local state
          const confirmedVote: UserVote = {
            proposalId,
            vote,
            votedAt: Date.now(),
            transactionId: result.transactionId,
          };

          setUserVote(proposalId, confirmedVote);
          clearPendingVote(proposalId);

          onVoteSuccess?.(confirmedVote);

          // Check if quorum was reached (this would need tally data)
          // For now, we'll let the parent component handle this via polling

          return true;
        } else {
          // Vote failed
          clearPendingVote(proposalId);

          const errorMessage = result.error?.message ?? 'Failed to cast vote. Please try again.';
          setError(errorMessage);
          onVoteError?.(errorMessage);

          return false;
        }
      } catch (err) {
        if (!mountedRef.current) {
          return false;
        }

        clearPendingVote(proposalId);

        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';

        setError(errorMessage);
        onVoteError?.(errorMessage);

        return false;
      } finally {
        if (mountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [isSubmitting, userVote, proposalId, onVoteSuccess, onVoteError]
  );

  /**
   * Manually refresh vote status (e.g., after reconnection)
   */
  const refreshVoteStatus = useCallback(async () => {
    const vote = await verifyVoteStatus(proposalId);
    if (vote && mountedRef.current) {
      setUserVote(proposalId, vote);
      clearPendingVote(proposalId);
    }
  }, [proposalId]);

  return {
    userVote,
    isSubmitting,
    error,
    castVote,
    refreshVoteStatus,
  };
}

export default useVoting;
