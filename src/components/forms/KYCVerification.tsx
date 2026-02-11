import React, { useState, useEffect, useCallback } from 'react';
import { Principal } from '@dfinity/principal';
import type { KYCSession, KYCRecord, KYCStatus } from '../../types/user-service';
import { trackEvent } from '../../utils/analytics';
import { cn } from '../../utils/cn';
import PrivacyConsent from './PrivacyConsent';

// Constants
const POLLING_INTERVAL_MS = 5000; // 5 seconds - initial interval
const MAX_POLLING_INTERVAL_MS = 60000; // 60 seconds - maximum interval
const BACKOFF_MULTIPLIER = 2; // Double the interval on each failure

interface KYCVerificationProps {
  userId: Principal;
  onVerificationComplete?: (record: KYCRecord) => void;
  onVerificationFailed?: (error: string) => void;
  /** @internal Test-only prop to inject specific KYC status for coverage testing */
  testKycRecord?: KYCRecord;
}

/**
 * KYC Verification Component
 *
 * Implements identity verification workflow with Persona SDK (mocked for development).
 * Features:
 * - Iframe-based verification flow
 * - Status polling every 5 seconds
 * - Mobile-responsive design
 * - WCAG 2.1 AA accessible
 * - Analytics tracking
 *
 * Epic 2.0, Story 2.0.3
 *
 * @example
 * // Recommended usage with ErrorBoundary wrapper for production:
 * import ErrorBoundary from '../ErrorBoundary';
 *
 * <ErrorBoundary>
 *   <KYCVerification
 *     userId={userPrincipal}
 *     onVerificationComplete={handleComplete}
 *     onVerificationFailed={handleError}
 *   />
 * </ErrorBoundary>
 */
function KYCVerification({
  userId,
  onVerificationComplete,
  onVerificationFailed,
  testKycRecord,
}: KYCVerificationProps) {
  // Load KYC status from localStorage on mount
  const loadKYCStatus = (): KYCRecord | null => {
    try {
      const stored = localStorage.getItem('kyc_status');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert BigInt fields from strings back to BigInt
        return {
          ...parsed,
          created_at: BigInt(parsed.created_at),
          updated_at: BigInt(parsed.updated_at),
          verified_at: parsed.verified_at.length > 0 ? [BigInt(parsed.verified_at[0])] : [],
          flagged_at: parsed.flagged_at.length > 0 ? [BigInt(parsed.flagged_at[0])] : [],
          appeal_submitted_at:
            parsed.appeal_submitted_at.length > 0 ? [BigInt(parsed.appeal_submitted_at[0])] : [],
        };
      }
    } catch (err) {
      console.error('[KYC] Failed to load status from localStorage:', err);
    }
    return null;
  };

  // State management
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [session, setSession] = useState<KYCSession | null>(null);
  const [kycRecord, setKycRecord] = useState<KYCRecord | null>(testKycRecord || loadKYCStatus());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [pollingFailures, setPollingFailures] = useState(0);
  const [currentPollingInterval, setCurrentPollingInterval] = useState(POLLING_INTERVAL_MS);
  // Story 2.0.4: Appeal state
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  // Story 2.0.5: GDPR consent state
  const [privacyConsent, setPrivacyConsent] = useState(false);
  // Mock auto-verification tracking
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Save KYC status to localStorage whenever it changes
  useEffect(() => {
    if (kycRecord) {
      try {
        // Convert BigInt fields to strings for JSON serialization
        const serializable = {
          ...kycRecord,
          created_at: kycRecord.created_at.toString(),
          updated_at: kycRecord.updated_at.toString(),
          verified_at: kycRecord.verified_at.map((v) => v.toString()),
          flagged_at: kycRecord.flagged_at.map((v) => v.toString()),
          appeal_submitted_at: kycRecord.appeal_submitted_at.map((v) => v.toString()),
        };
        localStorage.setItem('kyc_status', JSON.stringify(serializable));
      } catch (err) {
        console.error('[KYC] Failed to save status to localStorage:', err);
      }
    }
  }, [kycRecord]);

  // Helper to determine current KYC status string
  const getStatusString = (status: KYCStatus): string => {
    if ('Pending' in status) return 'Pending';
    if ('Verified' in status) return 'Verified';
    if ('Failed' in status) return 'Failed';
    if ('Expired' in status) return 'Expired';
    if ('UnderReview' in status) return 'UnderReview';
    return 'Unknown';
  };

  const currentStatus = kycRecord ? getStatusString(kycRecord.status) : null;

  // Terminal statuses (stop polling)
  const isTerminalStatus = (status: string | null): boolean => {
    return status === 'Verified' || status === 'Failed' || status === 'Expired';
  };

  /**
   * Track privacy consent analytics (Story 2.0.5)
   */
  useEffect(() => {
    if (privacyConsent) {
      trackEvent('kyc_privacy_consent_given', {
        user_id: userId.toString(),
        timestamp: Date.now(),
      });
    }
  }, [privacyConsent, userId]);

  /**
   * Initiate KYC verification
   * Calls user-service.initiate_kyc() to get session URL
   */
  const handleVerifyClick = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Track button click
      trackEvent('kyc_verify_clicked', {
        user_id: userId.toString(),
        retry_count: retryCount,
      });

      // TODO: Replace with actual IC agent call to user-service
      // const actor = await getActor();
      // const result = await actor.initiate_kyc(userId);

      // Mock implementation for development
      // Using data URI to avoid DNS errors in staging
      const mockHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Mock KYC Verification</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 10px 25px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 400px;
            }
            h1 { color: #667eea; margin: 0 0 1rem 0; }
            p { color: #666; line-height: 1.6; }
            .badge { background: #fef3c7; color: #92400e; padding: 0.5rem 1rem; border-radius: 0.5rem; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>KYC Verification</h1>
            <div class="badge">Mock Mode - Development Only</div>
            <p style="margin-top: 1.5rem;">
              This is a placeholder for the Persona KYC verification flow.
            </p>
            <p>
              In production, this will integrate with Persona's identity verification service.
            </p>
            <p style="font-size: 0.875rem; color: #999; margin-top: 2rem;">
              inquiry_id: inq_test_${Date.now()}
            </p>
          </div>
        </body>
        </html>
      `;
      const mockSession: KYCSession = {
        inquiry_id: `inq_test_${Date.now()}`,
        session_url: `data:text/html,${encodeURIComponent(mockHTML)}`,
      };

      setSession(mockSession);
      setIsModalOpen(true);
      setSessionStartTime(Date.now()); // Track when verification started for auto-approve

      // Track verification started
      trackEvent('kyc_started', {
        user_id: userId.toString(),
        inquiry_id: mockSession.inquiry_id,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to initiate KYC verification';
      setError(errorMessage);
      console.error('[KYC] Initiation error:', err);

      trackEvent('kyc_failed', {
        user_id: userId.toString(),
        error: errorMessage,
        stage: 'initiation',
      });

      if (onVerificationFailed) {
        onVerificationFailed(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, retryCount, onVerificationFailed]);

  /**
   * Fetch current KYC status
   * Called by polling mechanism with exponential backoff on failures
   */
  const fetchKYCStatus = useCallback(async () => {
    try {
      // TODO: Replace with actual IC agent call
      // const actor = await getActor();
      // const result = await actor.get_kyc_status(userId);

      // Mock implementation - auto-approve after 5 seconds
      const currentTime = Date.now();
      const elapsedSeconds = sessionStartTime ? (currentTime - sessionStartTime) / 1000 : 0;
      const isVerified = elapsedSeconds >= 5;

      const mockRecord: KYCRecord = {
        user_id: userId,
        inquiry_id: session?.inquiry_id || 'mock_inquiry',
        status: isVerified ? { Verified: null } : { Pending: null },
        created_at: BigInt(Date.now() * 1_000_000),
        updated_at: BigInt(Date.now() * 1_000_000),
        verified_at: isVerified ? [BigInt(currentTime * 1_000_000)] : [],
        expiry_date: [],
        // Story 2.0.4: Admin review and appeal fields
        flagged_at: [],
        reviewer: [],
        review_notes: [],
        appeal_reason: [],
        appeal_submitted_at: [],
      };

      setKycRecord(mockRecord);

      // Success - reset backoff
      if (pollingFailures > 0) {
        setPollingFailures(0);
        setCurrentPollingInterval(POLLING_INTERVAL_MS);
      }
    } catch (err) {
      console.error('[KYC] Status polling error:', err);

      // Increment failure count and apply exponential backoff
      setPollingFailures((prev) => {
        const newFailures = prev + 1;
        const newInterval = Math.min(
          POLLING_INTERVAL_MS * Math.pow(BACKOFF_MULTIPLIER, newFailures),
          MAX_POLLING_INTERVAL_MS
        );
        setCurrentPollingInterval(newInterval);
        console.warn(`[KYC] Polling failed ${newFailures} time(s). Next poll in ${newInterval}ms`);
        return newFailures;
      });

      // Don't show error UI for polling failures - just log and backoff
    }
  }, [userId, session, pollingFailures, sessionStartTime]);

  /**
   * Status polling effect
   * Polls with exponential backoff (5s → 10s → 20s → 40s → max 60s) on failures
   * Resets to 5s on success
   */
  useEffect(() => {
    if (!session || isTerminalStatus(currentStatus)) {
      return;
    }

    // Initial fetch
    fetchKYCStatus();

    // Set up polling interval with current backoff interval
    const pollInterval = setInterval(() => {
      fetchKYCStatus();
    }, currentPollingInterval);

    // Cleanup on unmount or when status becomes terminal
    return () => {
      clearInterval(pollInterval);
    };
  }, [session, currentStatus, currentPollingInterval, fetchKYCStatus]);

  /**
   * Handle verification completion
   */
  useEffect(() => {
    if (currentStatus === 'Verified' && kycRecord) {
      trackEvent('kyc_completed', {
        user_id: userId.toString(),
        inquiry_id: kycRecord.inquiry_id,
        success: true,
      });

      if (onVerificationComplete) {
        onVerificationComplete(kycRecord);
      }
    } else if (currentStatus === 'Failed' && kycRecord) {
      trackEvent('kyc_failed', {
        user_id: userId.toString(),
        inquiry_id: kycRecord.inquiry_id,
        stage: 'verification',
      });

      if (onVerificationFailed) {
        onVerificationFailed('Identity verification failed. Please try again.');
      }
    }
  }, [currentStatus, kycRecord, userId, onVerificationComplete, onVerificationFailed]);

  /**
   * Handle retry for failed verification
   */
  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    setSession(null);
    setKycRecord(null);
    setError(null);
    setIsModalOpen(false);

    // Reset backoff state
    setPollingFailures(0);
    setCurrentPollingInterval(POLLING_INTERVAL_MS);

    trackEvent('kyc_retry_clicked', {
      user_id: userId.toString(),
      retry_count: retryCount + 1,
    });

    // Initiate new verification
    handleVerifyClick();
  }, [userId, retryCount, handleVerifyClick]);

  /**
   * Handle appeal submission (Story 2.0.4 - Task 7)
   */
  const handleAppealSubmit = useCallback(async () => {
    try {
      setAppealSubmitting(true);
      setAppealError(null);

      // Validate appeal reason
      if (appealReason.trim().length < 20) {
        setAppealError('Appeal reason must be at least 20 characters');
        return;
      }
      if (appealReason.trim().length > 500) {
        setAppealError('Appeal reason must not exceed 500 characters');
        return;
      }

      // Track appeal submission
      trackEvent('kyc_appeal_submitted', {
        user_id: userId.toString(),
        reason_length: appealReason.length,
      });

      // TODO: Replace with actual IC agent call to user-service
      // const actor = await getActor();
      // const result = await actor.submit_kyc_appeal(appealReason.trim());

      // Mock implementation for development
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Close modal and reset
      setIsAppealModalOpen(false);
      setAppealReason('');

      // Update status to UnderReview (mock)
      if (kycRecord) {
        const updatedRecord = {
          ...kycRecord,
          status: { UnderReview: null } as KYCStatus,
        };
        setKycRecord(updatedRecord);
      }

      trackEvent('kyc_appeal_success', {
        user_id: userId.toString(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit appeal';
      setAppealError(errorMessage);

      trackEvent('kyc_appeal_failed', {
        user_id: userId.toString(),
        error: errorMessage,
      });
    } finally {
      setAppealSubmitting(false);
    }
  }, [appealReason, userId, kycRecord]);

  /**
   * Close modal
   */
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    // Don't clear session/status - allow user to reopen and check progress
  }, []);

  /**
   * Keyboard navigation - close modal on Escape
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        handleCloseModal();
      }
    };

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isModalOpen, handleCloseModal]);

  /**
   * Render verification status UI
   */
  const renderStatusUI = () => {
    if (loading) {
      return (
        <div
          className="flex flex-col items-center justify-center p-8"
          role="status"
          aria-live="polite"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Initiating verification...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start">
            <svg
              className="h-6 w-6 text-red-600 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Verification Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStatus === 'Verified') {
      return (
        <div
          className="bg-green-50 border border-green-200 rounded-lg p-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start">
            <svg
              className="h-6 w-6 text-green-600 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-green-800">Verification Complete!</h3>
              <p className="mt-1 text-sm text-green-700">
                Your identity has been successfully verified.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStatus === 'Failed') {
      // Check if appeal already submitted (Story 2.0.4)
      const hasAppealed = kycRecord?.appeal_reason && kycRecord.appeal_reason.length > 0;

      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6" role="alert">
          <div className="flex items-start">
            <svg
              className="h-6 w-6 text-red-600 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Verification Failed</h3>
              <p className="mt-1 text-sm text-red-700">
                We were unable to verify your identity. Please ensure your documents are clear and
                try again.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[44px]"
                  aria-label="Retry verification"
                >
                  Retry Verification
                </button>
                {!hasAppealed && (
                  <button
                    onClick={() => setIsAppealModalOpen(true)}
                    className="px-4 py-2 bg-white text-red-700 border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[44px]"
                    aria-label="Appeal decision"
                  >
                    Appeal Decision
                  </button>
                )}
                {hasAppealed && (
                  <div className="text-sm text-red-700 self-center">
                    Appeal submitted - under review
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentStatus === 'Pending') {
      return (
        <div
          className="bg-blue-50 border border-blue-200 rounded-lg p-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Verification in Progress</h3>
              <p className="mt-1 text-sm text-blue-700">
                Please complete the verification steps in the window. This usually takes 2-5
                minutes.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (currentStatus === 'UnderReview') {
      return (
        <div
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start">
            <svg
              className="h-6 w-6 text-yellow-600 mr-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Under Manual Review</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Your verification requires manual review. We'll notify you via email when complete
                (typically within 24-48 hours).
              </p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="kyc-verification">
      {/* Privacy Consent (Story 2.0.5) - Only show before verification starts */}
      {!session && (
        <div className="space-y-4">
          <PrivacyConsent checked={privacyConsent} onChange={setPrivacyConsent} />

          {/* Trigger Button */}
          <button
            onClick={handleVerifyClick}
            disabled={loading || !privacyConsent}
            className={cn(
              'px-6 py-3 bg-blue-600 text-white rounded-md font-medium',
              'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'min-h-[44px] min-w-[44px]', // Touch target size for mobile
              'transition-colors duration-200'
            )}
            aria-label="Verify Identity"
            aria-disabled={loading || !privacyConsent}
          >
            {loading ? 'Initiating...' : 'Verify Identity'}
          </button>
        </div>
      )}

      {/* Status Display */}
      {(session || testKycRecord) && <div className="mt-4">{renderStatusUI()}</div>}

      {/* Modal with iframe for Persona verification */}
      {isModalOpen && session && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kyc-modal-title"
        >
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseModal}
          ></div>

          {/* Modal content */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h2 id="kyc-modal-title" className="text-lg font-semibold text-gray-900">
                  Identity Verification
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                  aria-label="Close"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Iframe */}
              <div className="p-4">
                <iframe
                  src={session.session_url}
                  title="KYC Verification - Persona"
                  className="w-full h-[600px] border-0 rounded-md"
                  allow="camera;microphone"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              </div>

              {/* Footer with instructions */}
              <div className="p-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  <strong>Next steps:</strong> Complete the verification process in the window
                  above. You'll need a government-issued ID and may need to take a selfie.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appeal Modal (Story 2.0.4 - Task 7) */}
      {isAppealModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appeal-modal-title"
        >
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setIsAppealModalOpen(false)}
          ></div>

          {/* Modal content */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <h2 id="appeal-modal-title" className="text-xl font-semibold text-gray-900">
                  Appeal Verification Decision
                </h2>
                <button
                  onClick={() => setIsAppealModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                  aria-label="Close"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-sm text-gray-700 mb-4">
                  If you believe your verification was rejected in error, please explain why you
                  think the decision should be reconsidered. Our team will review your appeal within
                  24-48 hours.
                </p>

                <label
                  htmlFor="appeal-reason"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Appeal Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="appeal-reason"
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Please provide a detailed explanation (20-500 characters)..."
                  aria-describedby="appeal-reason-help appeal-reason-count"
                  maxLength={500}
                  disabled={appealSubmitting}
                />

                <div className="mt-2 flex justify-between items-center">
                  <p id="appeal-reason-help" className="text-sm text-gray-500">
                    Minimum 20 characters required
                  </p>
                  <p
                    id="appeal-reason-count"
                    className={cn(
                      'text-sm',
                      appealReason.length < 20
                        ? 'text-gray-500'
                        : appealReason.length >= 500
                          ? 'text-red-600 font-medium'
                          : 'text-green-600'
                    )}
                  >
                    {appealReason.length} / 500
                  </p>
                </div>

                {appealError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md" role="alert">
                    <p className="text-sm text-red-700">{appealError}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                <button
                  onClick={() => {
                    setIsAppealModalOpen(false);
                    setAppealReason('');
                    setAppealError(null);
                  }}
                  disabled={appealSubmitting}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAppealSubmit}
                  disabled={appealSubmitting || appealReason.trim().length < 20}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Submit appeal"
                >
                  {appealSubmitting ? 'Submitting...' : 'Submit Appeal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap with React.memo for performance optimization
// Only re-renders when userId prop changes
export default React.memo(KYCVerification);
