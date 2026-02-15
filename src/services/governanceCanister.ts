/**
 * Governance Canister Service
 *
 * Client for interacting with the governance canister on ICP.
 * Handles proposal submission, status queries, and voting.
 *
 * Story: 9-1-1-think-tank-proposal-creation (proposal submission)
 * Story: 9-1-2-voting-interface (voting methods)
 */

import { z } from 'zod';
import {
  addProposal,
  addVote as addVoteToStore,
  getProposal as getProposalFromStore,
  $proposals,
  type ThinkTankOutput,
  type ProposalScale,
  type ProposalVertical,
  type VoteChoice,
  type VoteTally,
  type UserVote,
  type ProposalListItem,
  type ProposalFilters,
  type ProposalSort,
  type PaginatedResponse,
  type ProposalStatusCounts,
} from '@/stores';

// Types for canister interactions
export interface SubmitProposalRequest {
  title: string;
  prompt: string;
  scale: ProposalScale;
  vertical: ProposalVertical;
  thinkTankOutput: ThinkTankOutput;
  thinkTankRequestId: string;
}

export interface SubmitProposalResponse {
  success: boolean;
  proposalId?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface ProposalStatus {
  id: string;
  status: 'pending' | 'active' | 'passed' | 'rejected' | 'expired' | 'withdrawn';
  votesFor: number;
  votesAgainst: number;
  quorumReached: boolean;
  votingEnds: number;
}

// Vote error codes
export type VoteErrorCode =
  | 'ALREADY_VOTED'
  | 'VOTING_CLOSED'
  | 'NOT_MEMBER'
  | 'MEMBERSHIP_EXPIRED'
  | 'PROPOSAL_CANCELED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'INVALID_PROPOSAL';

export interface CastVoteResponse {
  success: boolean;
  transactionId?: string;
  error?: {
    code: VoteErrorCode;
    message: string;
  };
}

// Timeout configuration
const CANISTER_CALL_TIMEOUT_MS = 15000; // 15 seconds
const PROPOSAL_LIST_TIMEOUT_MS = 5000; // 5 seconds for proposal listing (Story 9-1-3)
const PAGE_SIZE = 20; // Items per page for pagination

// Zod schema for ProposalListItem validation (Story 9-1-3)
const ProposalListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  proposer: z.string(),
  status: z.enum(['Active', 'Passed', 'Failed', 'Pending']),
  votesFor: z.number(),
  votesAgainst: z.number(),
  votesAbstain: z.number(),
  votingEndsAt: z.number(),
  createdAt: z.number(),
});

const PaginatedProposalResponseSchema = z.object({
  items: z.array(ProposalListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

const ProposalStatusCountsSchema = z.object({
  Active: z.number(),
  Passed: z.number(),
  Failed: z.number(),
  Pending: z.number(),
});

// Custom error types
export class TimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

// Canister configuration
const GOVERNANCE_CANISTER_ID = import.meta.env.VITE_GOVERNANCE_CANISTER_ID || '';

/**
 * Check if we're in a mock/development environment
 */
function isMockMode(): boolean {
  return !GOVERNANCE_CANISTER_ID || import.meta.env.DEV;
}

/**
 * Create structured log entry
 */
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'GovernanceCanister',
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
 * Mock submission for development
 */
async function mockSubmitProposal(request: SubmitProposalRequest): Promise<SubmitProposalResponse> {
  log('info', 'Mock proposal submission', { title: request.title });

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Simulate occasional failures for testing (disabled for now to test flow)
  // if (Math.random() < 0.1) {
  //   return {
  //     success: false,
  //     error: {
  //       code: 'MOCK_ERROR',
  //       message: 'Simulated submission failure for testing',
  //     },
  //   };
  // }

  const proposalId = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Store the proposal in the mock store
  addProposal({
    id: proposalId,
    title: request.title,
    prompt: request.prompt,
    scale: request.scale,
    vertical: request.vertical,
    thinkTankOutput: request.thinkTankOutput,
    thinkTankRequestId: request.thinkTankRequestId,
  });

  return {
    success: true,
    proposalId,
  };
}

/**
 * Submit a proposal to the governance canister
 */
export async function submitProposal(
  request: SubmitProposalRequest
): Promise<SubmitProposalResponse> {
  log('info', 'Submitting proposal', { title: request.title, scale: request.scale });

  // Use mock mode in development
  if (isMockMode()) {
    return mockSubmitProposal(request);
  }

  try {
    // TODO: Replace with actual IC Agent call when @dfinity/agent is configured
    // const agent = new HttpAgent({ host: IC_HOST });
    // const actor = Actor.createActor(idlFactory, {
    //   agent,
    //   canisterId: GOVERNANCE_CANISTER_ID,
    // });
    // const result = await actor.submit_proposal({
    //   title: request.title,
    //   description: request.prompt,
    //   scale: request.scale,
    //   vertical: request.vertical,
    //   think_tank_output: request.thinkTankOutput,
    //   think_tank_request_id: request.thinkTankRequestId,
    // });

    // For now, use mock
    return mockSubmitProposal(request);
  } catch (error) {
    log('error', 'Proposal submission failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: {
        code: 'SUBMISSION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to submit proposal',
      },
    };
  }
}

/**
 * Get proposal status by ID
 */
export async function getProposalStatus(proposalId: string): Promise<ProposalStatus | null> {
  log('info', 'Fetching proposal status', { proposalId });

  if (isMockMode()) {
    // Mock response - return active status to enable voting in demo mode
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      id: proposalId,
      status: 'active',
      votesFor: 0,
      votesAgainst: 0,
      quorumReached: false,
      votingEnds: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  try {
    // TODO: Replace with actual canister call
    // For now, use mock response until canister interface is ready
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      id: proposalId,
      status: 'active',
      votesFor: 0,
      votesAgainst: 0,
      quorumReached: false,
      votingEnds: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  } catch (error) {
    log('error', 'Failed to fetch proposal status', {
      proposalId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// Mock vote storage (in-memory for development)
const mockUserVotes: Record<string, Record<string, UserVote>> = {};

/**
 * Helper to create timeout promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Validate VoteTally response shape
 */
function isValidVoteTally(data: unknown): data is VoteTally {
  if (!data || typeof data !== 'object') return false;
  const tally = data as Record<string, unknown>;
  return (
    typeof tally.yes === 'number' &&
    typeof tally.no === 'number' &&
    typeof tally.abstain === 'number' &&
    typeof tally.quorumRequired === 'number' &&
    typeof tally.quorumMet === 'boolean' &&
    typeof tally.passingThreshold === 'number'
  );
}

/**
 * Mock castVote for development
 */
async function mockCastVote(proposalId: string, vote: VoteChoice): Promise<CastVoteResponse> {
  log('info', 'Mock vote cast', { proposalId, vote });

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Check if proposal exists in mock store
  const proposal = getProposalFromStore(proposalId);
  if (!proposal) {
    return {
      success: false,
      error: {
        code: 'INVALID_PROPOSAL',
        message: 'Proposal not found.',
      },
    };
  }

  // Check if already voted
  const userId = 'mock-user'; // In real app, would use principal
  if (mockUserVotes[userId]?.[proposalId]) {
    return {
      success: false,
      error: {
        code: 'ALREADY_VOTED',
        message: 'You have already voted on this proposal. Votes are final and cannot be changed.',
      },
    };
  }

  // Check if voting is still open (mock: always open for active proposals)
  if (proposal.status !== 'active') {
    return {
      success: false,
      error: {
        code: 'VOTING_CLOSED',
        message: 'Voting has ended for this proposal.',
      },
    };
  }

  // Store the vote
  if (!mockUserVotes[userId]) {
    mockUserVotes[userId] = {};
  }

  const transactionId = `vote-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const userVote: UserVote = {
    proposalId,
    vote,
    votedAt: Date.now(),
    transactionId,
  };
  mockUserVotes[userId][proposalId] = userVote;

  // Update proposal votes in store
  addVoteToStore(proposalId, vote === 'yes');

  return {
    success: true,
    transactionId,
  };
}

/**
 * Cast a vote on a proposal
 *
 * @param proposalId - ID of the proposal to vote on
 * @param vote - Vote choice: 'yes', 'no', or 'abstain'
 * @returns Promise resolving to the vote result
 */
export async function castVote(proposalId: string, vote: VoteChoice): Promise<CastVoteResponse> {
  log('info', 'Casting vote', { proposalId, vote });

  if (isMockMode()) {
    return withTimeout(mockCastVote(proposalId, vote), CANISTER_CALL_TIMEOUT_MS);
  }

  try {
    // TODO: Replace with actual IC Agent call
    return await withTimeout(mockCastVote(proposalId, vote), CANISTER_CALL_TIMEOUT_MS);
  } catch (error) {
    log('error', 'Vote cast failed', {
      proposalId,
      vote,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          error instanceof Error && error.message === 'Request timeout'
            ? 'Vote request timed out. Please check your connection and try again.'
            : 'Failed to cast vote. Please try again.',
      },
    };
  }
}

/**
 * Get user's vote on a proposal
 *
 * @param proposalId - ID of the proposal
 * @returns Promise resolving to the user's vote or null if not voted
 */
export async function getUserVote(proposalId: string): Promise<UserVote | null> {
  log('info', 'Fetching user vote', { proposalId });

  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const userId = 'mock-user';
    const vote = mockUserVotes[userId]?.[proposalId] ?? null;
    return vote;
  }

  try {
    // TODO: Replace with actual canister call
    await new Promise((resolve) => setTimeout(resolve, 300));
    const userId = 'mock-user';
    return mockUserVotes[userId]?.[proposalId] ?? null;
  } catch (error) {
    log('error', 'Failed to fetch user vote', {
      proposalId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Get vote tally for a proposal
 *
 * @param proposalId - ID of the proposal
 * @returns Promise resolving to the vote tally
 */
export async function getVoteTally(proposalId: string): Promise<VoteTally> {
  log('info', 'Fetching vote tally', { proposalId });

  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get proposal from store to calculate tally
    const proposal = getProposalFromStore(proposalId);
    const votesFor = proposal?.votesFor ?? 0;
    const votesAgainst = proposal?.votesAgainst ?? 0;
    const abstain = 0; // Mock: no abstain tracking in current proposal store

    const tally: VoteTally = {
      yes: votesFor,
      no: votesAgainst,
      abstain,
      totalVotes: votesFor + votesAgainst + abstain,
      quorumRequired: 10, // Mock: 10 votes needed for quorum
      quorumMet: votesFor + votesAgainst + abstain >= 10,
      passingThreshold: 51, // 51% needed to pass
      lastUpdated: Date.now(),
    };

    return tally;
  }

  try {
    // TODO: Replace with actual canister call
    const response = await withTimeout(
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const proposal = getProposalFromStore(proposalId);
        const votesFor = proposal?.votesFor ?? 0;
        const votesAgainst = proposal?.votesAgainst ?? 0;
        const abstain = 0;
        return {
          yes: votesFor,
          no: votesAgainst,
          abstain,
          totalVotes: votesFor + votesAgainst + abstain,
          quorumRequired: 10,
          quorumMet: votesFor + votesAgainst + abstain >= 10,
          passingThreshold: 51,
          lastUpdated: Date.now(),
        };
      })(),
      CANISTER_CALL_TIMEOUT_MS
    );

    if (!isValidVoteTally(response)) {
      throw new Error('Invalid vote tally response structure');
    }

    return response;
  } catch (error) {
    log('error', 'Failed to fetch vote tally', {
      proposalId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Return empty tally on error
    return {
      yes: 0,
      no: 0,
      abstain: 0,
      totalVotes: 0,
      quorumRequired: 10,
      quorumMet: false,
      passingThreshold: 51,
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Verify vote status (used after reconnection to ensure consistency)
 *
 * @param proposalId - ID of the proposal
 * @returns Promise resolving to the user's vote or null
 */
export async function verifyVoteStatus(proposalId: string): Promise<UserVote | null> {
  log('info', 'Verifying vote status', { proposalId });

  // This is a verification call - always check actual state
  // In production, this would bypass any caching
  return getUserVote(proposalId);
}

// Mock proposal list data for development (Story 9-1-3) — empty until canister integration
const mockProposalList: ProposalListItem[] = [];

/**
 * Helper to create AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  timeoutId: NodeJS.Timeout;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

/**
 * Execute promise with AbortController timeout
 */
async function withAbortTimeout<T>(
  promiseFn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const { controller, timeoutId } = createTimeoutController(timeoutMs);

  try {
    const result = await promiseFn(controller.signal);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Get user-created proposals from localStorage and convert to ProposalListItem format
 */
function getUserCreatedProposals(): ProposalListItem[] {
  const storedProposals = $proposals.get();
  return Object.values(storedProposals).map((proposal) => {
    // Map internal status to list status format
    const statusMap: Record<string, 'Active' | 'Passed' | 'Failed' | 'Pending'> = {
      active: 'Active',
      passed: 'Passed',
      rejected: 'Failed',
      expired: 'Failed',
      pending: 'Pending',
    };

    return {
      id: proposal.id,
      title: proposal.title,
      proposer: 'mock-user', // Current user created this proposal
      status: statusMap[proposal.status] || 'Active',
      votesFor: proposal.votesFor,
      votesAgainst: proposal.votesAgainst,
      votesAbstain: 0,
      votingEndsAt: proposal.votingEnds,
      createdAt: proposal.submittedAt,
    };
  });
}

/**
 * Get all proposals (mock + user-created)
 */
function getAllProposals(): ProposalListItem[] {
  const userProposals = getUserCreatedProposals();
  // Combine user-created proposals with mock data, user proposals first
  // Filter out any mock proposals that might have the same ID
  const userProposalIds = new Set(userProposals.map((p) => p.id));
  const filteredMockProposals = mockProposalList.filter((p) => !userProposalIds.has(p.id));
  return [...userProposals, ...filteredMockProposals];
}

/**
 * Filter and sort mock proposals based on filters and sort options
 */
function filterAndSortProposals(
  proposals: ProposalListItem[],
  filters: ProposalFilters,
  sort: ProposalSort,
  currentUserPrincipal?: string,
  votedProposalIds?: Set<string>
): ProposalListItem[] {
  let filtered = [...proposals];

  // Filter by status
  if (filters.status.length > 0) {
    filtered = filtered.filter((p) => filters.status.includes(p.status));
  }

  // Filter by search text (title)
  if (filters.search && filters.search.length >= 2) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter((p) => p.title.toLowerCase().includes(searchLower));
  }

  // Filter by "My Proposals"
  if (filters.myProposals && currentUserPrincipal) {
    filtered = filtered.filter((p) => p.proposer === currentUserPrincipal);
  }

  // Filter by "Not Voted"
  if (filters.notVoted && votedProposalIds) {
    filtered = filtered.filter((p) => !votedProposalIds.has(p.id));
  }

  // Sort
  switch (sort) {
    case 'newest':
      filtered.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'oldest':
      filtered.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case 'mostVotes':
      filtered.sort((a, b) => {
        const totalA = a.votesFor + a.votesAgainst + a.votesAbstain;
        const totalB = b.votesFor + b.votesAgainst + b.votesAbstain;
        return totalB - totalA;
      });
      break;
    case 'endingSoon':
      // Active proposals first, sorted by soonest deadline
      filtered.sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (a.status !== 'Active' && b.status === 'Active') return 1;
        return a.votingEndsAt - b.votingEndsAt;
      });
      break;
  }

  return filtered;
}

/**
 * Get paginated list of proposals with filters and sorting
 *
 * Story: 9-1-3 (AC-1, AC-2, AC-3, AC-4, AC-5, AC-8, AC-9)
 *
 * @param filters - Filter criteria (status, search, myProposals, notVoted)
 * @param sort - Sort option (newest, oldest, mostVotes, endingSoon)
 * @param page - Page number (1-indexed)
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to paginated proposal list
 */
export async function getProposals(
  filters: ProposalFilters,
  sort: ProposalSort,
  page: number,
  signal?: AbortSignal
): Promise<PaginatedResponse<ProposalListItem>> {
  log('info', 'Fetching proposals', { filters, sort, page });

  const fetchProposals = async (
    abortSignal: AbortSignal
  ): Promise<PaginatedResponse<ProposalListItem>> => {
    // Simulate network delay
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(resolve, 500);
      abortSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Request aborted', 'AbortError'));
      });
    });

    // Get all proposals (user-created + mock)
    const allProposals = getAllProposals();
    const currentUserPrincipal = 'mock-user';
    const votedProposalIds = new Set(Object.keys(mockUserVotes[currentUserPrincipal] || {}));

    const filtered = filterAndSortProposals(
      allProposals,
      filters,
      sort,
      currentUserPrincipal,
      votedProposalIds
    );

    // Paginate
    const startIndex = (page - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const paginatedItems = filtered.slice(startIndex, endIndex);

    const response: PaginatedResponse<ProposalListItem> = {
      items: paginatedItems,
      total: filtered.length,
      page,
      pageSize: PAGE_SIZE,
    };

    // Validate response schema
    const parseResult = PaginatedProposalResponseSchema.safeParse(response);
    if (!parseResult.success) {
      throw new SchemaValidationError(`Invalid response schema: ${parseResult.error.message}`);
    }

    return response;
  };

  try {
    if (signal) {
      // Use provided signal
      return await fetchProposals(signal);
    } else {
      // Create our own timeout
      return await withAbortTimeout(fetchProposals, PROPOSAL_LIST_TIMEOUT_MS);
    }
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof SchemaValidationError) {
      throw error;
    }
    log('error', 'Failed to fetch proposals', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Return empty result on error (graceful degradation)
    return {
      items: [],
      total: 0,
      page,
      pageSize: PAGE_SIZE,
    };
  }
}

/**
 * Get total count of proposals matching filters
 *
 * Story: 9-1-3 (AC-5)
 */
export async function getTotalProposalCount(filters: ProposalFilters): Promise<number> {
  log('info', 'Fetching proposal count', { filters });

  if (isMockMode()) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const currentUserPrincipal = 'mock-user';
    const votedProposalIds = new Set(Object.keys(mockUserVotes[currentUserPrincipal] || {}));
    const filtered = filterAndSortProposals(
      mockProposalList,
      filters,
      'newest',
      currentUserPrincipal,
      votedProposalIds
    );
    return filtered.length;
  }

  // TODO: Replace with actual canister call
  return 0;
}

/**
 * Get counts of proposals by status (for filter badges)
 *
 * Story: 9-1-3 (Task 1.9)
 */
export async function getProposalCountsByStatus(): Promise<ProposalStatusCounts> {
  log('info', 'Fetching proposal counts by status');

  try {
    return await withAbortTimeout(async () => {
      if (isMockMode()) {
        await new Promise((resolve) => setTimeout(resolve, 300));

        const counts: ProposalStatusCounts = {
          Active: 0,
          Passed: 0,
          Failed: 0,
          Pending: 0,
        };

        for (const proposal of mockProposalList) {
          counts[proposal.status]++;
        }

        // Validate response schema
        const parseResult = ProposalStatusCountsSchema.safeParse(counts);
        if (!parseResult.success) {
          throw new SchemaValidationError(
            `Invalid status counts schema: ${parseResult.error.message}`
          );
        }

        return counts;
      }

      // TODO: Replace with actual canister call
      return { Active: 0, Passed: 0, Failed: 0, Pending: 0 };
    }, PROPOSAL_LIST_TIMEOUT_MS);
  } catch (error) {
    log('error', 'Failed to fetch proposal counts', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Return zero counts on error
    return { Active: 0, Passed: 0, Failed: 0, Pending: 0 };
  }
}

/**
 * Service object for convenient access
 */
export const GovernanceCanisterService = {
  submitProposal,
  getProposalStatus,
  castVote,
  getUserVote,
  getVoteTally,
  verifyVoteStatus,
  // Story 9-1-3: Proposal listing methods
  getProposals,
  getTotalProposalCount,
  getProposalCountsByStatus,
};

export default GovernanceCanisterService;
