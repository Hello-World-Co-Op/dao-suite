/**
 * Proposals Feature Module
 *
 * Components and hooks for the proposal listing functionality.
 *
 * Story: 9-1-3-proposal-listing
 * Story: 9-1-6-draft-proposal-management (DraftsList)
 */

// Components
export { ProposalCard } from './components/ProposalCard';
export { ProposalFilters } from './components/ProposalFilters';
export { ProposalSort } from './components/ProposalSort';
export { ProposalSearch } from './components/ProposalSearch';
export { Pagination } from './components/Pagination';
export { DraftsList } from './components/DraftsList';

// Hooks
export { useProposalList } from './hooks/useProposalList';

// Re-export types
export type { ProposalCardProps } from './components/ProposalCard';
export type { ProposalFiltersProps } from './components/ProposalFilters';
export type { ProposalSortProps } from './components/ProposalSort';
export type { ProposalSearchProps } from './components/ProposalSearch';
export type { PaginationProps } from './components/Pagination';
export type { DraftsListProps } from './components/DraftsList';
