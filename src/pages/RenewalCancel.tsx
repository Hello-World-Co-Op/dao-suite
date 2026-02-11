import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackEvent, trackPageView } from '../utils/analytics';

export default function RenewalCancel() {
  const navigate = useNavigate();

  useEffect(() => {
    // AC #18: Analytics - Track payment cancellation
    trackPageView('Renewal Cancelled');
    trackEvent('renewal_cancelled', {
      timestamp: new Date().toISOString(),
      reason: 'user_cancelled',
    });
  }, []);

  return (
    <div className="payment-result">
      <div className="result-card cancel">
        <div className="icon-circle cancel-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1>Renewal Cancelled</h1>
        <p className="result-message">Your renewal payment was cancelled. No charges were made.</p>

        <div className="info-box">
          <p>You can try again when you're ready to renew your membership.</p>
          <p className="reminder">
            <strong>Reminder:</strong> The renewal window is December 1 - January 31.
          </p>
        </div>

        <div className="actions">
          <button onClick={() => navigate('/membership/renewal')} className="btn-primary">
            Try Again
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Return to Dashboard
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

        .cancel-icon {
          background-color: #fff5f5;
          color: #e53e3e;
        }

        .result-card h1 {
          color: #32325d;
          margin-bottom: 1rem;
          font-size: 2rem;
        }

        .result-message {
          color: #525f7f;
          font-size: 1.125rem;
          margin-bottom: 1.5rem;
        }

        .info-box {
          background-color: #f7fafc;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .info-box p {
          color: #525f7f;
          margin: 0.5rem 0;
        }

        .reminder {
          background-color: #edf2f7;
          border-left: 4px solid #6772e5;
          padding: 0.75rem;
          margin-top: 1rem !important;
          border-radius: 4px;
        }

        .actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .btn-primary, .btn-secondary {
          padding: 0.875rem 2rem;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-primary {
          background-color: #6772e5;
          color: white;
        }

        .btn-primary:hover {
          background-color: #5469d4;
        }

        .btn-secondary {
          background-color: #f6f9fc;
          color: #525f7f;
          border: 1px solid #e0e6eb;
        }

        .btn-secondary:hover {
          background-color: #e6ebf1;
        }
      `}</style>
    </div>
  );
}
