import { useState } from 'react';

interface PaymentStepProps {
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function PaymentStep({ userId, onSuccess: _onSuccess, onCancel }: PaymentStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Call oracle-bridge to create checkout session
      const oracleBridgeUrl = import.meta.env.VITE_ORACLE_BRIDGE_URL || 'http://localhost:8787';
      const response = await fetch(`${oracleBridgeUrl}/api/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          amount: 2500, // $25.00 in cents
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      const { checkout_url } = data;

      // Redirect to Stripe checkout page
      window.location.href = checkout_url;
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
      setLoading(false);
    }
  };

  return (
    <div className="payment-step">
      <div className="payment-card">
        <h2>Complete Your Membership Payment</h2>
        <p className="payment-description">
          Your membership fee is <strong>$25.00 USD</strong> per year.
        </p>

        {error && (
          <div className="error-message" role="alert">
            <p>{error}</p>
            <button onClick={handlePayment} disabled={loading}>
              Try Again
            </button>
          </div>
        )}

        <div className="payment-details">
          <div className="detail-row">
            <span>Membership Fee:</span>
            <span>$25.00</span>
          </div>
          <div className="detail-row total">
            <span>
              <strong>Total:</strong>
            </span>
            <span>
              <strong>$25.00</strong>
            </span>
          </div>
        </div>

        <div className="payment-actions">
          <button
            onClick={handlePayment}
            disabled={loading}
            className="btn-primary"
            aria-busy={loading}
          >
            {loading ? 'Processing...' : 'Proceed to Payment'}
          </button>
          {onCancel && (
            <button onClick={onCancel} disabled={loading} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>

        <div className="payment-info">
          <p className="test-mode-notice">
            🧪 <strong>Test Mode:</strong> This is a mock payment. No real charges will be made.
          </p>
          <p className="secure-notice">🔒 Your payment is processed securely through Stripe.</p>
        </div>
      </div>

      <style>{`
        .payment-step {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 60vh;
          padding: 2rem;
        }

        .payment-card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          padding: 2rem;
          max-width: 500px;
          width: 100%;
        }

        .payment-card h2 {
          margin-top: 0;
          margin-bottom: 1rem;
          color: #32325d;
        }

        .payment-description {
          color: #525f7f;
          margin-bottom: 1.5rem;
        }

        .error-message {
          background-color: #fff5f5;
          border: 1px solid #feb2b2;
          border-radius: 4px;
          padding: 1rem;
          margin-bottom: 1rem;
          color: #c53030;
        }

        .error-message button {
          margin-top: 0.5rem;
          padding: 0.5rem 1rem;
          background-color: #c53030;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .error-message button:hover {
          background-color: #9b2c2c;
        }

        .error-message button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .payment-details {
          background-color: #f7fafc;
          border-radius: 4px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          color: #525f7f;
        }

        .detail-row.total {
          padding-top: 0.5rem;
          border-top: 1px solid #e0e6eb;
          margin-top: 0.5rem;
          margin-bottom: 0;
          color: #32325d;
          font-size: 1.1rem;
        }

        .payment-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .btn-primary, .btn-secondary {
          padding: 0.875rem 1.5rem;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-primary {
          background-color: #6772e5;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: #5469d4;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary[aria-busy="true"] {
          position: relative;
        }

        .btn-primary[aria-busy="true"]::after {
          content: "";
          position: absolute;
          width: 16px;
          height: 16px;
          top: 50%;
          right: 1rem;
          margin-top: -8px;
          border: 2px solid transparent;
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .btn-secondary {
          background-color: #f6f9fc;
          color: #525f7f;
          border: 1px solid #e0e6eb;
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: #e6ebf1;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .payment-info {
          border-top: 1px solid #e0e6eb;
          padding-top: 1rem;
        }

        .payment-info p {
          font-size: 0.875rem;
          color: #525f7f;
          margin: 0.5rem 0;
        }

        .test-mode-notice {
          background-color: #ffd966;
          color: #7f6000;
          padding: 0.5rem;
          border-radius: 4px;
          font-weight: 600;
        }

        .secure-notice {
          color: #38a169;
        }
      `}</style>
    </div>
  );
}
