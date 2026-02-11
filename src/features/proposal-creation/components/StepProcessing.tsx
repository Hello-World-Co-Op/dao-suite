/**
 * Step 4: AI Processing
 *
 * Shows progress while Think Tank generates the proposal.
 * Displays status updates, estimated time, and handles errors.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 4, 5
 */

import React from 'react';
import { Button } from '../../../components/ui/button';
import type { GenerationStatus } from '../../../services/thinkTank';
import { getErrorMessage, isRetryable } from '../../../services/thinkTank';
import type { ThinkTankError } from '../../../services/thinkTank';

interface StepProcessingProps {
  status: GenerationStatus;
  estimatedTime: number | null;
  error: ThinkTankError | null;
  onRetry: () => void;
  onBack: () => void;
}

const STATUS_MESSAGES: Record<GenerationStatus, string> = {
  queued: 'Your request is queued...',
  processing: 'Think Tank AI is analyzing your idea...',
  completed: 'Proposal generated successfully!',
  failed: 'Generation failed',
};

const STATUS_ICONS: Record<GenerationStatus, React.ReactNode> = {
  queued: (
    <svg className="h-12 w-12 animate-pulse text-teal-500" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
    </svg>
  ),
  processing: (
    <svg className="h-12 w-12 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  ),
  completed: (
    <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  failed: (
    <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
};

export function StepProcessing({
  status,
  estimatedTime,
  error,
  onRetry,
  onBack,
}: StepProcessingProps) {
  const isError = status === 'failed';
  const canRetry = error && isRetryable(error);

  return (
    <div className="flex flex-col items-center space-y-6 py-8">
      <div className="flex flex-col items-center space-y-4">
        {STATUS_ICONS[status]}
        <h2 className="text-xl font-semibold text-gray-900">{STATUS_MESSAGES[status]}</h2>
      </div>

      {status === 'processing' && estimatedTime !== null && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Estimated time remaining: {Math.ceil(estimatedTime / 1000)} seconds
          </p>
          <div className="mt-2 h-2 w-64 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full animate-pulse rounded-full bg-teal-500"
              style={{ width: '60%' }}
            />
          </div>
        </div>
      )}

      {status === 'processing' && (
        <div className="max-w-md text-center">
          <p className="text-sm text-gray-500">
            The Think Tank is consulting with our AI agents to generate a comprehensive proposal
            including budget, timeline, and risk assessment.
          </p>
        </div>
      )}

      {isError && error && (
        <div className="max-w-md rounded-lg bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{getErrorMessage(error)}</h3>
              {canRetry && (
                <p className="mt-1 text-sm text-red-700">
                  This error can be retried. Please try again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-4 pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          {isError ? 'Edit Request' : 'Cancel'}
        </Button>
        {isError && canRetry && (
          <Button type="button" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export default StepProcessing;
