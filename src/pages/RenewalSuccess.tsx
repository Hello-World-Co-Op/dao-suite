import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Principal } from '@dfinity/principal';
import { trackEvent, trackPageView } from '../utils/analytics';
import {
  useMembershipService,
  type MembershipRecord as _MembershipRecord,
} from '../hooks/useMembershipService';

export default function RenewalSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const membershipService = useMembershipService();

  const [countdown, setCountdown] = useState(5);
  const [membershipStatus, setMembershipStatus] = useState<
    'checking' | 'active' | 'pending' | 'error'
  >('checking');
  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Verifying membership status...');

  const sessionId = searchParams.get('session_id');
  const MAX_POLLING_ATTEMPTS = 15; // 30 seconds (15 attempts * 2 seconds)

  // Calculate next expiration date (December 31 of current or next year)
  const getNextExpirationDate = (): string => {
    const now = new Date();
    const currentYear = now.getFullYear();
    // If we're past December, expiration will be next year's Dec 31
    // Otherwise it's this year's Dec 31
    const expirationYear = now.getMonth() >= 11 ? currentYear + 1 : currentYear;
    return new Date(expirationYear, 11, 31).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  useEffect(() => {
    // AC #17: Analytics - Track successful renewal completion
    trackPageView('Renewal Success');
    trackEvent('renewal_success', {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      next_expiration: getNextExpirationDate(),
    });

    // Countdown timer for auto-redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, sessionId]);

  // AC #1: Real-time Status Polling
  useEffect(() => {
    const pollMembershipStatus = async () => {
      try {
        // Get user principal from session storage
        const storedPrincipal = sessionStorage.getItem('userPrincipal');
        if (!storedPrincipal) {
          setMembershipStatus('error');
          setStatusMessage('Unable to verify membership: User not authenticated');
          return;
        }

        const principal = Principal.fromText(storedPrincipal);

        // Query membership canister
        const membershipResult = await membershipService.verifyMembership(principal);

        if (membershipResult.length === 0) {
          setStatusMessage('Membership not found. Processing may still be in progress...');
          setMembershipStatus('pending');
          return;
        }

        const membership = membershipResult[0];

        // Check if status is Active
        if ('Active' in membership.metadata.status) {
          setMembershipStatus('active');
          setStatusMessage('✅ Membership renewed and active!');

          // Track successful status verification
          trackEvent('renewal_status_verified', {
            status: 'active',
            attempts: pollingAttempts + 1,
          });
        } else {
          setMembershipStatus('pending');
          setStatusMessage(`Status: ${JSON.stringify(membership.metadata.status)} - Verifying...`);
        }
      } catch (error) {
        console.error('Failed to poll membership status:', error);
        setMembershipStatus('error');
        setStatusMessage(
          'Unable to verify membership status. Your renewal may still be processing.'
        );

        // Track polling error
        trackEvent('renewal_status_poll_error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          attempts: pollingAttempts + 1,
        });
      }
    };

    // Initial poll
    pollMembershipStatus();

    // Set up polling interval (every 2 seconds)
    const pollingInterval = setInterval(() => {
      setPollingAttempts((prev) => {
        const newAttempts = prev + 1;

        // Stop polling after 30 seconds (15 attempts)
        if (newAttempts >= MAX_POLLING_ATTEMPTS) {
          clearInterval(pollingInterval);
          if (membershipStatus === 'checking' || membershipStatus === 'pending') {
            setMembershipStatus('pending');
            setStatusMessage(
              'Status verification is taking longer than expected. Your membership renewal is being processed.'
            );
          }
          return newAttempts;
        }

        // Continue polling if status is not active yet
        if (membershipStatus !== 'active' && membershipStatus !== 'error') {
          pollMembershipStatus();
        } else {
          // Stop polling once status is active or error
          clearInterval(pollingInterval);
        }

        return newAttempts;
      });
    }, 2000);

    return () => clearInterval(pollingInterval);
  }, [membershipStatus, pollingAttempts, membershipService, MAX_POLLING_ATTEMPTS]);

  return (
    <div className="payment-result">
      <div className="result-card success">
        <div className="icon-circle success-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1>Renewal Successful!</h1>
        <p className="result-message">Your membership has been renewed successfully.</p>

        {/* AC #1: Real-time Status Update Display */}
        <div className={`status-indicator ${membershipStatus}`}>
          <div className="status-icon">
            {membershipStatus === 'checking' && <span className="spinner-small"></span>}
            {membershipStatus === 'active' && <span>✅</span>}
            {membershipStatus === 'pending' && <span>⏳</span>}
            {membershipStatus === 'error' && <span>⚠️</span>}
          </div>
          <p className="status-text" role="status" aria-live="polite">
            {statusMessage}
          </p>
        </div>

        {sessionId && (
          <div className="session-info">
            <p className="session-id">
              <strong>Session ID:</strong> {sessionId.substring(0, 20)}...
            </p>
          </div>
        )}

        <div className="expiration-box">
          <h3>Updated Membership Details</h3>
          <div className="detail-row">
            <span className="detail-label">New Expiration Date:</span>
            <span className="detail-value highlight">{getNextExpirationDate()}</span>
          </div>
          <p className="renewal-note">Your membership is now active through the end of the year.</p>
        </div>

        <div className="next-steps">
          <h3>What's Next?</h3>
          <ul>
            <li>✅ Payment confirmed</li>
            <li>✅ Membership renewed</li>
            <li>✅ Voting rights maintained</li>
            <li>🎉 You're all set for the year!</li>
          </ul>
        </div>

        <div className="auto-redirect">
          <p>Redirecting to dashboard in {countdown} seconds...</p>
        </div>

        <div className="actions">
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Go to Dashboard Now
          </button>
        </div>
      </div>

      <style>{`
        .payment-result {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 80vh;
          padding: 2rem;
          background-color: #f6f9fc;
        }

        .result-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          padding: 3rem;
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        .icon-circle {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
        }

        .success-icon {
          background-color: #d4edda;
          color: #38a169;
        }

        .result-card h1 {
          color: #32325d;
          margin-bottom: 1rem;
          font-size: 2rem;
        }

        .result-card h3 {
          color: #32325d;
          margin-top: 0;
          margin-bottom: 1rem;
          font-size: 1.25rem;
        }

        .result-message {
          color: #525f7f;
          font-size: 1.125rem;
          margin-bottom: 1.5rem;
        }

        .session-info {
          background-color: #f7fafc;
          border-radius: 4px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .session-id {
          font-size: 0.875rem;
          color: #525f7f;
          margin: 0;
          word-break: break-all;
        }

        .expiration-box {
          background-color: #d4edda;
          border: 2px solid #38a169;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .detail-label {
          color: #2d3748;
          font-weight: 600;
          font-size: 1rem;
        }

        .detail-value {
          color: #2d3748;
          font-weight: 700;
          font-size: 1.1rem;
        }

        .detail-value.highlight {
          color: #38a169;
          font-size: 1.25rem;
        }

        .renewal-note {
          color: #2d3748;
          font-size: 0.95rem;
          margin-top: 0.5rem;
          margin-bottom: 0;
          text-align: center;
        }

        .next-steps {
          text-align: left;
          background-color: #f7fafc;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .next-steps ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .next-steps li {
          padding: 0.5rem 0;
          color: #525f7f;
          font-size: 1rem;
        }

        .auto-redirect {
          margin-bottom: 1.5rem;
          color: #525f7f;
          font-size: 0.875rem;
        }

        .actions {
          display: flex;
          justify-content: center;
        }

        .btn-primary {
          padding: 0.875rem 2rem;
          background-color: #6772e5;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-primary:hover {
          background-color: #5469d4;
        }

        .btn-primary:focus {
          outline: 2px solid #6772e5;
          outline-offset: 2px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          margin-bottom: 1.5rem;
          border-radius: 8px;
          background-color: #f7fafc;
          border: 2px solid #e0e6eb;
        }

        .status-indicator.active {
          background-color: #d4edda;
          border-color: #38a169;
        }

        .status-indicator.checking {
          background-color: #e6f7ff;
          border-color: #1890ff;
        }

        .status-indicator.pending {
          background-color: #fffbeb;
          border-color: #fbbf24;
        }

        .status-indicator.error {
          background-color: #fff5f5;
          border-color: #feb2b2;
        }

        .status-icon {
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner-small {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #6772e5;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
          display: block;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .status-text {
          margin: 0;
          color: #2d3748;
          font-weight: 500;
          flex: 1;
        }
      `}</style>
    </div>
  );
}
