/**
 * Vote State Management
 *
 * Nanostores atoms for managing vote state with localStorage persistence
 * and cross-tab synchronization.
 *
 * Story: 9-1-2-voting-interface
 * ACs: 3, 7
 */

import { atom } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import type { VoteTally, UserVote, VoteChoice, PendingVote } from '../types';

// Re-export types for convenience
export type { VoteTally, UserVote, PendingVote, VoteChoice } from '../types';

// Storage keys
const USER_VOTES_KEY = 'hwdao:user-votes';
const PENDING_VOTES_KEY = 'hwdao:pending-votes';

/**
 * Vote tallies by proposal ID (not persisted - fetched from canister)
 */
export const $voteTallies = atom<Record<string, VoteTally>>({});

/**
 * User votes by proposal ID (persisted for offline access)
 */
export const $userVotes = persistentAtom<Record<string, UserVote>>(
  USER_VOTES_KEY,
  {},
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);

/**
 * Pending votes (in-flight votes that haven't been confirmed)
 * Persisted to survive page refresh during vote submission
 */
export const $pendingVotes = persistentAtom<Record<string, PendingVote>>(
  PENDING_VOTES_KEY,
  {},
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);

/**
 * Set vote tally for a proposal
 */
export function setVoteTally(proposalId: string, tally: VoteTally): void {
  const current = $voteTallies.get();
  $voteTallies.set({ ...current, [proposalId]: tally });
}

/**
 * Get vote tally for a proposal
 */
export function getVoteTally(proposalId: string): VoteTally | null {
  return $voteTallies.get()[proposalId] ?? null;
}

/**
 * Clear vote tally for a proposal
 */
export function clearVoteTally(proposalId: string): void {
  const current = $voteTallies.get();
  const { [proposalId]: _, ...rest } = current;
  $voteTallies.set(rest);
}

/**
 * Set user vote for a proposal
 */
export function setUserVote(proposalId: string, vote: UserVote): void {
  const current = $userVotes.get();
  $userVotes.set({ ...current, [proposalId]: vote });
}

/**
 * Get user vote for a proposal
 */
export function getUserVote(proposalId: string): UserVote | null {
  return $userVotes.get()[proposalId] ?? null;
}

/**
 * Clear user vote for a proposal (for testing/admin)
 */
export function clearUserVote(proposalId: string): void {
  const current = $userVotes.get();
  const { [proposalId]: _, ...rest } = current;
  $userVotes.set(rest);
}

/**
 * Set pending vote (before submission completes)
 */
export function setPendingVote(proposalId: string, vote: VoteChoice): void {
  const pendingVote: PendingVote = {
    proposalId,
    vote,
    startedAt: Date.now(),
  };
  const current = $pendingVotes.get();
  $pendingVotes.set({ ...current, [proposalId]: pendingVote });
}

/**
 * Get pending vote for a proposal
 */
export function getPendingVote(proposalId: string): PendingVote | null {
  return $pendingVotes.get()[proposalId] ?? null;
}

/**
 * Clear pending vote (after submission completes or fails)
 */
export function clearPendingVote(proposalId: string): void {
  const current = $pendingVotes.get();
  const { [proposalId]: _, ...rest } = current;
  $pendingVotes.set(rest);
}

/**
 * Check if there's a pending vote for a proposal
 */
export function hasPendingVote(proposalId: string): boolean {
  return !!$pendingVotes.get()[proposalId];
}

/**
 * Clear all pending votes (e.g., after app restart)
 */
export function clearAllPendingVotes(): void {
  $pendingVotes.set({});
}

/**
 * Cross-tab synchronization listener
 * Detects when votes are cast in other tabs
 */
export function setupCrossTabSync(
  onVoteChange?: (proposalId: string, vote: UserVote) => void
): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    // Check if the change is for user votes
    if (event.key === USER_VOTES_KEY && event.newValue) {
      try {
        const newVotes = JSON.parse(event.newValue) as Record<string, UserVote>;
        const currentVotes = $userVotes.get();

        // Find newly added votes
        for (const proposalId of Object.keys(newVotes)) {
          if (!currentVotes[proposalId] && newVotes[proposalId]) {
            // Vote was added in another tab
            if (onVoteChange) {
              onVoteChange(proposalId, newVotes[proposalId]);
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  };

  // Add listener
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange);
  }

  // Return cleanup function
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange);
    }
  };
}

/**
 * Actions object for convenient access
 */
export const voteActions = {
  setVoteTally,
  getVoteTally,
  clearVoteTally,
  setUserVote,
  getUserVote,
  clearUserVote,
  setPendingVote,
  getPendingVote,
  clearPendingVote,
  hasPendingVote,
  clearAllPendingVotes,
  setupCrossTabSync,
};
