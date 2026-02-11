/**
 * Voting Feature
 *
 * Public exports for the voting feature module.
 *
 * Story: 9-1-2-voting-interface
 */

// Components
export { VotingPanel, type VotingPanelProps } from './components/VotingPanel';
export { VoteTally, VoteTallySkeleton, type VoteTallyProps } from './components/VoteTally';
export { VotingCountdown, type VotingCountdownProps } from './components/VotingCountdown';

// Hooks
export { useVoting, type UseVotingOptions, type UseVotingResult } from './hooks/useVoting';
export {
  useVoteTallyPolling,
  type UseVoteTallyPollingOptions,
  type UseVoteTallyPollingResult,
} from './hooks/useVoteTallyPolling';
