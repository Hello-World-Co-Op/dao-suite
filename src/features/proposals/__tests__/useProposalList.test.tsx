/**
 * useProposalList Hook Tests
 *
 * Tests for proposal list fetching, error handling, and retry logic.
 * Note: Complex polling behavior is tested via integration tests.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 1, 2, 3, 4, 5, 8, 9
 * Tasks: 10.7, 10.10
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useProposalList } from '../hooks/useProposalList';
import {
  $proposalFilters,
  $proposalSort,
  $proposalPage,
  $proposalList,
  $proposalTotalCount,
  $proposalListLoading,
  $proposalListError,
  $proposalStatusCounts,
} from '@/stores';

// Mock the governance canister service
const mockGetProposals = vi.fn();
const mockGetProposalCountsByStatus = vi.fn();

vi.mock('../../../services/governanceCanister', () => ({
  getProposals: (...args: unknown[]) => mockGetProposals(...args),
  getProposalCountsByStatus: () => mockGetProposalCountsByStatus(),
  TimeoutError: class TimeoutError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TimeoutError';
    }
  },
  SchemaValidationError: class SchemaValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'SchemaValidationError';
    }
  },
}));

const mockProposals = [
  {
    id: 'prop-1',
    title: 'Test Proposal 1',
    proposer: 'user-1',
    status: 'Active' as const,
    votesFor: 100,
    votesAgainst: 50,
    votesAbstain: 25,
    votingEndsAt: Date.now() + 86400000,
    createdAt: Date.now(),
  },
  {
    id: 'prop-2',
    title: 'Test Proposal 2',
    proposer: 'user-2',
    status: 'Passed' as const,
    votesFor: 200,
    votesAgainst: 30,
    votesAbstain: 10,
    votingEndsAt: Date.now() - 86400000,
    createdAt: Date.now() - 172800000,
  },
];

const mockStatusCounts = {
  Active: 5,
  Passed: 10,
  Failed: 3,
  Pending: 2,
};

describe('useProposalList', () => {
  beforeEach(() => {
    // Reset all atoms
    $proposalList.set([]);
    $proposalFilters.set({
      status: [],
      search: '',
      myProposals: false,
      notVoted: false,
    });
    $proposalSort.set('newest');
    $proposalPage.set(1);
    $proposalTotalCount.set(0);
    $proposalListLoading.set(false);
    $proposalListError.set(null);
    $proposalStatusCounts.set({
      Active: 0,
      Passed: 0,
      Failed: 0,
      Pending: 0,
    });

    // Reset mocks
    vi.clearAllMocks();

    // Default mock implementations - resolve immediately
    mockGetProposals.mockResolvedValue({
      items: mockProposals,
      total: 20,
      page: 1,
      pageSize: 20,
    });
    mockGetProposalCountsByStatus.mockResolvedValue(mockStatusCounts);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Task 10.7: Basic hook functionality', () => {
    it('should return proposals from atom', () => {
      $proposalList.set(mockProposals);

      const { result } = renderHook(() => useProposalList());

      expect(result.current.proposals).toEqual(mockProposals);
    });

    it('should return totalCount from atom', () => {
      $proposalTotalCount.set(42);

      const { result } = renderHook(() => useProposalList());

      expect(result.current.totalCount).toBe(42);
    });

    it('should return loading state from atom', () => {
      $proposalListLoading.set(true);

      const { result } = renderHook(() => useProposalList());

      expect(result.current.isLoading).toBe(true);
    });

    it('should return error from atom', () => {
      $proposalListError.set('Test error');

      const { result } = renderHook(() => useProposalList());

      expect(result.current.error).toBe('Test error');
    });

    it('should have refetch function', () => {
      const { result } = renderHook(() => useProposalList());

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should have isPollingPaused state', () => {
      const { result } = renderHook(() => useProposalList());

      expect(typeof result.current.isPollingPaused).toBe('boolean');
    });

    it('should have consecutiveFailures count', () => {
      const { result } = renderHook(() => useProposalList());

      expect(typeof result.current.consecutiveFailures).toBe('number');
    });
  });

  describe('Task 10.7: Service interaction', () => {
    it('should call getProposals on mount', async () => {
      renderHook(() => useProposalList());

      await waitFor(() => {
        expect(mockGetProposals).toHaveBeenCalled();
      });
    });

    it('should call getProposalCountsByStatus on mount', async () => {
      renderHook(() => useProposalList());

      await waitFor(() => {
        expect(mockGetProposalCountsByStatus).toHaveBeenCalled();
      });
    });

    it('should pass filters to getProposals', async () => {
      $proposalFilters.set({
        status: ['Active', 'Pending'],
        search: 'test',
        myProposals: true,
        notVoted: false,
      });

      renderHook(() => useProposalList());

      await waitFor(() => {
        expect(mockGetProposals).toHaveBeenCalledWith(
          expect.objectContaining({
            status: ['Active', 'Pending'],
            search: 'test',
            myProposals: true,
          }),
          expect.any(String),
          expect.any(Number),
          expect.any(Object)
        );
      });
    });

    it('should pass sort to getProposals', async () => {
      $proposalSort.set('oldest');

      renderHook(() => useProposalList());

      await waitFor(() => {
        expect(mockGetProposals).toHaveBeenCalledWith(
          expect.any(Object),
          'oldest',
          expect.any(Number),
          expect.any(Object)
        );
      });
    });

    it('should pass page to getProposals', async () => {
      $proposalPage.set(3);

      renderHook(() => useProposalList());

      await waitFor(() => {
        expect(mockGetProposals).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(String),
          3,
          expect.any(Object)
        );
      });
    });
  });

  describe('Task 10.10: Error handling', () => {
    it('should set error on fetch failure', async () => {
      mockGetProposals.mockRejectedValue(new Error('Network error'));

      renderHook(() => useProposalList());

      await waitFor(() => {
        expect($proposalListError.get()).not.toBeNull();
      });
    });

    it('should increment consecutiveFailures on error', async () => {
      mockGetProposals.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useProposalList());

      await waitFor(() => {
        expect(result.current.consecutiveFailures).toBeGreaterThan(0);
      });
    });

    it('should call refetch when refetch is invoked', async () => {
      const { result } = renderHook(() => useProposalList());

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockGetProposals).toHaveBeenCalled();
      });

      // Clear and refetch
      mockGetProposals.mockClear();

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(mockGetProposals).toHaveBeenCalled();
      });
    });
  });
});
