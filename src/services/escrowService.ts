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
import { HttpAgent, Actor } from '@dfinity/agent';
import { IDL } from '@dfinity/candid';
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

/** IC host for agent connections */
const IC_HOST = import.meta.env.VITE_IC_HOST || 'https://ic0.app';

/**
 * Minimal inline IDL for escrow-related methods on the treasury canister.
 */
const TokenTypeIDL = IDL.Variant({ ICP: IDL.Null, DOM: IDL.Null });
const EscrowStatusIDL = IDL.Variant({
  Active: IDL.Null,
  Released: IDL.Null,
  Cancelled: IDL.Null,
  Expired: IDL.Null,
});
const MilestoneStatusIDL = IDL.Variant({
  Pending: IDL.Null,
  Approved: IDL.Null,
  Released: IDL.Null,
  Disputed: IDL.Null,
  Cancelled: IDL.Null,
});
const ReleaseAuthorityIDL = IDL.Variant({
  Controller: IDL.Null,
  Governance: IDL.Null,
  SpecificPrincipal: IDL.Principal,
});
const MilestoneIDL = IDL.Record({
  name: IDL.Text,
  amount: IDL.Nat,
  description: IDL.Text,
  deadline: IDL.Nat64,
  status: MilestoneStatusIDL,
  dispute_reason: IDL.Opt(IDL.Text),
  approved_at: IDL.Opt(IDL.Nat64),
  released_at: IDL.Opt(IDL.Nat64),
  tx_id: IDL.Opt(IDL.Text),
});
const EscrowIDL = IDL.Record({
  id: IDL.Nat64,
  recipient: IDL.Principal,
  amount: IDL.Nat,
  released_amount: IDL.Nat,
  token_type: TokenTypeIDL,
  conditions: IDL.Text,
  release_authority: ReleaseAuthorityIDL,
  status: EscrowStatusIDL,
  created_at: IDL.Nat64,
  expiry: IDL.Nat64,
  milestones: IDL.Vec(MilestoneIDL),
});
const escrowIdl = IDL.Service({
  list_escrows: IDL.Func(
    [IDL.Opt(EscrowStatusIDL)],
    [IDL.Vec(EscrowIDL)],
    ['query'],
  ),
  get_escrow: IDL.Func(
    [IDL.Nat64],
    [IDL.Opt(EscrowIDL)],
    ['query'],
  ),
  get_milestone_status: IDL.Func(
    [IDL.Nat64],
    [IDL.Variant({ Ok: IDL.Vec(MilestoneIDL), Err: IDL.Text })],
    ['query'],
  ),
});

/**
 * Extract the key from a Candid variant object, e.g. { Active: null } → 'Active'
 */
function extractVariant(variant: Record<string, unknown>): string {
  return Object.keys(variant)[0];
}

/**
 * Map a Candid Milestone record to the store Milestone type
 */
function mapMilestone(m: Record<string, unknown>): Milestone {
  return {
    name: m.name as string,
    description: m.description as string,
    amount: m.amount as bigint,
    deadline: m.deadline as bigint,
    status: extractVariant(m.status as Record<string, unknown>) as Milestone['status'],
    approved_at: (m.approved_at as bigint[])[0],
    released_at: (m.released_at as bigint[])[0],
    dispute_reason: (m.dispute_reason as string[])[0],
    tx_id: (m.tx_id as string[])[0],
  };
}

/**
 * Map a Candid ReleaseAuthority variant to the store type.
 * Candid: { Controller: null } | { Governance: null } | { SpecificPrincipal: Principal }
 * Store:  { Controller: null } | { Governance: null } | { SpecificPrincipal: string }
 */
function mapReleaseAuthority(ra: Record<string, unknown>): Escrow['release_authority'] {
  if ('SpecificPrincipal' in ra) {
    return { SpecificPrincipal: (ra.SpecificPrincipal as { toText(): string }).toText() };
  }
  if ('Controller' in ra) return { Controller: null };
  return { Governance: null };
}

/**
 * Map a Candid Escrow record to the store Escrow type
 */
function mapEscrow(e: Record<string, unknown>): Escrow {
  return {
    id: e.id as bigint,
    recipient: (e.recipient as { toText(): string }).toText(),
    amount: e.amount as bigint,
    released_amount: e.released_amount as bigint,
    token_type: extractVariant(e.token_type as Record<string, unknown>) as Escrow['token_type'],
    conditions: e.conditions as string,
    release_authority: mapReleaseAuthority(e.release_authority as Record<string, unknown>),
    status: extractVariant(e.status as Record<string, unknown>) as Escrow['status'],
    created_at: e.created_at as bigint,
    expiry: e.expiry as bigint,
    milestones: (e.milestones as Record<string, unknown>[]).map(mapMilestone),
  };
}

/**
 * Check if we're in mock/development mode
 */
function isMockMode(): boolean {
  return !TREASURY_CANISTER_ID;
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
  void escrowId;
  await sleep(300);

  return mockEscrows.find((e) => e.id === escrowId) || null;
}

/**
 * Mock get milestone status for development
 */
async function mockGetMilestoneStatus(escrowId: bigint): Promise<Milestone[] | null> {
  void escrowId;
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

  const agent = HttpAgent.createSync({ host: IC_HOST });
  const actor = Actor.createActor(() => escrowIdl, {
    agent,
    canisterId: TREASURY_CANISTER_ID,
  });

  // Fetch all escrows (no status filter), then filter client-side by recipient
  const raw = (await actor.list_escrows([])) as Record<string, unknown>[];
  const all = raw.map(mapEscrow);
  return all.filter((e) => e.recipient === userPrincipal);
}

/**
 * Fetch single escrow by ID from treasury canister
 */
async function fetchEscrowFromCanister(escrowId: bigint): Promise<Escrow | null> {
  if (isMockMode()) {
    return mockGetEscrow(escrowId);
  }

  const agent = HttpAgent.createSync({ host: IC_HOST });
  const actor = Actor.createActor(() => escrowIdl, {
    agent,
    canisterId: TREASURY_CANISTER_ID,
  });

  // Candid opt returns [] (none) or [value] (some)
  const result = (await actor.get_escrow(escrowId)) as Record<string, unknown>[];
  if (result.length === 0) return null;
  return mapEscrow(result[0]);
}

/**
 * Fetch milestones for an escrow from treasury canister
 */
async function fetchMilestonesFromCanister(escrowId: bigint): Promise<Milestone[] | null> {
  if (isMockMode()) {
    return mockGetMilestoneStatus(escrowId);
  }

  const agent = HttpAgent.createSync({ host: IC_HOST });
  const actor = Actor.createActor(() => escrowIdl, {
    agent,
    canisterId: TREASURY_CANISTER_ID,
  });

  const result = (await actor.get_milestone_status(escrowId)) as Record<string, unknown>;
  if ('Err' in result) throw new Error(String(result.Err));
  return (result.Ok as Record<string, unknown>[]).map(mapMilestone);
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Fetch user's escrows with retry logic
 */
export async function fetchUserEscrows(userPrincipal: string): Promise<FetchEscrowsResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      setEscrowLoading(true);

      const escrows = await withTimeout(
        fetchEscrowsFromCanister(userPrincipal),
        REQUEST_TIMEOUT_MS
      );

      setUserEscrows(escrows);
      return { success: true, escrows };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await sleep(getBackoffDelay(attempt));
      }
    }
  }

  const errorMessage = lastError?.message || 'Failed to fetch escrow data';
  setEscrowError(errorMessage);
  console.error(`EscrowService: fetch failed — ${errorMessage}`);
  return { success: false, error: errorMessage };
}

/**
 * Fetch single escrow details
 */
export async function fetchEscrowDetails(escrowId: bigint): Promise<FetchEscrowDetailsResult> {
  try {
    const escrow = await withTimeout(fetchEscrowFromCanister(escrowId), REQUEST_TIMEOUT_MS);

    if (!escrow) {
      return { success: false, error: 'Escrow not found' };
    }

    return { success: true, escrow };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`EscrowService: details fetch failed for ${escrowId} — ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch milestones for an escrow
 */
export async function fetchEscrowMilestones(escrowId: bigint): Promise<FetchMilestonesResult> {
  try {
    const milestones = await withTimeout(fetchMilestonesFromCanister(escrowId), REQUEST_TIMEOUT_MS);

    if (milestones === null) {
      return { success: false, error: 'Escrow not found' };
    }

    return { success: true, milestones };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`EscrowService: milestones fetch failed for ${escrowId} — ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Refresh escrow data (for manual refresh)
 */
export async function refreshEscrowData(userPrincipal: string): Promise<FetchEscrowsResult> {
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
