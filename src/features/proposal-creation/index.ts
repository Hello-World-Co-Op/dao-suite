/**
 * Proposal Creation Feature
 *
 * Exports for the Think Tank proposal creation wizard.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 */

// Components
export { CreateProposalPage } from './components/CreateProposalPage';
export { ProposalWizard } from './components/ProposalWizard';
export { StepPromptInput } from './components/StepPromptInput';
export { StepScaleSelect } from './components/StepScaleSelect';
export { StepVerticalSelect } from './components/StepVerticalSelect';
export { StepProcessing } from './components/StepProcessing';
export { StepReview } from './components/StepReview';
export { EditableSection } from './components/EditableSection';
export { SubmitConfirmation } from './components/SubmitConfirmation';

// Hooks
export { useThinkTank } from './hooks/useThinkTank';
export type {
  UseThinkTankState,
  UseThinkTankActions,
  UseThinkTankReturn,
} from './hooks/useThinkTank';
