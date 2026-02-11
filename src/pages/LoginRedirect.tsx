/**
 * LoginRedirect Page
 *
 * The dao-suite does not have its own login flow - authentication is
 * handled by the FounderyOS suite. This page redirects users to the
 * FounderyOS login page, preserving the return URL so they can be
 * sent back after authentication.
 *
 * @see FAS-6.1 - DAO Suite extraction
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function LoginRedirect() {
  const [searchParams] = useSearchParams();
  const message = searchParams.get('message');
  const returnUrl = searchParams.get('returnUrl');

  useEffect(() => {
    // Build the FounderyOS login URL with returnUrl pointing back to dao-suite
    const founderyOsUrl =
      import.meta.env.VITE_FOUNDERY_OS_URL || 'http://127.0.0.1:5174';

    const loginUrl = new URL('/login', founderyOsUrl);

    // Pass the dao-suite return URL so FounderyOS can redirect back after login
    if (returnUrl) {
      const daoSuiteOrigin = window.location.origin;
      loginUrl.searchParams.set('returnUrl', `${daoSuiteOrigin}${returnUrl}`);
    }

    if (message) {
      loginUrl.searchParams.set('message', message);
    }

    window.location.href = loginUrl.toString();
  }, [message, returnUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
        <p className="text-gray-600">Redirecting to login...</p>
        {message && (
          <p className="text-sm text-gray-500 mt-2 max-w-md">{message}</p>
        )}
      </div>
    </div>
  );
}
