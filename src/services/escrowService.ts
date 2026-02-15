/**
 * Escrow View Service
 *
 * Service for querying escrow data from the treasury canister.
 * Provides hooks for React component integration.
 *
 * Story: 9-2-4-escrow-view
 * ACs: 1, 2, 3
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  $escrow,
  $selectedEscrow,
  $escrowStatusFilter,
  $filteredEscrows,
  $escrowStatusCounts,
  setEscrowLoading,
  setUserEscrows,
  setEscrowError,
  clearEscrow,
  setSelectedEscrow,
  setEscrowStatusFilter,
  isEscrowStale,
  ESCROW_STALE_THRESHOLD_MS,
  type Escrow,
  type Milestone,
  type EscrowState,
  type EscrowStatusFilter,
} from '@/stores';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Configuration
// ============================================================================

/** Treasury canister ID */
const TREASURY_CANISTER_ID = import.meta.env.VITE_TREASURY_CANISTER_ID || '';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30000;

/** Initial backoff delay for retries (1 second) */
const INITIAL_BACKOFF_MS = 1000;

/** Maximum backoff delay (30 seconds) */
const MAX_BACKOFF_MS = 30000;

/** Maximum retry attempts for queries */
const MAX_RETRY_ATTEMPTS = 3;

// ============================================================================
// Types
// ============================================================================

export interface FetchEscrowsResult {
  success: boolean;
  escrows?: Escrow[];
  error?: string;
}

export interface FetchEscrowDetailsResult {
  success: boolean;
  escrow?: Escrow;
  error?: string;
}

export interface FetchMilestonesResult {
  success: boolean;
  milestones?: Milestone[];
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if we're in mock/development mode
 */
function isMockMode(): boolean {
  return !TREASURY_CANISTER_ID || import.meta.env.DEV;
}

/**
 * Create structured log entry
 */
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'EscrowService',
    level,
    message,
    ...data,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_BACKOFF_MS);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute with timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

// ============================================================================
// Mock Implementation
// ============================================================================

/** Mock escrows data for development — empty until canister integration */
const mockEscrows: Escrow[] = [];

/**
 * Mock list escrows fetch for development
 */
async function mockListEscrows(userPrincipal: string): Promise<Escrow[]> {
  log('info', 'Mock list_escrows fetch', { userPrincipal });
  await sleep(500);

  // Filter escrows where user is recipient (in mock, all escrows have test-principal-1)
  // In real implementation, this would filter by actual user principal
  return mockEscrows.filter(
    (e) => e.recipient === 'test-principal-1' || e.recipient === userPrincipal
  );
}

/**
 * Mock get escrow by ID for development
 */
async function mockGetEscrow(escrowId: bigint): Promise<Escrow | null> {
  log('info', 'Mock get_escrow fetch', { escrowId: escrowId.toString() });
  await sleep(300);

  return mockEscrows.find((e) => e.id === escrowId) || null;
}

/**
 * Mock get milestone status for development
 */
async function mockGetMilestoneStatus(escrowId: bigint): Promise<Milestone[] | null> {
  log('info', 'Mock get_milestone_status fetch', { escrowId: escrowId.toString() });
  await sleep(200);

  const escrow = mockEscrows.find((e) => e.id === escrowId);
  return escrow ? escrow.milestones : null;
}

// ============================================================================
// Canister Integration
// ============================================================================

/**
 * Fetch all escrows from treasury canister and filter by recipient
 */
async function fetchEscrowsFromCanister(userPrincipal: string): Promise<Escrow[]> {
  if (isMockMode()) {
    return mockListEscrows(userPrincipal);
  }

  // TODO: Replace with actual IC Agent call when @dfinity/agent is configured
  // const agent = new HttpAgent({ host: IC_HOST });
  // const actor = Actor.createActor(treasuryIdlFactory, {
  //   agent,
  //   canisterId: TREASURY_CANISTER_ID,
  // });
  // const allEscrows = await actor.list_escrows([]);
  // return allEscrows.filter(e => e.recipient.toText() === userPrincipal);

  // For now, use mock
  return mockListEscrows(userPrincipal);
}

/**
 * Fetch single escrow by ID from treasury canister
 */
async function fetchEscrowFromCanister(escrowId: bigint): Promise<Escrow | null> {
  if (isMockMode()) {
    return mockGetEscrow(escrowId);
  }

  // TODO: Replace with actual IC Agent call
  // const actor = ...
  // return await actor.get_escrow(escrowId);

  return mockGetEscrow(escrowId);
}

/**
 * Fetch milestones for an escrow from treasury canister
 */
async function fetchMilestonesFromCanister(escrowId: bigint): Promise<Milestone[] | null> {
  if (isMockMode()) {
    return mockGetMilestoneStatus(escrowId);
  }

  // TODO: Replace with actual IC Agent call
  // const actor = ...
  // const result = await actor.get_milestone_status(escrowId);
  // if ('Ok' in result) return result.Ok;
  // throw new Error(result.Err);

  return mockGetMilestoneStatus(escrowId);
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Fetch user's escrows with retry logic
 */
export async function fetchUserEscrows(userPrincipal: string): Promise<FetchEscrowsResult> {
  log('info', 'Fetching user escrows', { userPrincipal });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      setEscrowLoading(true);

      const escrows = await withTimeout(
        fetchEscrowsFromCanister(userPrincipal),
        REQUEST_TIMEOUT_MS
      );

      setUserEscrows(escrows);

      log('info', 'User escrows fetched successfully', {
        count: escrows.length,
        attempt,
      });

      return { success: true, escrows };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      log('warn', `Escrow fetch attempt ${attempt + 1} failed`, {
        error: lastError.message,
        attempt,
      });

      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const backoffDelay = getBackoffDelay(attempt);
        log('info', `Retrying after ${backoffDelay}ms`, { attempt });
        await sleep(backoffDelay);
      }
    }
  }

  const errorMessage = lastError?.message || 'Failed to fetch escrow data';
  setEscrowError(errorMessage);

  log('error', 'Escrow fetch failed after all retries', {
    error: errorMessage,
  });

  return { success: false, error: errorMessage };
}

/**
 * Fetch single escrow details
 */
export async function fetchEscrowDetails(escrowId: bigint): Promise<FetchEscrowDetailsResult> {
  log('info', 'Fetching escrow details', { escrowId: escrowId.toString() });

  try {
    const escrow = await withTimeout(fetchEscrowFromCanister(escrowId), REQUEST_TIMEOUT_MS);

    if (!escrow) {
      return { success: false, error: 'Escrow not found' };
    }

    log('info', 'Escrow details fetched successfully', {
      escrowId: escrowId.toString(),
    });

    return { success: true, escrow };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log('error', 'Escrow details fetch failed', {
      escrowId: escrowId.toString(),
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch milestones for an escrow
 */
export async function fetchEscrowMilestones(escrowId: bigint): Promise<FetchMilestonesResult> {
  log('info', 'Fetching escrow milestones', { escrowId: escrowId.toString() });

  try {
    const milestones = await withTimeout(fetchMilestonesFromCanister(escrowId), REQUEST_TIMEOUT_MS);

    if (milestones === null) {
      return { success: false, error: 'Escrow not found' };
    }

    log('info', 'Escrow milestones fetched successfully', {
      escrowId: escrowId.toString(),
      count: milestones.length,
    });

    return { success: true, milestones };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    log('error', 'Escrow milestones fetch failed', {
      escrowId: escrowId.toString(),
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Refresh escrow data (for manual refresh)
 */
export async function refreshEscrowData(userPrincipal: string): Promise<FetchEscrowsResult> {
  log('info', 'Manual escrow refresh triggered');
  return fetchUserEscrows(userPrincipal);
}

/**
 * Get current escrow state
 */
export function getEscrowState(): EscrowState {
  return $escrow.get();
}

/**
 * Clear escrow data (e.g., on logout)
 */
export function clearEscrowData(): void {
  log('info', 'Clearing escrow data');
  clearEscrow();
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseEscrowViewOptions {
  /** User's principal ID for filtering escrows */
  userPrincipal?: string;
  /** Whether to auto-fetch escrows on mount */
  autoFetch?: boolean;
  /** Whether to refetch if data is stale */
  refetchIfStale?: boolean;
}

export interface UseEscrowViewResult {
  /** Current escrow state */
  escrowState: EscrowState;
  /** Filtered escrows based on current filter */
  filteredEscrows: Escrow[];
  /** Status counts for filter badges */
  statusCounts: Record<EscrowStatusFilter, number>;
  /** Currently selected escrow */
  selectedEscrow: Escrow | null;
  /** Current status filter */
  statusFilter: EscrowStatusFilter;
  /** Whether escrows are loading */
  isLoading: boolean;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Refresh escrow data */
  refresh: () => Promise<void>;
  /** Select an escrow for detail view */
  selectEscrow: (escrow: Escrow | null) => void;
  /** Set status filter */
  setFilter: (filter: EscrowStatusFilter) => void;
  /** Clear all escrow data */
  clear: () => void;
}

/**
 * React hook for escrow view functionality
 */
export function useEscrowView(options: UseEscrowViewOptions = {}): UseEscrowViewResult {
  const {
    userPrincipal = 'test-principal-1', // Default for mock mode
    autoFetch = true,
    refetchIfStale = true,
  } = options;

  const escrowState = useStore($escrow);
  const filteredEscrows = useStore($filteredEscrows);
  const statusCounts = useStore($escrowStatusCounts);
  const selectedEscrow = useStore($selectedEscrow);
  const statusFilter = useStore($escrowStatusFilter);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasFetchedRef = useRef(false);

  // Fetch escrow data on mount
  useEffect(() => {
    const shouldFetch =
      autoFetch &&
      (!hasFetchedRef.current || (refetchIfStale && isEscrowStale(ESCROW_STALE_THRESHOLD_MS)));

    if (shouldFetch && userPrincipal) {
      hasFetchedRef.current = true;

      // Track analytics event
      trackEvent('escrow_view_loaded', {});

      fetchUserEscrows(userPrincipal);
    }
  }, [autoFetch, refetchIfStale, userPrincipal]);

  // Select escrow callback
  const selectEscrow = useCallback((escrow: Escrow | null) => {
    setSelectedEscrow(escrow);
    if (escrow) {
      trackEvent('escrow_details_viewed', { escrow_id: escrow.id.toString() });
    }
  }, []);

  // Set filter callback
  const setFilter = useCallback((filter: EscrowStatusFilter) => {
    setEscrowStatusFilter(filter);
    trackEvent('escrow_filter_changed', { filter_value: filter });
  }, []);

  // Manual refresh callback
  const refresh = useCallback(async () => {
    if (!userPrincipal) return;
    setIsRefreshing(true);
    try {
      await refreshEscrowData(userPrincipal);
    } finally {
      setIsRefreshing(false);
    }
  }, [userPrincipal]);

  // Clear callback
  const clear = useCallback(() => {
    clearEscrowData();
    hasFetchedRef.current = false;
  }, []);

  return {
    escrowState,
    filteredEscrows,
    statusCounts,
    selectedEscrow,
    statusFilter,
    isLoading: escrowState.isLoading,
    isRefreshing,
    refresh,
    selectEscrow,
    setFilter,
    clear,
  };
}

// ============================================================================
// Export Service Object
// ============================================================================

export const EscrowService = {
  fetchUserEscrows,
  fetchEscrowDetails,
  fetchEscrowMilestones,
  refreshEscrowData,
  getEscrowState,
  clear: clearEscrowData,
  isStale: isEscrowStale,
};

export default EscrowService;
