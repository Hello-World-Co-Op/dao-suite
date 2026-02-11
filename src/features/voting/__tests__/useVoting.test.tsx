/**
 * useVoting Hook Tests
 *
 * Tests for vote casting, pending vote recovery, and cross-tab sync.
 *
 * Story: 9-1-2-voting-interface
 * AC: 2, 5, 6, 7
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions using vi.hoisted
const mocks = vi.hoisted(() => {
  let userVotes: Record<string, unknown> = {};
  let pendingVotes: Record<string, unknown> = {};
  const listeners: Set<() => void> = new Set();

  return {
    mockUserVotes: {
      get: () => userVotes,
      set: (v: Record<string, unknown>) => {
        userVotes = v;
        listeners.forEach((l) => l());
      },
      listen: (fn: () => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      subscribe: (fn: () => void) => {
        listeners.add(fn);
        fn();
        return () => listeners.delete(fn);
      },
    },
    mockPendingVotes: {
      get: () => pendingVotes,
      set: (v: Record<string, unknown>) => {
        pendingVotes = v;
        listeners.forEach((l) => l());
      },
      listen: (fn: () => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      subscribe: (fn: () => void) => {
        listeners.add(fn);
        fn();
        return () => listeners.delete(fn);
      },
    },
    mockSetUserVote: vi.fn(),
    mockSetPendingVote: vi.fn(),
    mockClearPendingVote: vi.fn(),
    mockSetupCrossTabSync: vi.fn(() => () => {}),
    resetStores: () => {
      userVotes = {};
      pendingVotes = {};
    },
    setPendingVotes: (v: Record<string, unknown>) => {
      pendingVotes = v;
    },
  };
});

// Mock the governance service
vi.mock('../../../services/governanceCanister', () => ({
  castVote: vi.fn(),
  getUserVote: vi.fn().mockResolvedValue(null),
  verifyVoteStatus: vi.fn().mockResolvedValue(null),
}));

// Mock vote state
vi.mock('@/stores', () => ({
  $userVotes: mocks.mockUserVotes,
  $pendingVotes: mocks.mockPendingVotes,
  setUserVote: (proposalId: string, vote: unknown) => mocks.mockSetUserVote(proposalId, vote),
  setPendingVote: (proposalId: string, vote: unknown) => mocks.mockSetPendingVote(proposalId, vote),
  clearPendingVote: (proposalId: string) => mocks.mockClearPendingVote(proposalId),
  setupCrossTabSync: (_callback?: unknown) => mocks.mockSetupCrossTabSync(),
}));

// Import after mocks
import { useVoting } from '../hooks/useVoting';
import * as governanceService from '../../../services/governanceCanister';

describe('useVoting', () => {
  const proposalId = 'prop-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetStores();
  });

  describe('Initial state', () => {
    it('should return null userVote when not voted', () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);

      const { result } = renderHook(() => useVoting({ proposalId }));

      expect(result.current.userVote).toBeNull();
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('AC-6: Vote submission', () => {
    it('should call setPendingVote before submission', async () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);
      vi.mocked(governanceService.castVote).mockResolvedValue({
        success: true,
        transactionId: 'tx-123',
      });

      const { result } = renderHook(() => useVoting({ proposalId }));

      await act(async () => {
        await result.current.castVote('no');
      });

      expect(mocks.mockSetPendingVote).toHaveBeenCalledWith(proposalId, 'no');
    });

    it('should call setUserVote on successful vote', async () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);
      vi.mocked(governanceService.castVote).mockResolvedValue({
        success: true,
        transactionId: 'tx-456',
      });

      const onVoteSuccess = vi.fn();
      const { result } = renderHook(() => useVoting({ proposalId, onVoteSuccess }));

      await act(async () => {
        await result.current.castVote('yes');
      });

      expect(mocks.mockSetUserVote).toHaveBeenCalled();
      expect(mocks.mockClearPendingVote).toHaveBeenCalledWith(proposalId);
      expect(onVoteSuccess).toHaveBeenCalled();
    });

    it('should return true on successful vote', async () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);
      vi.mocked(governanceService.castVote).mockResolvedValue({
        success: true,
        transactionId: 'tx-789',
      });

      const { result } = renderHook(() => useVoting({ proposalId }));

      let success: boolean = false;
      await act(async () => {
        success = await result.current.castVote('abstain');
      });

      expect(success).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should set error on vote failure', async () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);
      vi.mocked(governanceService.castVote).mockResolvedValue({
        success: false,
        error: { code: 'ALREADY_VOTED', message: 'You have already voted' },
      });

      const onVoteError = vi.fn();
      const { result } = renderHook(() => useVoting({ proposalId, onVoteError }));

      await act(async () => {
        await result.current.castVote('yes');
      });

      expect(result.current.error).toBe('You have already voted');
      expect(onVoteError).toHaveBeenCalledWith('You have already voted');
    });

    it('should clear pending vote on failure', async () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);
      vi.mocked(governanceService.castVote).mockResolvedValue({
        success: false,
        error: { code: 'VOTING_CLOSED', message: 'Voting is closed' },
      });

      const { result } = renderHook(() => useVoting({ proposalId }));

      await act(async () => {
        await result.current.castVote('no');
      });

      expect(mocks.mockClearPendingVote).toHaveBeenCalledWith(proposalId);
    });

    it('should handle network errors', async () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);
      vi.mocked(governanceService.castVote).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useVoting({ proposalId }));

      await act(async () => {
        await result.current.castVote('yes');
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should return false on vote failure', async () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);
      vi.mocked(governanceService.castVote).mockResolvedValue({
        success: false,
        error: { code: 'NOT_MEMBER', message: 'Not a member' },
      });

      const { result } = renderHook(() => useVoting({ proposalId }));

      let success: boolean = true;
      await act(async () => {
        success = await result.current.castVote('yes');
      });

      expect(success).toBe(false);
    });
  });

  describe('Cross-tab sync', () => {
    it('should setup cross-tab sync on mount', () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);

      renderHook(() => useVoting({ proposalId }));

      expect(mocks.mockSetupCrossTabSync).toHaveBeenCalled();
    });
  });

  describe('Refresh vote status', () => {
    it('should manually refresh vote status', async () => {
      vi.mocked(governanceService.getUserVote).mockResolvedValue(null);
      vi.mocked(governanceService.verifyVoteStatus).mockResolvedValue({
        proposalId,
        vote: 'no',
        votedAt: Date.now(),
        transactionId: 'tx-refresh',
      });

      const { result } = renderHook(() => useVoting({ proposalId }));

      await act(async () => {
        await result.current.refreshVoteStatus();
      });

      expect(governanceService.verifyVoteStatus).toHaveBeenCalledWith(proposalId);
    });
  });
});
