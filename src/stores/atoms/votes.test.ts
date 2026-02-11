/**
 * Vote State Atoms Tests
 *
 * Tests for vote tally, user vote, and pending vote state management.
 *
 * Story: 9-1-2-voting-interface
 * AC: 3, 7
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  $voteTallies,
  $userVotes,
  $pendingVotes,
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
  type VoteTally,
  type UserVote,
} from '@/stores';

describe('Vote State Atoms', () => {
  beforeEach(() => {
    // Reset all atoms
    $voteTallies.set({});
    $userVotes.set({});
    $pendingVotes.set({});
  });

  describe('$voteTallies', () => {
    const mockTally: VoteTally = {
      yes: 50,
      no: 30,
      abstain: 20,
      totalVotes: 100,
      quorumRequired: 10,
      quorumMet: true,
      passingThreshold: 51,
      lastUpdated: Date.now(),
    };

    it('should set vote tally for a proposal', () => {
      setVoteTally('prop-1', mockTally);

      expect($voteTallies.get()['prop-1']).toEqual(mockTally);
    });

    it('should get vote tally for a proposal', () => {
      setVoteTally('prop-1', mockTally);

      const result = getVoteTally('prop-1');
      expect(result).toEqual(mockTally);
    });

    it('should return null for non-existent proposal', () => {
      const result = getVoteTally('non-existent');
      expect(result).toBeNull();
    });

    it('should clear vote tally for a proposal', () => {
      setVoteTally('prop-1', mockTally);
      clearVoteTally('prop-1');

      expect(getVoteTally('prop-1')).toBeNull();
    });

    it('should handle multiple proposals', () => {
      const tally2: VoteTally = { ...mockTally, yes: 100, totalVotes: 150 };

      setVoteTally('prop-1', mockTally);
      setVoteTally('prop-2', tally2);

      expect(getVoteTally('prop-1')).toEqual(mockTally);
      expect(getVoteTally('prop-2')).toEqual(tally2);
    });
  });

  describe('$userVotes', () => {
    const mockVote: UserVote = {
      proposalId: 'prop-1',
      vote: 'yes',
      votedAt: Date.now(),
      transactionId: 'tx-123',
    };

    it('should set user vote for a proposal', () => {
      setUserVote('prop-1', mockVote);

      expect($userVotes.get()['prop-1']).toEqual(mockVote);
    });

    it('should get user vote for a proposal', () => {
      setUserVote('prop-1', mockVote);

      const result = getUserVote('prop-1');
      expect(result).toEqual(mockVote);
    });

    it('should return null for non-existent vote', () => {
      const result = getUserVote('non-existent');
      expect(result).toBeNull();
    });

    it('should clear user vote for a proposal', () => {
      setUserVote('prop-1', mockVote);
      clearUserVote('prop-1');

      expect(getUserVote('prop-1')).toBeNull();
    });

    it('should preserve other votes when clearing one', () => {
      const vote2: UserVote = { ...mockVote, proposalId: 'prop-2' };

      setUserVote('prop-1', mockVote);
      setUserVote('prop-2', vote2);
      clearUserVote('prop-1');

      expect(getUserVote('prop-1')).toBeNull();
      expect(getUserVote('prop-2')).toEqual(vote2);
    });
  });

  describe('$pendingVotes', () => {
    it('should set pending vote', () => {
      setPendingVote('prop-1', 'yes');

      const pending = getPendingVote('prop-1');
      expect(pending).not.toBeNull();
      expect(pending?.proposalId).toBe('prop-1');
      expect(pending?.vote).toBe('yes');
      expect(pending?.startedAt).toBeDefined();
    });

    it('should check if pending vote exists', () => {
      expect(hasPendingVote('prop-1')).toBe(false);

      setPendingVote('prop-1', 'no');

      expect(hasPendingVote('prop-1')).toBe(true);
    });

    it('should clear pending vote', () => {
      setPendingVote('prop-1', 'abstain');
      clearPendingVote('prop-1');

      expect(hasPendingVote('prop-1')).toBe(false);
      expect(getPendingVote('prop-1')).toBeNull();
    });

    it('should clear all pending votes', () => {
      setPendingVote('prop-1', 'yes');
      setPendingVote('prop-2', 'no');
      setPendingVote('prop-3', 'abstain');

      clearAllPendingVotes();

      expect(hasPendingVote('prop-1')).toBe(false);
      expect(hasPendingVote('prop-2')).toBe(false);
      expect(hasPendingVote('prop-3')).toBe(false);
    });
  });

  describe('Cross-tab sync', () => {
    it('should return cleanup function', () => {
      const cleanup = setupCrossTabSync();
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('should register storage event listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const cleanup = setupCrossTabSync();

      expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));

      cleanup();
      addEventListenerSpy.mockRestore();
    });

    it('should remove storage event listener on cleanup', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const cleanup = setupCrossTabSync();

      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('should not call callback for existing votes', () => {
      // Set existing vote first
      const existingVote: UserVote = {
        proposalId: 'prop-1',
        vote: 'no',
        votedAt: Date.now(),
        transactionId: 'tx-existing',
      };
      setUserVote('prop-1', existingVote);

      const callback = vi.fn();
      const cleanup = setupCrossTabSync(callback);

      // Simulate storage event with same proposal
      const event = new StorageEvent('storage', {
        key: 'hwdao:user-votes',
        newValue: JSON.stringify({ 'prop-1': existingVote }),
      });

      window.dispatchEvent(event);

      // Should not be called since vote already exists locally
      expect(callback).not.toHaveBeenCalled();

      cleanup();
    });

    it('should ignore other storage keys', () => {
      const callback = vi.fn();
      const cleanup = setupCrossTabSync(callback);

      const event = new StorageEvent('storage', {
        key: 'other-key',
        newValue: JSON.stringify({ foo: 'bar' }),
      });

      window.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();

      cleanup();
    });
  });

  describe('Vote types', () => {
    it('should support yes vote', () => {
      setPendingVote('prop-1', 'yes');
      expect(getPendingVote('prop-1')?.vote).toBe('yes');
    });

    it('should support no vote', () => {
      setPendingVote('prop-1', 'no');
      expect(getPendingVote('prop-1')?.vote).toBe('no');
    });

    it('should support abstain vote', () => {
      setPendingVote('prop-1', 'abstain');
      expect(getPendingVote('prop-1')?.vote).toBe('abstain');
    });
  });
});
