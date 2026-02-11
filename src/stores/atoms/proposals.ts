/**
 * Submitted Proposals State Management
 *
 * Mock store for submitted proposals in development mode.
 * Uses localStorage for persistence.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 */

import { persistentAtom } from '@nanostores/persistent';
import { computed } from 'nanostores';
import type { ThinkTankOutput, ProposalScale, ProposalVertical } from '../types';

// Storage keys
const PROPOSALS_STORAGE_KEY = 'hwdao:proposals-v2';

// Proposal status
export type ProposalStatusType = 'pending' | 'active' | 'passed' | 'rejected' | 'expired';

// Submitted proposal interface
export interface SubmittedProposal {
  id: string;
  title: string;
  prompt: string;
  scale: ProposalScale;
  vertical: ProposalVertical;
  thinkTankOutput: ThinkTankOutput;
  thinkTankRequestId: string;
  status: ProposalStatusType;
  votesFor: number;
  votesAgainst: number;
  quorumReached: boolean;
  submittedAt: number;
  votingEnds: number;
}

// Use persistentAtom with JSON encoding for complex objects
export const $proposals = persistentAtom<Record<string, SubmittedProposal>>(
  PROPOSALS_STORAGE_KEY,
  {},
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  }
);

// Computed: List of all proposals sorted by submittedAt (newest first)
export const $proposalsList = computed($proposals, (proposals) => {
  return Object.entries(proposals)
    .map(([key, proposal]) => ({ ...proposal, id: proposal.id ?? key }))
    .sort((a, b) => b.submittedAt - a.submittedAt);
});

// Computed: Active proposals (pending or active status)
export const $activeProposals = computed($proposalsList, (proposals) => {
  return proposals.filter((p) => p.status === 'pending' || p.status === 'active');
});

// Computed: Past proposals (passed, rejected, or expired)
export const $pastProposals = computed($proposalsList, (proposals) => {
  return proposals.filter((p) => p.status === 'passed' || p.status === 'rejected' || p.status === 'expired');
});

/**
 * Add a new proposal to the store
 */
export function addProposal(proposal: Omit<SubmittedProposal, 'submittedAt' | 'votesFor' | 'votesAgainst' | 'quorumReached' | 'votingEnds' | 'status'>): SubmittedProposal {
  const now = Date.now();
  const fullProposal: SubmittedProposal = {
    ...proposal,
    status: 'active',
    votesFor: 0,
    votesAgainst: 0,
    quorumReached: false,
    submittedAt: now,
    votingEnds: now + 7 * 24 * 60 * 60 * 1000, // 7 days from now
  };

  const currentProposals = $proposals.get();
  $proposals.set({ ...currentProposals, [proposal.id]: fullProposal });

  return fullProposal;
}

/**
 * Get a proposal by ID
 */
export function getProposal(id: string): SubmittedProposal | null {
  const proposals = $proposals.get();
  return proposals[id] ?? null;
}

/**
 * Update proposal status
 */
export function updateProposalStatus(id: string, status: ProposalStatusType): boolean {
  const proposals = $proposals.get();
  if (!proposals[id]) return false;

  $proposals.set({ ...proposals, [id]: { ...proposals[id], status } });
  return true;
}

/**
 * Add a vote to a proposal (mock)
 */
export function addVote(id: string, voteFor: boolean): boolean {
  const proposals = $proposals.get();
  if (!proposals[id]) return false;

  const proposal = proposals[id];
  const updated = {
    ...proposal,
    votesFor: voteFor ? proposal.votesFor + 1 : proposal.votesFor,
    votesAgainst: voteFor ? proposal.votesAgainst : proposal.votesAgainst + 1,
  };

  $proposals.set({ ...proposals, [id]: updated });
  return true;
}

/**
 * Clear all proposals (for testing)
 */
export function clearAllProposals(): void {
  $proposals.set({});
}
