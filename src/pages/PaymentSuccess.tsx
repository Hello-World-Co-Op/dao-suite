import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
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
  }, [navigate]);

  return (
    <div className="payment-result">
      <div className="result-card success">
        <div className="icon-circle success-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1>Payment Successful!</h1>
        <p className="result-message">Your membership payment has been processed successfully.</p>

        {sessionId && (
          <div className="session-info">
            <p className="session-id">
              <strong>Session ID:</strong> {sessionId.substring(0, 20)}...
            </p>
          </div>
        )}

        <div className="next-steps">
          <h3>What's Next?</h3>
          <ul>
            <li>✅ Payment confirmed</li>
            <li>✅ Email verification completed</li>
            <li>✅ KYC verification completed</li>
            <li>🎉 Your membership NFT is being minted!</li>
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

        .next-steps {
          text-align: left;
          background-color: #f7fafc;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .next-steps h3 {
          margin-top: 0;
          margin-bottom: 1rem;
          color: #32325d;
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
      `}</style>
    </div>
  );
}
