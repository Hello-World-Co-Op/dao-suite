import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  isAuthenticated,
  isAccessTokenExpired,
  getRefreshToken,
  storeTokens,
  clearTokens,
  getTimezone,
  getUserAgent,
} from '../utils/auth';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { useAuthService } from '../hooks/useAuthService';
import { checkSession } from '../services/authCookieClient';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute Component
 *
 * Wraps protected pages and ensures user is authenticated before rendering.
 *
 * Auth check order (FAS-8.1 SSO support):
 * 1. Cookie-based session via oracle-bridge (shared across *.helloworlddao.com)
 * 2. localStorage tokens (legacy, per-suite)
 * 3. Token refresh if access token expired
 *
 * Redirects to login page if user is not authenticated.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const { refreshTokens } = useAuthService();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // E2E auth bypass for CI testing
        if (import.meta.env.VITE_E2E_AUTH_BYPASS === 'true') {
          localStorage.setItem('user_data', JSON.stringify({
            userId: 'e2e-test-user',
            email: 'e2e@test.local',
            firstName: 'E2E',
            lastName: 'Test',
            icPrincipal: null,
          }));
          setAuthenticated(true);
          setChecking(false);
          return;
        }

        // FAS-8.1: Check cookie-based session first (cross-suite SSO)
        // Shared httpOnly cookies on .helloworlddao.com enable SSO across suites
        try {
          const session = await checkSession();
          if (session.authenticated) {
            // FAS-8.1: Populate localStorage for legacy components (Dashboard, etc.)
            // that expect user_data to exist. Cookie SSO doesn't set localStorage.
            // BL-027.2: Always update user_data to include icPrincipal from session
            const existingData = localStorage.getItem('user_data');
            const parsed = existingData ? JSON.parse(existingData) : null;
            const needsUpdate = !parsed || parsed.icPrincipal !== (session.icPrincipal ?? null);
            if (needsUpdate) {
              // Derive display name from email if no firstName is available
              const email = parsed?.email || '';
              const emailPrefix = email.includes('@') ? email.split('@')[0] : '';
              const firstName = (parsed?.firstName && parsed.firstName !== 'Member')
                ? parsed.firstName
                : (emailPrefix || 'Member');
              localStorage.setItem('user_data', JSON.stringify({
                userId: parsed?.userId || session.userId || 'sso-user',
                email,
                firstName,
                lastName: parsed?.lastName || '',
                icPrincipal: session.icPrincipal ?? null,
              }));
            }
            setAuthenticated(true);
            setChecking(false);
            return;
          }
        } catch {
          // Cookie session check failed (e.g., oracle-bridge unreachable)
          // Fall through to localStorage check
        }

        // Legacy: Check localStorage tokens
        if (!isAuthenticated()) {
          setAuthenticated(false);
          setChecking(false);
          return;
        }

        // Check if access token is expired
        if (isAccessTokenExpired()) {
          // Try to refresh the access token
          const refreshToken = getRefreshToken();

          if (!refreshToken) {
            // No refresh token available, user needs to log in again
            clearTokens();
            setAuthenticated(false);
            setChecking(false);
            return;
          }

          try {
            // Attempt token refresh
            // FOS-5.6.5: Use improved async fingerprinting
            const deviceFingerprint = await getDeviceFingerprint();
            const timezone = getTimezone();
            const userAgent = getUserAgent();

            const result = await refreshTokens(
              refreshToken,
              deviceFingerprint,
              undefined, // IP address - not needed for auth guard refresh
              timezone,
              userAgent
            );

            if (!result.success) {
              // Token refresh failed, user needs to log in again
              clearTokens();
              setAuthenticated(false);
              setChecking(false);
              return;
            }

            // Extract new tokens (handle Candid optional types)
            const newAccessToken = result.access_token.length > 0 ? result.access_token[0] : null;
            const newRefreshToken =
              result.refresh_token.length > 0 ? result.refresh_token[0] : null;
            const accessExpiresAt =
              result.access_expires_at.length > 0 ? result.access_expires_at[0] : null;
            const refreshExpiresAt =
              result.refresh_expires_at.length > 0 ? result.refresh_expires_at[0] : null;

            if (!newAccessToken || !newRefreshToken || !accessExpiresAt || !refreshExpiresAt) {
              // Token refresh succeeded but tokens are missing
              clearTokens();
              setAuthenticated(false);
              setChecking(false);
              return;
            }

            // Get user ID from stored tokens (won't change during refresh)
            const storedTokens = await import('../utils/auth').then((m) => m.getStoredTokens());
            const userId = storedTokens?.userId || '';

            // Store new tokens
            storeTokens({
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
              accessExpiresAt: Number(accessExpiresAt),
              refreshExpiresAt: Number(refreshExpiresAt),
              userId,
            });

            setAuthenticated(true);
            setChecking(false);
          } catch (error) {
            console.error('Token refresh error:', error);
            clearTokens();
            setAuthenticated(false);
            setChecking(false);
          }
        } else {
          // Access token is still valid
          setAuthenticated(true);
          setChecking(false);
        }
      } catch (error) {
        console.error('Authentication check error:', error);
        clearTokens();
        setAuthenticated(false);
        setChecking(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show loading spinner while checking authentication
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render protected content
  return <>{children}</>;
}
