/**
 * useVoteTallyPolling Hook
 *
 * Polls vote tally at regular intervals with exponential backoff
 * on failures. Uses visibility API to pause when tab is hidden.
 *
 * Story: 9-1-2-voting-interface
 * AC: 3
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { $voteTallies, setVoteTally, type VoteTally } from '@/stores';
import { getVoteTally } from '../../../services/governanceCanister';

export interface UseVoteTallyPollingOptions {
  proposalId: string;
  enabled?: boolean;
  /** Immediately fetch tally when true (e.g., after vote cast) */
  forceRefresh?: boolean;
}

export interface UseVoteTallyPollingResult {
  tally: VoteTally | null;
  isLoading: boolean;
  error: string | null;
  isPaused: boolean;
  consecutiveFailures: number;
  refreshTally: () => Promise<void>;
  retryPolling: () => void;
}

// Polling configuration
const BASE_INTERVAL_MS = 10000; // 10 seconds
const MAX_INTERVAL_MS = 60000; // 60 seconds max
const MIN_GAP_AFTER_VISIBILITY_MS = 2000; // 2 seconds minimum gap after tab becomes visible
const MAX_CONSECUTIVE_FAILURES = 3;

export function useVoteTallyPolling({
  proposalId,
  enabled = true,
  forceRefresh = false,
}: UseVoteTallyPollingOptions): UseVoteTallyPollingResult {
  const voteTallies = useStore($voteTallies);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Refs for interval management
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const mountedRef = useRef(true);

  // Get current tally from store
  const tally = voteTallies[proposalId] ?? null;

  /**
   * Calculate current polling interval with exponential backoff
   */
  const getCurrentInterval = useCallback(() => {
    if (consecutiveFailures === 0) return BASE_INTERVAL_MS;
    const backoffMultiplier = Math.pow(2, consecutiveFailures);
    return Math.min(BASE_INTERVAL_MS * backoffMultiplier, MAX_INTERVAL_MS);
  }, [consecutiveFailures]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  }, []);

  /**
   * Fetch tally from canister
   */
  const fetchTally = useCallback(async () => {
    if (!enabled || !proposalId) return;

    // Check minimum gap after visibility change
    const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
    if (timeSinceLastFetch < MIN_GAP_AFTER_VISIBILITY_MS) {
      return;
    }

    setIsLoading(true);
    setError(null);
    lastFetchTimeRef.current = Date.now();

    try {
      const newTally = await getVoteTally(proposalId);

      if (!mountedRef.current) return;

      setVoteTally(proposalId, newTally);
      setConsecutiveFailures(0);
      setIsPaused(false);
    } catch (err) {
      if (!mountedRef.current) return;

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch vote tally';
      setError(errorMessage);

      const newFailureCount = consecutiveFailures + 1;
      setConsecutiveFailures(newFailureCount);

      // Pause polling after too many failures
      if (newFailureCount >= MAX_CONSECUTIVE_FAILURES) {
        setIsPaused(true);
        stopPolling();
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, proposalId, consecutiveFailures, stopPolling]);

  /**
   * Start polling
   */
  const startPolling = useCallback(() => {
    stopPolling();

    if (!enabled || isPaused) return;

    const interval = getCurrentInterval();
    intervalIdRef.current = setInterval(fetchTally, interval);
  }, [enabled, isPaused, getCurrentInterval, fetchTally, stopPolling]);

  /**
   * Manual refresh (bypasses interval)
   */
  const refreshTally = useCallback(async () => {
    lastFetchTimeRef.current = 0; // Reset gap check
    await fetchTally();
  }, [fetchTally]);

  /**
   * Retry after pause
   */
  const retryPolling = useCallback(() => {
    setConsecutiveFailures(0);
    setIsPaused(false);
    setError(null);
    lastFetchTimeRef.current = 0;
    fetchTally().then(startPolling);
  }, [fetchTally, startPolling]);

  // Handle force refresh
  useEffect(() => {
    if (forceRefresh) {
      refreshTally();
    }
  }, [forceRefresh, refreshTally]);

  // Initial fetch and polling setup
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && proposalId) {
      fetchTally().then(startPolling);
    }

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [enabled, proposalId, fetchTally, startPolling, stopPolling]);

  // Restart polling when interval changes (due to backoff)
  useEffect(() => {
    if (enabled && !isPaused) {
      startPolling();
    }
    return stopPolling;
  }, [consecutiveFailures, enabled, isPaused, startPolling, stopPolling]);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Resume polling with minimum gap
        if (!isPaused && enabled) {
          const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
          const delay = Math.max(0, MIN_GAP_AFTER_VISIBILITY_MS - timeSinceLastFetch);

          setTimeout(() => {
            if (mountedRef.current && !document.hidden) {
              fetchTally().then(startPolling);
            }
          }, delay);
        }
      }
    };

    // Feature detect visibility API
    if (typeof document !== 'undefined' && 'hidden' in document) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [enabled, isPaused, fetchTally, startPolling, stopPolling]);

  return {
    tally,
    isLoading,
    error,
    isPaused,
    consecutiveFailures,
    refreshTally,
    retryPolling,
  };
}

export default useVoteTallyPolling;
