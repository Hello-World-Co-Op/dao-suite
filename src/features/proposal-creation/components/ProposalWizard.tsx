/**
 * Proposal Wizard Container
 *
 * Multi-step form orchestrating the Think Tank proposal creation flow.
 * Manages step navigation, state persistence, and draft management.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * Story: 9-1-6-draft-proposal-management (save, resume, auto-save)
 * AC: 1, 2, 4 (9-1-6)
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  $currentDraft,
  $isSaving,
  $lastSavedAt,
  $hasPendingChanges,
  $saveError,
  createDraft,
  updateDraft,
  updateDraftDebounced,
  flushPendingSave,
  updateOutputSection,
  getDraftForUser,
  clearSaveError,
  persistDraft,
  type ProposalDraft,
  showSuccess,
  showError,
} from '@/stores';
import type { ThinkTankOutput, ProposalScale, ProposalVertical } from '@/stores';
import { useThinkTank } from '../hooks/useThinkTank';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import {
  trackDraftCreated,
  trackDraftSaved,
  trackDraftSubmitted,
  trackGenerationStarted,
  trackGenerationCompleted,
  trackGenerationFailed,
  trackSectionRefined,
  trackSectionEdited,
} from '../../../utils/posthog';
import { StepPromptInput } from './StepPromptInput';
import { StepScaleSelect } from './StepScaleSelect';
import { StepVerticalSelect } from './StepVerticalSelect';
import { StepProcessing } from './StepProcessing';
import { StepReview } from './StepReview';
import { Button } from '../../../components/ui/button';

type WizardStep = 'prompt' | 'scale' | 'vertical' | 'processing' | 'review';

interface ProposalWizardProps {
  /** Draft ID to resume editing (from route param) */
  draftId?: string;
  /** User's principal for draft ownership */
  userPrincipal?: string;
  /** Callback when proposal is ready for submission */
  onComplete: (draftId: string) => void;
  /** Callback when user cancels wizard */
  onCancel: () => void;
}

const STEP_ORDER: WizardStep[] = ['prompt', 'scale', 'vertical', 'processing', 'review'];

const STEP_LABELS: Record<WizardStep, string> = {
  prompt: 'Describe',
  scale: 'Scale',
  vertical: 'Category',
  processing: 'Generate',
  review: 'Review',
};

// Map step name to index (0-based)
const stepToIndex = (step: WizardStep): number => STEP_ORDER.indexOf(step);
const indexToStep = (index: number): WizardStep =>
  STEP_ORDER[Math.min(Math.max(0, index), STEP_ORDER.length - 1)];

export function ProposalWizard({
  draftId,
  userPrincipal = '',
  onComplete,
  onCancel,
}: ProposalWizardProps) {
  const currentDraft = useStore($currentDraft);
  const isSaving = useStore($isSaving);
  const lastSavedAt = useStore($lastSavedAt);
  const hasPendingChanges = useStore($hasPendingChanges);
  const saveError = useStore($saveError);
  const { isOnline } = useNetworkStatus();

  const {
    isGenerating,
    isRefining,
    status,
    estimatedTime,
    output,
    error,
    generate,
    refine,
    retry,
    reset: resetThinkTank,
  } = useThinkTank();

  // Determine current step based on draft state
  const [currentStep, setCurrentStep] = React.useState<WizardStep>('prompt');
  const [localDraft, setLocalDraft] = React.useState<ProposalDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasPersistedRef = useRef(false);

  // Initialize draft on mount
  useEffect(() => {
    const initDraft = async () => {
      setIsLoading(true);
      setLoadError(null);

      // Small delay to allow persistent store hydration
      await new Promise((resolve) => setTimeout(resolve, 100));

      // If resuming an existing draft
      if (draftId) {
        const draft = getDraftForUser(draftId, userPrincipal);
        if (draft) {
          setLocalDraft(draft);
          // Restore step from draft's currentStep field (clamp to valid range)
          const restoredStep = indexToStep(draft.currentStep);
          // Don't restore to 'processing' step - go to previous step
          if (restoredStep === 'processing') {
            setCurrentStep('vertical');
          } else {
            setCurrentStep(restoredStep);
          }
          hasPersistedRef.current = true;
        } else {
          setLoadError('Draft not found or access denied');
        }
      } else if (currentDraft) {
        // Use existing draft from store
        setLocalDraft(currentDraft);
        hasPersistedRef.current = true;
      } else {
        // Create new draft but don't persist until first meaningful input
        const newDraft = createDraft(undefined, userPrincipal, false);
        setLocalDraft(newDraft);
        hasPersistedRef.current = false;
        // Track draft creation (will be persisted on first meaningful input)
        if (newDraft) {
          trackDraftCreated(newDraft.id);
        }
      }

      setIsLoading(false);
    };

    initDraft();
  }, [draftId, userPrincipal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local draft with store updates
  useEffect(() => {
    if (currentDraft && currentDraft.id === localDraft?.id) {
      setLocalDraft(currentDraft);
    }
  }, [currentDraft, localDraft?.id]);

  // Update step based on generation status
  useEffect(() => {
    if (isGenerating && status) {
      setCurrentStep('processing');
    } else if (output && currentStep === 'processing') {
      setCurrentStep('review');
    }
  }, [isGenerating, status, output, currentStep]);

  // Flush pending save on unmount (9-1-5 pattern)
  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, []);

  // Beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges) {
        e.preventDefault();
        // Modern browsers ignore custom message but still require returnValue to be set
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingChanges]);

  // Auto-save current step
  const saveCurrentStep = useCallback((draft: ProposalDraft, step: WizardStep) => {
    updateDraftDebounced(draft.id, { currentStep: stepToIndex(step) });
  }, []);

  const getStepIndex = (step: WizardStep) => STEP_ORDER.indexOf(step);

  // Format last saved time
  const formatLastSaved = useCallback((timestamp: number | null): string => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }, []);

  // Persist draft on first meaningful input (synchronous to avoid race conditions)
  const ensurePersisted = useCallback((draft: ProposalDraft) => {
    if (!hasPersistedRef.current) {
      if (persistDraft(draft)) {
        hasPersistedRef.current = true;
      }
    }
  }, []);

  // Manual save handler
  const handleManualSave = useCallback(() => {
    const draft = localDraft ?? currentDraft;
    if (!draft) return;

    // Ensure draft is persisted (for new drafts that haven't been auto-saved yet)
    ensurePersisted(draft);
    // Flush any pending debounced changes
    flushPendingSave();
    // Save current step
    updateDraft(draft.id, { currentStep: stepToIndex(currentStep) });
    showSuccess('Draft saved');
    trackDraftSaved(draft.id, stepToIndex(currentStep));
  }, [localDraft, currentDraft, currentStep, ensurePersisted]);

  const handlePromptNext = useCallback(
    (prompt: string) => {
      const draft = localDraft ?? currentDraft;
      if (draft) {
        // Derive title from prompt
        const maxLen = 60;
        let title = prompt.trim();
        if (title.length > maxLen) {
          title = title.substring(0, maxLen);
          const lastSpace = title.lastIndexOf(' ');
          if (lastSpace > 30) {
            title = title.substring(0, lastSpace);
          }
          title = title + '...';
        }

        // This is meaningful input - persist draft
        ensurePersisted(draft);
        updateDraft(draft.id, { prompt, title, currentStep: 1 });
      }
      setCurrentStep('scale');
    },
    [localDraft, currentDraft, ensurePersisted]
  );

  const handleScaleNext = useCallback(
    (scale: ProposalScale) => {
      const draft = localDraft ?? currentDraft;
      if (draft) {
        updateDraft(draft.id, { scale, currentStep: 2 });
      }
      setCurrentStep('vertical');
    },
    [localDraft, currentDraft]
  );

  // Auto-save handlers for each step (triggered on value change)
  const handlePromptChange = useCallback(
    (prompt: string) => {
      const draft = localDraft ?? currentDraft;
      if (draft) {
        // Derive title from prompt
        const maxLen = 60;
        let title = prompt.trim();
        if (title.length > maxLen) {
          title = title.substring(0, maxLen);
          const lastSpace = title.lastIndexOf(' ');
          if (lastSpace > 30) {
            title = title.substring(0, lastSpace);
          }
          title = title + '...';
        }
        // Persist draft with title on first meaningful input
        const draftWithTitle = { ...draft, prompt, title };
        ensurePersisted(draftWithTitle);
        updateDraftDebounced(draft.id, { prompt, title });
      }
    },
    [localDraft, currentDraft, ensurePersisted]
  );

  const handleScaleChange = useCallback(
    (scale: ProposalScale) => {
      const draft = localDraft ?? currentDraft;
      if (draft) {
        updateDraftDebounced(draft.id, { scale });
      }
    },
    [localDraft, currentDraft]
  );

  const handleVerticalChange = useCallback(
    (vertical: ProposalVertical) => {
      const draft = localDraft ?? currentDraft;
      if (draft) {
        updateDraftDebounced(draft.id, { vertical });
      }
    },
    [localDraft, currentDraft]
  );

  const handleVerticalNext = useCallback(
    async (vertical: ProposalVertical) => {
      const draft = localDraft ?? currentDraft;
      if (!draft) return;

      updateDraft(draft.id, { vertical, status: 'ai-processing', currentStep: 3 });
      setCurrentStep('processing');

      // Track generation start
      const startTime = Date.now();
      trackGenerationStarted(draft.id, vertical, draft.scale);

      // Trigger AI generation
      const response = await generate({
        prompt: draft.prompt,
        scale: draft.scale,
        vertical,
      });

      if (response.status === 'completed' && response.output) {
        updateDraft(draft.id, {
          thinkTankOutput: response.output,
          thinkTankRequestId: response.requestId,
          status: 'ready-for-review',
          currentStep: 4,
        });
        showSuccess('Proposal generated successfully! Review and refine your proposal.');
        trackGenerationCompleted(draft.id, Date.now() - startTime);
      } else if (response.status === 'failed') {
        showError('Proposal generation failed. You can retry or edit your request.');
        const errorMessage =
          typeof response.error === 'string'
            ? response.error
            : (response.error?.message ?? 'Unknown error');
        trackGenerationFailed(draft.id, errorMessage);
      }
    },
    [localDraft, currentDraft, generate]
  );

  const handleProcessingBack = useCallback(() => {
    const draft = localDraft ?? currentDraft;
    if (draft) {
      updateDraft(draft.id, { status: 'drafting', currentStep: 2 });
    }
    resetThinkTank();
    setCurrentStep('vertical');
  }, [localDraft, currentDraft, resetThinkTank]);

  const handleRetry = useCallback(async () => {
    await retry();
  }, [retry]);

  const handleRefine = useCallback(
    async (section: keyof ThinkTankOutput, feedback: string) => {
      const draft = localDraft ?? currentDraft;
      const response = await refine(section, feedback);
      if (response.status === 'completed' && response.output && draft) {
        updateDraft(draft.id, {
          thinkTankOutput: response.output,
        });
        showSuccess('Section refined successfully.');
        trackSectionRefined(draft.id, section);
      } else if (response.status === 'failed') {
        showError('Failed to refine section. Please try again.');
      }
    },
    [localDraft, currentDraft, refine]
  );

  const handleEdit = useCallback(
    (section: keyof ThinkTankOutput, value: ThinkTankOutput[keyof ThinkTankOutput]) => {
      const draft = localDraft ?? currentDraft;
      if (draft) {
        updateOutputSection(draft.id, section, value);
        trackSectionEdited(draft.id, section);
      }
    },
    [localDraft, currentDraft]
  );

  const handleSubmit = useCallback(() => {
    const draft = localDraft ?? currentDraft;
    if (draft) {
      // Flush any pending changes before submitting
      flushPendingSave();
      trackDraftSubmitted(draft.id);
      onComplete(draft.id);
    }
  }, [localDraft, currentDraft, onComplete]);

  const handleBack = useCallback(
    (step: WizardStep) => {
      const currentIndex = getStepIndex(step);
      if (currentIndex > 0) {
        const newStep = STEP_ORDER[currentIndex - 1];
        setCurrentStep(newStep);
        // Save step change
        const draft = localDraft ?? currentDraft;
        if (draft) {
          saveCurrentStep(draft, newStep);
        }
      } else {
        onCancel();
      }
    },
    [onCancel, localDraft, currentDraft, saveCurrentStep]
  );

  // Use local draft or fall back to store
  const activeDraft = localDraft ?? currentDraft;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-500">{draftId ? 'Resuming draft...' : 'Loading...'}</p>
      </div>
    );
  }

  // Error loading draft
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <svg
          className="h-12 w-12 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="mt-4 text-gray-900 font-medium">{loadError}</p>
        <Button variant="outline" onClick={onCancel} className="mt-4">
          Back to Proposals
        </Button>
      </div>
    );
  }

  // No draft available
  if (!activeDraft) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Save Status Bar */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          {/* Save indicator */}
          {isSaving ? (
            <span className="flex items-center gap-2 text-gray-500">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving...
            </span>
          ) : lastSavedAt ? (
            <span className="text-gray-500">Last saved: {formatLastSaved(lastSavedAt)}</span>
          ) : null}

          {/* Unsaved changes indicator */}
          {hasPendingChanges && !isSaving && (
            <span className="flex items-center gap-1 text-amber-600">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Unsaved changes
            </span>
          )}

          {/* Save error */}
          {saveError && (
            <span className="flex items-center gap-1 text-red-600">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {saveError}
              <button onClick={clearSaveError} className="underline">
                Dismiss
              </button>
            </span>
          )}
        </div>

        {/* Manual save button - always enabled */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualSave}
          disabled={isSaving}
          className="min-h-[36px]"
        >
          {isSaving ? 'Saving...' : 'Save Draft'}
        </Button>
      </div>

      {/* Offline warning for AI generation */}
      {!isOnline && currentStep === 'vertical' && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          You're offline. AI generation requires an internet connection. Your draft is saved
          locally.
        </div>
      )}

      {/* Step Indicator */}
      <nav className="mb-8">
        <ol className="flex items-center">
          {STEP_ORDER.map((step, idx) => {
            const isActive = step === currentStep;
            const isCompleted = getStepIndex(step) < getStepIndex(currentStep);
            const isClickable = isCompleted && step !== 'processing';

            return (
              <li key={step} className="relative flex-1">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => isClickable && setCurrentStep(step)}
                    disabled={!isClickable}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                      isActive
                        ? 'bg-teal-500 text-white'
                        : isCompleted
                          ? 'bg-teal-100 text-teal-600 hover:bg-teal-200'
                          : 'bg-gray-200 text-gray-500'
                    } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {isCompleted ? (
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </button>
                  {idx < STEP_ORDER.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 ${
                        getStepIndex(step) < getStepIndex(currentStep)
                          ? 'bg-teal-500'
                          : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
                <span
                  className={`absolute -bottom-6 left-0 w-full text-center text-xs ${
                    isActive ? 'font-medium text-teal-600' : 'text-gray-500'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step Content */}
      <div className="mt-12">
        {currentStep === 'prompt' && (
          <StepPromptInput
            initialValue={activeDraft.prompt}
            onNext={handlePromptNext}
            onBack={onCancel}
            onChange={handlePromptChange}
          />
        )}

        {currentStep === 'scale' && (
          <StepScaleSelect
            initialValue={activeDraft.scale}
            onNext={handleScaleNext}
            onBack={() => handleBack('scale')}
            onChange={handleScaleChange}
          />
        )}

        {currentStep === 'vertical' && (
          <StepVerticalSelect
            initialValue={activeDraft.vertical}
            onNext={handleVerticalNext}
            onBack={() => handleBack('vertical')}
            onChange={handleVerticalChange}
          />
        )}

        {currentStep === 'processing' && (
          <StepProcessing
            status={status ?? 'queued'}
            estimatedTime={estimatedTime}
            error={error}
            onRetry={handleRetry}
            onBack={handleProcessingBack}
          />
        )}

        {currentStep === 'review' && output && (
          <StepReview
            output={output}
            isRefining={isRefining}
            onRefine={handleRefine}
            onEdit={handleEdit}
            onSubmit={handleSubmit}
            onBack={() => setCurrentStep('vertical')}
            editedSections={activeDraft.editedSections}
          />
        )}
      </div>
    </div>
  );
}

export default ProposalWizard;
