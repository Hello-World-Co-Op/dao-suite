/**
 * Authentication Token Management
 *
 * Provides utilities for securely storing and managing authentication tokens
 * (access tokens and refresh tokens) using localStorage with fallback support.
 *
 * Security considerations:
 * - Tokens are stored in localStorage (consider httpOnly cookies for enhanced security)
 * - Device fingerprint is generated client-side for session tracking
 * - Tokens should be transmitted over HTTPS only in production
 *
 * TODO(FOS-5.6.6): Migrate token storage from localStorage to httpOnly cookies
 * See: docs/developer/auth-migration-plan.md for full migration plan
 * Security finding: FE-DAO-1 (CRITICAL)
 */

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const ACCESS_EXPIRES_KEY = 'auth_access_expires';
const REFRESH_EXPIRES_KEY = 'auth_refresh_expires';
const USER_ID_KEY = 'auth_user_id';

/**
 * Token storage interface
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  userId: string;
}

/**
 * Store authentication tokens securely
 */
export function storeTokens(tokens: AuthTokens): void {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    localStorage.setItem(ACCESS_EXPIRES_KEY, tokens.accessExpiresAt.toString());
    localStorage.setItem(REFRESH_EXPIRES_KEY, tokens.refreshExpiresAt.toString());
    localStorage.setItem(USER_ID_KEY, tokens.userId);
  } catch (error) {
    console.error('Failed to store auth tokens:', error);
    throw new Error('Failed to store authentication tokens');
  }
}

/**
 * Get the current access token
 */
export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to retrieve access token:', error);
    return null;
  }
}

/**
 * Get the current refresh token
 */
export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to retrieve refresh token:', error);
    return null;
  }
}

/**
 * Get the user ID
 */
export function getUserId(): string | null {
  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch (error) {
    console.error('Failed to retrieve user ID:', error);
    return null;
  }
}

/**
 * Get all stored tokens
 */
export function getStoredTokens(): AuthTokens | null {
  try {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const accessExpires = localStorage.getItem(ACCESS_EXPIRES_KEY);
    const refreshExpires = localStorage.getItem(REFRESH_EXPIRES_KEY);
    const userId = localStorage.getItem(USER_ID_KEY);

    if (!accessToken || !refreshToken || !accessExpires || !refreshExpires || !userId) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      accessExpiresAt: parseInt(accessExpires, 10),
      refreshExpiresAt: parseInt(refreshExpires, 10),
      userId,
    };
  } catch (error) {
    console.error('Failed to retrieve stored tokens:', error);
    return null;
  }
}

/**
 * Check if the access token is expired
 * Note: Expiry times are stored in milliseconds (not IC nanoseconds) to avoid
 * exceeding JavaScript's MAX_SAFE_INTEGER
 */
export function isAccessTokenExpired(): boolean {
  try {
    const expiresAt = localStorage.getItem(ACCESS_EXPIRES_KEY);
    if (!expiresAt) {
      return true;
    }

    const expiryTime = parseInt(expiresAt, 10);
    const now = Date.now(); // Milliseconds

    return now >= expiryTime;
  } catch (error) {
    console.error('Failed to check token expiry:', error);
    return true;
  }
}

/**
 * Check if user has valid authentication
 * Note: Expiry times are stored in milliseconds (not IC nanoseconds) to avoid
 * exceeding JavaScript's MAX_SAFE_INTEGER
 */
export function isAuthenticated(): boolean {
  const tokens = getStoredTokens();
  if (!tokens) {
    return false;
  }

  // Check if refresh token is still valid (times are in milliseconds)
  const now = Date.now();
  return now < tokens.refreshExpiresAt;
}

/**
 * Clear all authentication tokens (logout)
 */
export function clearTokens(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ACCESS_EXPIRES_KEY);
    localStorage.removeItem(REFRESH_EXPIRES_KEY);
    localStorage.removeItem(USER_ID_KEY);
  } catch (error) {
    console.error('Failed to clear auth tokens:', error);
  }
}

/**
 * Generate a device fingerprint for session tracking
 *
 * @deprecated Use getDeviceFingerprint() from utils/deviceFingerprint.ts for async FingerprintJS-based fingerprinting.
 * FOS-5.6.5: This legacy implementation is kept for backwards compatibility.
 */
export function generateDeviceFingerprint(): string {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      !!window.sessionStorage,
      !!window.localStorage,
    ];

    const fingerprint = components.join('|');

    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return `fp-${Math.abs(hash).toString(36)}`;
  } catch (error) {
    console.error('Failed to generate device fingerprint:', error);
    return `fp-${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Get client timezone
 */
export function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (_error) {
    return 'UTC';
  }
}

/**
 * Get user agent string
 */
export function getUserAgent(): string {
  return navigator.userAgent;
}
