/**
 * Unsubscribe Landing Page
 *
 * Public page (no auth required) that processes email unsubscribe tokens.
 * Users land here from unsubscribe links in notification emails.
 * Calls oracle-bridge PUT /api/notifications/unsubscribe with the JWT token.
 *
 * @see BL-022.3 — Unsubscribe Landing Page
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOracleBridgeUrl } from '@/services/notificationPreferencesService';

type UnsubscribeState =
  | { type: 'loading' }
  | { type: 'success'; category: string }
  | { type: 'error'; message: string };

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<UnsubscribeState>({ type: 'loading' });

  useEffect(() => {
    const token = searchParams.get('token');
    const category = searchParams.get('category');

    if (!token) {
      setState({
        type: 'error',
        message:
          'This unsubscribe link is missing a token. Please log in to manage your notification preferences.',
      });
      return;
    }

    const baseUrl = getOracleBridgeUrl();

    fetch(`${baseUrl}/api/notifications/unsubscribe`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        if (response.ok) {
          setState({ type: 'success', category: category || 'notifications' });
        } else if (response.status === 400) {
          setState({
            type: 'error',
            message:
              'This unsubscribe link has expired or is invalid. Please log in to manage your notification preferences.',
          });
        } else {
          setState({
            type: 'error',
            message:
              'Something went wrong. Please try again or log in to manage your notification preferences.',
          });
        }
      })
      .catch(() => {
        setState({
          type: 'error',
          message:
            'Something went wrong. Please try again or log in to manage your notification preferences.',
        });
      });
  // Mount-only effect: searchParams are read once at load time. The unsubscribe
  // action is intentionally one-shot — re-running on URL change would re-submit
  // the token, which could cause duplicate calls or confusing state transitions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.type === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div
          className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center"
          data-testid="unsubscribe-loading"
        >
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500 mx-auto mb-4" />
          <p className="text-gray-600">Processing your unsubscribe request...</p>
        </div>
      </div>
    );
  }

  if (state.type === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1
              className="text-2xl font-bold text-gray-900"
              data-testid="unsubscribe-success-heading"
            >
              Unsubscribed
            </h1>
            <p className="mt-2 text-gray-600" data-testid="unsubscribe-success-message">
              You have been unsubscribed from <strong>{state.category}</strong> emails.
            </p>
          </div>
          <div className="text-center">
            <a
              href="/settings?tab=notifications"
              className="text-sm text-green-700 hover:underline"
              data-testid="manage-preferences-link"
            >
              Manage all notification preferences
            </a>
          </div>
        </div>
      </div>
    );
  }

  // state.type === 'error'
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold text-gray-900"
            data-testid="unsubscribe-error-heading"
          >
            Link Expired or Invalid
          </h1>
          <p className="mt-2 text-gray-600" data-testid="unsubscribe-error-message">
            {state.message}
          </p>
        </div>
        <div className="text-center">
          <a
            href="/settings?tab=notifications"
            className="text-sm text-green-700 hover:underline"
            data-testid="manage-preferences-link"
          >
            Manage all notification preferences
          </a>
        </div>
      </div>
    </div>
  );
}
