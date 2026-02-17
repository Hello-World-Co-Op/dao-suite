/**
 * Create Proposal Page
 *
 * Route entry point for the proposal creation wizard.
 * Handles SBT verification, navigation, and draft resume.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * Story: 9-1-6-draft-proposal-management (resume flow)
 * AC: 1, 11 (9-1-1), AC: 4 (9-1-6)
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProposalWizard } from './ProposalWizard';
import { Button } from '../../../components/ui/button';
import { setCurrentDraft } from '@/stores';
import { captureEvent } from '../../../utils/posthog';
import { useMembership } from '@/hooks/useMembership';
import { useAuth } from '@hello-world-co-op/auth';

export function CreateProposalPage() {
  const navigate = useNavigate();
  const params = useParams<{ draftId?: string }>();
  const { isAuthenticated, user } = useAuth();
  const principal = user?.userId || 'mock-principal-id';
  const { isActiveMember, isLoading: isMembershipLoading } = useMembership();
  const [showVerificationError, setShowVerificationError] = useState(false);

  const isResuming = !!params.draftId;

  // Clear current draft selection on mount (only for new drafts)
  useEffect(() => {
    if (!isResuming) {
      setCurrentDraft(null);
    }
  }, [isResuming]);

  // Track draft resume analytics
  useEffect(() => {
    if (isResuming && params.draftId) {
      captureEvent('draft_resumed', { draft_id: params.draftId });
    }
  }, [isResuming, params.draftId]);

  // Check SBT verification (wait for membership status to load)
  useEffect(() => {
    if (isAuthenticated && !isMembershipLoading && !isActiveMember) {
      setShowVerificationError(true);
    }
  }, [isAuthenticated, isMembershipLoading, isActiveMember]);

  const handleComplete = (draftId: string) => {
    // Navigate to submission confirmation or proposal detail
    navigate(`/proposals/draft/${draftId}/confirm`);
  };

  const handleCancel = () => {
    navigate('/proposals');
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <div className="text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Sign In Required</h2>
          <p className="mt-2 text-gray-600">Please sign in to create a proposal.</p>
          <Button className="mt-4" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // No SBT (not a verified member)
  if (showVerificationError) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <div className="max-w-md text-center">
          <svg
            className="mx-auto h-16 w-16 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Membership Required</h2>
          <p className="mt-2 text-gray-600">
            You need a verified membership (Soul-Bound Token) to create proposals. Complete the
            membership process to get your SBT.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button variant="outline" onClick={() => navigate('/proposals')}>
              Back to Proposals
            </Button>
            <Button onClick={() => navigate('/membership')}>Get Membership</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => navigate('/proposals')} className="hover:text-gray-700">
            Proposals
          </button>
          <span>/</span>
          <span className="text-gray-900">{isResuming ? 'Edit Draft' : 'Create New'}</span>
        </nav>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <ProposalWizard
          draftId={params.draftId}
          userPrincipal={principal}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

export default CreateProposalPage;
