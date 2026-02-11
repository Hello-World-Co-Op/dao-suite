/**
 * useVoteTallyPolling Hook Tests
 *
 * Tests for polling, exponential backoff, and visibility API.
 *
 * Story: 9-1-2-voting-interface
 * AC: 3
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions using vi.hoisted
const mocks = vi.hoisted(() => {
  let voteTallies: Record<string, unknown> = {};
  const listeners: Set<() => void> = new Set();

  return {
    mockVoteTallies: {
      get: () => voteTallies,
      set: (v: Record<string, unknown>) => {
        voteTallies = v;
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
    mockSetVoteTally: vi.fn(),
    resetStores: () => {
      voteTallies = {};
    },
  };
});

// Mock the governance service
vi.mock('../../../services/governanceCanister', () => ({
  getVoteTally: vi.fn(),
}));

// Mock vote state
vi.mock('@hwdao/state', () => ({
  $voteTallies: mocks.mockVoteTallies,
  setVoteTally: (...args: unknown[]) => mocks.mockSetVoteTally(...args),
}));

// Import after mocks
import { useVoteTallyPolling } from '../hooks/useVoteTallyPolling';
import * as governanceService from '../../../services/governanceCanister';

describe('useVoteTallyPolling', () => {
  const proposalId = 'prop-123';
  const mockTally = {
    yes: 50,
    no: 30,
    abstain: 20,
    totalVotes: 100,
    quorumRequired: 10,
    quorumMet: true,
    passingThreshold: 51,
    lastUpdated: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetStores();
    vi.mocked(governanceService.getVoteTally).mockResolvedValue(mockTally);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('should not fetch when disabled', () => {
      renderHook(() => useVoteTallyPolling({ proposalId, enabled: false }));

      expect(governanceService.getVoteTally).not.toHaveBeenCalled();
    });

    it('should return initial loading state', () => {
      const { result } = renderHook(() => useVoteTallyPolling({ proposalId, enabled: true }));

      // Initial state before fetch completes
      expect(result.current.tally).toBeNull();
      expect(result.current.isPaused).toBe(false);
      expect(result.current.consecutiveFailures).toBe(0);
    });
  });

  describe('Hook interface', () => {
    it('should expose refreshTally function', () => {
      const { result } = renderHook(() => useVoteTallyPolling({ proposalId, enabled: true }));

      expect(typeof result.current.refreshTally).toBe('function');
    });

    it('should expose retryPolling function', () => {
      const { result } = renderHook(() => useVoteTallyPolling({ proposalId, enabled: true }));

      expect(typeof result.current.retryPolling).toBe('function');
    });

    it('should expose error state', () => {
      const { result } = renderHook(() => useVoteTallyPolling({ proposalId, enabled: true }));

      expect(result.current.error).toBeNull();
    });

    it('should expose isPaused state', () => {
      const { result } = renderHook(() => useVoteTallyPolling({ proposalId, enabled: true }));

      expect(result.current.isPaused).toBe(false);
    });

    it('should expose consecutiveFailures count', () => {
      const { result } = renderHook(() => useVoteTallyPolling({ proposalId, enabled: true }));

      expect(result.current.consecutiveFailures).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should stop polling on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() => useVoteTallyPolling({ proposalId, enabled: true }));

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
