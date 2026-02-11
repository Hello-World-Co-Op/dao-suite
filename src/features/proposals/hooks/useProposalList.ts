/**
 * useProposalList Hook
 *
 * Manages proposal list fetching, polling, and state synchronization.
 * Implements 30s polling, visibility API pause, debouncing, and retry logic.
 *
 * Story: 9-1-3-proposal-listing
 * ACs: 1, 2, 3, 4, 5, 8, 9
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $proposalFilters,
  $proposalSort,
  $proposalPage,
  $proposalList,
  $proposalTotalCount,
  $proposalListLoading,
  $proposalListError,
  setProposalList,
  setProposalTotalCount,
  setProposalListLoading,
  setProposalListError,
  setProposalStatusCounts,
  type ProposalListItem,
} from '@/stores';
import {
  getProposals,
  getProposalCountsByStatus,
  TimeoutError,
  SchemaValidationError,
} from '../../../services/governanceCanister';

// Configuration
const POLLING_INTERVAL_MS = 30000; // 30 seconds
const FILTER_DEBOUNCE_MS = 100;
const MAX_CONSECUTIVE_FAILURES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

export interface UseProposalListResult {
  proposals: ProposalListItem[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  isPollingPaused: boolean;
  consecutiveFailures: number;
}

export function useProposalList(): UseProposalListResult {
  const filters = useStore($proposalFilters);
  const sort = useStore($proposalSort);
  const page = useStore($proposalPage);
  const proposals = useStore($proposalList);
  const totalCount = useStore($proposalTotalCount);
  const isLoading = useStore($proposalListLoading);
  const error = useStore($proposalListError);

  // Local state for polling control
  const [isPollingPaused, setIsPollingPaused] = useState(false);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  // Refs for cleanup and debouncing
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY_MS);
  const lastFetchParamsRef = useRef<string>('');
  const cachedProposalsRef = useRef<ProposalListItem[]>([]);

  /**
   * Fetch proposals from the service
   */
  const fetchProposals = useCallback(
    async (isRetry = false) => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Generate params key for comparison
      const paramsKey = JSON.stringify({ filters, sort, page });

      // Skip if params haven't changed and we're not retrying
      if (!isRetry && paramsKey === lastFetchParamsRef.current && proposals.length > 0) {
        return;
      }

      lastFetchParamsRef.current = paramsKey;
      setProposalListLoading(true);
      setProposalListError(null);

      try {
        const [proposalsResponse, statusCounts] = await Promise.all([
          getProposals(filters, sort, page, signal),
          getProposalCountsByStatus(),
        ]);

        // Check if request was aborted
        if (signal.aborted) {
          return;
        }

        setProposalList(proposalsResponse.items);
        setProposalTotalCount(proposalsResponse.total);
        setProposalStatusCounts(statusCounts);

        // Cache successful response
        cachedProposalsRef.current = proposalsResponse.items;

        // Reset failure tracking on success
        setConsecutiveFailures(0);
        retryDelayRef.current = INITIAL_RETRY_DELAY_MS;
      } catch (err) {
        if (signal.aborted) {
          return; // Ignore aborted requests
        }

        const newFailureCount = consecutiveFailures + 1;
        setConsecutiveFailures(newFailureCount);

        // Determine error message
        let errorMessage = 'Failed to load proposals. ';
        if (err instanceof TimeoutError) {
          errorMessage += 'Request timed out.';
        } else if (err instanceof SchemaValidationError) {
          errorMessage += 'Invalid response from server.';
        } else if (!navigator.onLine) {
          errorMessage = 'You appear to be offline.';
        } else {
          errorMessage += 'Please try again.';
        }

        // Stop polling after max failures
        if (newFailureCount >= MAX_CONSECUTIVE_FAILURES) {
          setIsPollingPaused(true);
          errorMessage = 'Connection issues - tap to retry';
        }

        setProposalListError(errorMessage);

        // Show cached data if available
        if (cachedProposalsRef.current.length > 0 && proposals.length === 0) {
          setProposalList(cachedProposalsRef.current);
          setProposalListError('Offline - showing cached results');
        }

        // Calculate exponential backoff for retry
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY_MS);
      } finally {
        setProposalListLoading(false);
      }
    },
    [filters, sort, page, proposals.length, consecutiveFailures]
  );

  /**
   * Manual refetch (for retry button)
   */
  const refetch = useCallback(() => {
    setConsecutiveFailures(0);
    setIsPollingPaused(false);
    retryDelayRef.current = INITIAL_RETRY_DELAY_MS;
    fetchProposals(true);
  }, [fetchProposals]);

  /**
   * Debounced fetch for filter changes
   */
  const debouncedFetch = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchProposals();
    }, FILTER_DEBOUNCE_MS);
  }, [fetchProposals]);

  // Fetch on filter/sort/page changes
  useEffect(() => {
    debouncedFetch();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [filters, sort, page, debouncedFetch]);

  // Setup polling
  useEffect(() => {
    if (isPollingPaused) {
      return;
    }

    const poll = () => {
      if (!document.hidden) {
        fetchProposals();
      }
    };

    pollingTimeoutRef.current = setInterval(poll, POLLING_INTERVAL_MS);

    return () => {
      if (pollingTimeoutRef.current) {
        clearInterval(pollingTimeoutRef.current);
      }
    };
  }, [fetchProposals, isPollingPaused]);

  // Visibility API - pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - polling will skip
      } else {
        // Tab is visible again - refetch immediately if not paused
        if (!isPollingPaused) {
          fetchProposals();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchProposals, isPollingPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearInterval(pollingTimeoutRef.current);
      }
    };
  }, []);

  return {
    proposals,
    totalCount,
    isLoading,
    error,
    refetch,
    isPollingPaused,
    consecutiveFailures,
  };
}

export default useProposalList;
