/**
 * Shared types for state management
 *
 * These types are used across both the dashboard (Epic 9) and game (Epic 10).
 */

// Proposal types
export type ProposalScale = 'small' | 'medium' | 'large';
export type ProposalVertical =
  | 'Housing'
  | 'Food'
  | 'Energy'
  | 'Education'
  | 'Community'
  | 'Infrastructure'
  | 'Other';

// Think Tank output types
export interface BudgetItem {
  category: string;
  amount: number;
  description: string;
}

export interface TimelineItem {
  phase: string;
  duration: string;
  deliverables: string[];
}

export interface RiskItem {
  risk: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface AgentContribution {
  agent: string;
  contribution: string;
}

export interface ThinkTankOutput {
  problemStatement: string;
  proposedSolution: string;
  budgetBreakdown: BudgetItem[];
  timeline: TimelineItem[];
  successMetrics: string[];
  riskAssessment: RiskItem[];
  agentContributions: AgentContribution[];
}

// Vote types
export type VoteChoice = 'yes' | 'no' | 'abstain';

export interface VoteTally {
  yes: number;
  no: number;
  abstain: number;
  totalVotes: number; // Computed: yes + no + abstain
  quorumRequired: number;
  quorumMet: boolean;
  passingThreshold: number; // Percentage needed to pass (e.g., 51)
  lastUpdated: number; // Timestamp for "Last updated X ago"
}

export interface UserVote {
  proposalId: string;
  vote: VoteChoice;
  votedAt: number;
  transactionId?: string; // On-chain proof for vote receipt
}

export interface PendingVote {
  proposalId: string;
  vote: VoteChoice;
  startedAt: number; // When submission started
}

// Proposal List types (Story 9-1-3)
export type ProposalStatus = 'Active' | 'Passed' | 'Failed' | 'Pending';
export type ProposalSort = 'newest' | 'oldest' | 'mostVotes' | 'endingSoon';

export interface ProposalListItem {
  id: string;
  title: string;
  proposer: string; // Principal ID of proposal creator
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  votingEndsAt: number;
  createdAt: number;
}

export interface ProposalFilters {
  status: ProposalStatus[];
  search: string;
  myProposals: boolean; // Filter to proposals created by current user
  notVoted: boolean; // Filter to proposals user hasn't voted on
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProposalStatusCounts {
  Active: number;
  Passed: number;
  Failed: number;
  Pending: number;
}

// Draft status
export type DraftStatus = 'drafting' | 'ai-processing' | 'ready-for-review';

// Draft sort options
export type DraftSort = 'recent' | 'title';

// Current schema version for draft migrations
export const DRAFT_SCHEMA_VERSION = 1;

// Maximum number of drafts allowed per user
export const MAX_DRAFTS = 20;

// Proposal draft
export interface ProposalDraft {
  id: string;
  title: string;
  prompt: string;
  scale: ProposalScale;
  vertical: ProposalVertical;
  thinkTankOutput?: ThinkTankOutput;
  thinkTankRequestId?: string;
  createdAt: number;
  updatedAt: number;
  status: DraftStatus;
  editedSections: (keyof ThinkTankOutput)[];
  // Story 9-1-6: New fields for draft management
  currentStep: number;       // Wizard step for resume (0-indexed)
  userPrincipal: string;     // User scoping for privacy
  schemaVersion: number;     // For future migrations
}
