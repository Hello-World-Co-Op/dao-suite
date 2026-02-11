/**
 * Cookie-Based Auth Client
 *
 * FOS-5.6.6: Frontend Token Security
 * HTTP client for cookie-based authentication via oracle-bridge.
 * Tokens are stored in httpOnly cookies (not accessible to JS).
 *
 * @see AC-5.6.6.1 - Tokens stored in httpOnly cookies
 * @see AC-5.6.6.3 - CSRF tokens implemented
 *
 * Usage:
 * ```typescript
 * import { cookieAuth } from './authCookieClient';
 *
 * // Login - cookies are set automatically
 * await cookieAuth.login(email, password);
 *
 * // Check session
 * const isValid = await cookieAuth.checkSession();
 *
 * // Refresh tokens - reads/writes cookies
 * await cookieAuth.refreshTokens();
 *
 * // Logout - clears cookies
 * await cookieAuth.logout();
 * ```
 */

import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { csrfFetch, ensureCSRFToken } from '../utils/csrf';
import { TokenRefreshQueue } from '../utils/tokenRefreshQueue';
import { clearAllSensitiveData } from '../utils/securityClear';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Get the oracle-bridge base URL from environment
 * Defaults to same-origin (for proxy setup) or localhost in dev
 */
function getBaseUrl(): string {
  // VITE_ORACLE_BRIDGE_URL for explicit config
  if (import.meta.env.VITE_ORACLE_BRIDGE_URL) {
    return import.meta.env.VITE_ORACLE_BRIDGE_URL;
  }

  // In production, oracle-bridge is typically proxied on same origin
  if (import.meta.env.PROD) {
    return '';
  }

  // Development default
  return 'http://localhost:3000';
}

// =============================================================================
// Types
// =============================================================================

export interface LoginResult {
  success: boolean;
  message: string;
  userId?: string;
  accessExpiresAt?: number;
  refreshExpiresAt?: number;
}

export interface SessionStatus {
  authenticated: boolean;
  userId?: string;
  accessExpiresAt?: number;
  refreshExpiresAt?: number;
}

export interface RefreshResult {
  success: boolean;
  message: string;
  accessExpiresAt?: number;
  refreshExpiresAt?: number;
}

/**
 * Server response from refresh endpoint
 */
interface RefreshResponseData {
  success: boolean;
  message?: string;
  access_expires_at?: number;
  refresh_expires_at?: number;
}

/**
 * Token refresh queue for cookie auth
 * Typed for the refresh response data
 */
const cookieRefreshQueue = new TokenRefreshQueue<RefreshResponseData>();

// =============================================================================
// Rate Limiting (client-side - UX feedback only)
// =============================================================================

/**
 * Client-side rate limiting provides immediate UX feedback.
 *
 * IMPORTANT: This is NOT a security measure. Users can bypass by:
 * - Refreshing the page (clears in-memory state)
 * - Opening new tabs
 * - Using DevTools
 *
 * Actual rate limiting is enforced server-side in:
 * oracle-bridge/src/middleware/rate-limit.ts (authRateLimit)
 */
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const loginAttempts: { timestamp: number }[] = [];

function checkRateLimit(): string | null {
  const now = Date.now();
  while (loginAttempts.length > 0 && now - loginAttempts[0].timestamp > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.shift();
  }

  if (loginAttempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    const oldest = loginAttempts[0];
    const waitTime = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest.timestamp)) / 1000);
    return `Too many login attempts. Please wait ${waitTime} seconds.`;
  }

  return null;
}

function recordLoginAttempt(): void {
  loginAttempts.push({ timestamp: Date.now() });
}

/**
 * Reset rate limiter state (for testing only)
 * @internal
 */
export function resetRateLimiter(): void {
  loginAttempts.length = 0;
}

// =============================================================================
// Session State (in-memory, not tokens)
// =============================================================================

/**
 * In-memory session state
 * Note: Tokens are NOT stored here - they're in httpOnly cookies.
 * This only tracks metadata returned by the server.
 */
let sessionState: SessionStatus = {
  authenticated: false,
};

/**
 * Get current session state (from memory, not validated)
 */
export function getSessionState(): SessionStatus {
  return { ...sessionState };
}

/**
 * Update session state (called after successful auth operations)
 */
function updateSessionState(status: Partial<SessionStatus>): void {
  sessionState = { ...sessionState, ...status };
}

/**
 * Clear session state (on logout or auth failure)
 */
function clearSessionState(): void {
  sessionState = { authenticated: false };
}

// =============================================================================
// Cookie Auth Client
// =============================================================================

/**
 * Login with email and password
 * Server sets httpOnly cookies with tokens
 *
 * @param email - User email
 * @param password - User password
 * @returns Login result with user ID and expiry times
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  // Client-side rate limiting
  const rateLimitError = checkRateLimit();
  if (rateLimitError) {
    return { success: false, message: rateLimitError };
  }
  recordLoginAttempt();

  const baseUrl = getBaseUrl();
  const deviceFingerprint = await getDeviceFingerprint();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userAgent = navigator.userAgent;

  try {
    // Note: Login uses plain fetch (not csrfFetch) because:
    // 1. No existing session exists to hijack (CSRF threat model doesn't apply)
    // 2. CSRF token cookie is set AFTER successful login
    // 3. Password submission is the authentication, not a session cookie
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: send/receive cookies
      body: JSON.stringify({
        email,
        password,
        device_fingerprint: deviceFingerprint,
        timezone,
        user_agent: userAgent,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      clearSessionState();
      return {
        success: false,
        message: data.message || 'Login failed',
      };
    }

    // Update in-memory session state (tokens are in cookies)
    updateSessionState({
      authenticated: true,
      userId: data.user_id,
      accessExpiresAt: data.access_expires_at,
      refreshExpiresAt: data.refresh_expires_at,
    });

    return {
      success: true,
      message: 'Login successful',
      userId: data.user_id,
      accessExpiresAt: data.access_expires_at,
      refreshExpiresAt: data.refresh_expires_at,
    };
  } catch (error) {
    clearSessionState();
    const message =
      error instanceof Error && error.message.includes('Failed to fetch')
        ? 'Unable to connect to the server. Please check your connection.'
        : 'An unexpected error occurred during login.';
    return { success: false, message };
  }
}

/**
 * Refresh authentication tokens
 * Reads refresh token from cookie, sets new tokens in cookies
 * Uses mutex to prevent concurrent refresh attempts
 */
export async function refreshTokens(): Promise<RefreshResult> {
  // Use the token refresh queue to prevent concurrent refreshes
  const result = await cookieRefreshQueue.refresh(async (): Promise<RefreshResponseData> => {
    const baseUrl = getBaseUrl();
    const deviceFingerprint = await getDeviceFingerprint();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const userAgent = navigator.userAgent;

    // Ensure we have a CSRF token before making the request
    await ensureCSRFToken(`${baseUrl}/api/auth`);

    const response = await csrfFetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_fingerprint: deviceFingerprint,
        timezone,
        user_agent: userAgent,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      clearSessionState();
      throw new Error(data.message || 'Token refresh failed');
    }

    // Update session state
    updateSessionState({
      authenticated: true,
      accessExpiresAt: data.access_expires_at,
      refreshExpiresAt: data.refresh_expires_at,
    });

    return data as RefreshResponseData;
  });

  if (!result.success) {
    clearSessionState();
    return {
      success: false,
      message: result.error?.message || 'Token refresh failed',
    };
  }

  return {
    success: true,
    message: 'Token refresh successful',
    accessExpiresAt: result.data?.access_expires_at,
    refreshExpiresAt: result.data?.refresh_expires_at,
  };
}

/**
 * Logout - clear cookies, session, and all sensitive data
 *
 * FOS-5.6.7: Enhanced logout to clear all sensitive data
 * @see AC-5.6.7.6 - Logout clears all sensitive data from localStorage
 */
export async function logout(): Promise<void> {
  const baseUrl = getBaseUrl();

  // Always clear local state first
  clearSessionState();

  try {
    // Ensure we have a CSRF token for the logout request
    await ensureCSRFToken(`${baseUrl}/api/auth`);

    // Call server to invalidate session
    await csrfFetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
    });
  } catch (error) {
    // Ignore errors - continue with local cleanup
    if (import.meta.env.DEV) {
      console.warn('[authCookieClient] Logout request failed:', error);
    }
  }

  // FOS-5.6.7: Clear all sensitive data from localStorage/sessionStorage
  // This includes auth tokens, PII (email, name), and session markers
  clearAllSensitiveData();
}

/**
 * Check if user has an active session
 * Calls server to verify cookie-based session exists
 */
export async function checkSession(): Promise<SessionStatus> {
  const baseUrl = getBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'GET',
      credentials: 'include',
    });

    const data = await response.json();

    const status: SessionStatus = {
      authenticated: data.authenticated === true,
      userId: data.user_id,
      accessExpiresAt: data.access_expires_at,
      refreshExpiresAt: data.refresh_expires_at,
    };

    updateSessionState(status);
    return status;
  } catch (error) {
    console.warn('[authCookieClient] Session check failed:', error);
    clearSessionState();
    return { authenticated: false };
  }
}

/**
 * Check if access token appears expired based on in-memory state
 * Note: This is a client-side estimate; actual validation is server-side
 */
export function isAccessTokenExpired(): boolean {
  if (!sessionState.accessExpiresAt) {
    return true;
  }
  // Add 30 second buffer for network latency
  return Date.now() >= sessionState.accessExpiresAt - 30000;
}

/**
 * Check if user appears authenticated based on in-memory state
 * Note: For authoritative check, use checkSession()
 */
export function isAuthenticated(): boolean {
  return sessionState.authenticated;
}

/**
 * Get user ID from in-memory session state
 */
export function getUserId(): string | undefined {
  return sessionState.userId;
}

// =============================================================================
// Export as object for easy import
// =============================================================================

export const cookieAuth = {
  login,
  logout,
  refreshTokens,
  checkSession,
  isAccessTokenExpired,
  isAuthenticated,
  getUserId,
  getSessionState,
  resetRateLimiter,
};

export default cookieAuth;
