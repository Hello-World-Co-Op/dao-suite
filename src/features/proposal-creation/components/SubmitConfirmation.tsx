/**
 * Submit Confirmation Page
 *
 * Final confirmation before submitting proposal to governance canister.
 * Shows summary and handles submission flow.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * AC: 9, 10, 11
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { $drafts, deleteDraft } from '@/stores';
import { Button } from '../../../components/ui/button';
import { GovernanceCanisterService } from '../../../services/governanceCanister';

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

export function SubmitConfirmation() {
  const navigate = useNavigate();
  const { draftId } = useParams<{ draftId: string }>();
  const drafts = useStore($drafts);
  const draft = draftId ? drafts[draftId] : null;

  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Use ref to prevent redirect race condition when draft is deleted after success
  const submissionSucceededRef = useRef(false);

  // Wait for store hydration before checking draft existence
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if no draft found (only after hydration, and not after successful submission)
  useEffect(() => {
    // Use ref to check success since state update may not have propagated yet
    if (isHydrated && draftId && !draft && !submissionSucceededRef.current) {
      navigate('/proposals/create');
    }
  }, [isHydrated, draftId, draft, navigate]);

  const handleViewProposal = () => {
    if (proposalId) {
      navigate(`/proposals/${proposalId}`);
    }
  };

  // Success state - show before any draft-dependent code
  if (submissionState === 'success') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-gray-100 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Proposal Submitted!</h2>
          <p className="mt-2 text-gray-600">
            Your proposal has been submitted to the governance system.
          </p>
          <p className="mt-1 text-sm text-gray-500">Proposal ID: {proposalId}</p>

          <div className="mt-8 rounded-lg bg-teal-50 p-4">
            <h3 className="font-medium text-teal-800">What happens next?</h3>
            <ul className="mt-2 text-sm text-teal-700 text-left list-disc list-inside space-y-1">
              <li>Your proposal enters a 48-hour review period</li>
              <li>DAO members can review and ask questions</li>
              <li>After review, a 7-day voting period begins</li>
              <li>You'll be notified of the outcome</li>
            </ul>
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <Button variant="outline" onClick={() => navigate('/proposals')}>
              View All Proposals
            </Button>
            <Button onClick={handleViewProposal}>View Your Proposal</Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading spinner if draft not loaded yet
  if (!draft || !draft.thinkTankOutput) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  // Draft-dependent calculations and handlers
  const totalBudget = draft.thinkTankOutput.budgetBreakdown.reduce(
    (sum: number, item: { amount: number }) => sum + item.amount,
    0
  );

  const handleSubmit = async () => {
    if (!draft.thinkTankOutput || !draft.thinkTankRequestId) return;

    setSubmissionState('submitting');
    setError(null);

    const response = await GovernanceCanisterService.submitProposal({
      title: draft.title || draft.thinkTankOutput.problemStatement.substring(0, 100),
      prompt: draft.prompt,
      scale: draft.scale,
      vertical: draft.vertical,
      thinkTankOutput: draft.thinkTankOutput,
      thinkTankRequestId: draft.thinkTankRequestId,
    });

    if (response.success && response.proposalId) {
      // Set ref BEFORE deleting draft to prevent redirect race condition
      submissionSucceededRef.current = true;
      setSubmissionState('success');
      setProposalId(response.proposalId);
      // Clean up draft after successful submission
      deleteDraft(draft.id);
    } else {
      setSubmissionState('error');
      setError(response.error?.message || 'Failed to submit proposal');
    }
  };

  const handleBack = () => {
    navigate('/proposals/create');
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate('/proposals')} className="hover:text-gray-700">
            Proposals
          </button>
          <span>/</span>
          <button onClick={() => navigate('/proposals/create')} className="hover:text-gray-700">
            Create
          </button>
          <span>/</span>
          <span className="text-gray-900">Confirm</span>
        </nav>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Confirm Submission</h1>
        <p className="mt-2 text-gray-600">
          Please review your proposal details before submitting to the governance system.
        </p>

        {/* Summary */}
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900">Problem Statement</h3>
            <p className="mt-1 text-sm text-gray-600 line-clamp-3">
              {draft.thinkTankOutput.problemStatement}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Scale</span>
              <p className="mt-1 font-medium text-gray-900 capitalize">{draft.scale}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Category</span>
              <p className="mt-1 font-medium text-gray-900">{draft.vertical}</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Total Budget</span>
            <p className="mt-1 text-2xl font-bold text-teal-600">
              {totalBudget.toLocaleString()} DOM
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Timeline</span>
            <p className="mt-1 font-medium text-gray-900">
              {draft.thinkTankOutput.timeline.length} phases
            </p>
            <p className="text-sm text-gray-600">
              {draft.thinkTankOutput.timeline.map((t: { phase: string }) => t.phase).join(' → ')}
            </p>
          </div>
        </div>

        {/* Error message */}
        {submissionState === 'error' && error && (
          <div className="mt-6 rounded-lg bg-red-50 p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Submission Failed</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="mt-6 rounded-lg bg-amber-50 p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Before you submit</h3>
              <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                <li>Proposals cannot be edited after submission</li>
                <li>Submission requires a small DOM fee (burned)</li>
                <li>Your identity will be publicly linked to this proposal</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={submissionState === 'submitting'}
          >
            Back to Edit
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submissionState === 'submitting'}>
            {submissionState === 'submitting' ? (
              <>
                <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Submitting...
              </>
            ) : (
              'Submit Proposal'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SubmitConfirmation;
