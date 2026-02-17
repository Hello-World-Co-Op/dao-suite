/**
 * Authentication Error-Handling Utilities
 *
 * Centralized utilities for handling token expiration errors,
 * auth error detection, and automatic logout/redirect.
 *
 * BL-030.2: localStorage-dependent functions (getUserData, setUserData,
 * isAuthenticated, requireAuth, UserData) removed. Use useAuth() from
 * @hello-world-co-op/auth for authentication state.
 */

import { createLogger } from './logger';
import { clearAllSensitiveData } from './securityClear';

const log = createLogger('Auth');

/**
 * Clear authentication data and redirect to login
 *
 * FOS-5.6.7: Enhanced to use centralized clearAllSensitiveData
 * @see AC-5.6.7.6 - Logout clears all sensitive data
 *
 * @param reason - Optional reason for logout (shown to user)
 * @param returnUrl - Optional URL to return to after re-login
 */
export function handleSessionExpired(reason?: string, returnUrl?: string): void {
  log.debug('Session expired, clearing data and redirecting to login');

  // FOS-5.6.7: Clear all sensitive data (auth tokens, PII, session markers)
  clearAllSensitiveData();

  // Build redirect URL with query params
  const params = new URLSearchParams();

  if (reason) {
    params.set('message', reason);
  } else {
    params.set('message', 'Your session has expired. Please sign in again.');
  }

  if (returnUrl) {
    params.set('returnUrl', returnUrl);
  } else {
    // Use current path as return URL (if not already on login page)
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/register') {
      params.set('returnUrl', currentPath);
    }
  }

  // Redirect to login page
  window.location.href = `/login?${params.toString()}`;
}

/**
 * Check if an error indicates token expiration
 */
export function isTokenExpiredError(error: unknown): boolean {
  if (!error) return false;

  const errorString = String(error).toLowerCase();

  return (
    errorString.includes('token expired') ||
    errorString.includes('access token expired') ||
    errorString.includes('session expired') ||
    errorString.includes('unauthorized') ||
    errorString.includes('unauthenticated') ||
    errorString.includes('invalid session') ||
    errorString.includes('invalid token')
  );
}

/**
 * Check if an error indicates authentication failure
 */
export function isAuthError(error: unknown): boolean {
  if (!error) return false;

  const errorString = String(error).toLowerCase();

  return (
    isTokenExpiredError(error) ||
    errorString.includes('not authenticated') ||
    errorString.includes('authentication required') ||
    errorString.includes('login required')
  );
}

/**
 * Wrap an async function with automatic session expiration handling
 *
 * Usage:
 * ```ts
 * const result = await withAuthErrorHandler(async () => {
 *   return await someApiCall();
 * });
 * ```
 */
export async function withAuthErrorHandler<T>(
  fn: () => Promise<T>,
  returnUrl?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Check if it's an auth error
    if (isAuthError(error)) {
      handleSessionExpired('Your session has expired. Please sign in again.', returnUrl);
      // Throw to prevent further execution
      throw error;
    }
    // Re-throw non-auth errors
    throw error;
  }
}

/**
 * Check an API response for auth errors and handle appropriately
 * Use this after API calls that return { success: boolean, message: string }
 *
 * @param response - The API response object
 * @param returnUrl - URL to return to after re-login
 * @returns true if auth error was detected and handled (redirect initiated)
 */
export function checkResponseForAuthError(
  response: { success?: boolean; message?: string } | string | unknown,
  returnUrl?: string
): boolean {
  let message: string | undefined;

  if (typeof response === 'string') {
    message = response;
  } else if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    if ('message' in r && typeof r.message === 'string') {
      message = r.message;
    } else if ('Err' in r && typeof r.Err === 'string') {
      message = r.Err;
    }
  }

  if (message && isAuthError(message)) {
    handleSessionExpired(
      'Your session has expired. Please sign in again.',
      returnUrl || window.location.pathname
    );
    return true;
  }

  return false;
}

/**
 * Wrap a canister call with automatic auth error handling
 * Handles both thrown errors and error responses
 *
 * Usage:
 * ```ts
 * const result = await withAuthCheck(
 *   () => myCanister.someMethod(args),
 *   '/current-page'
 * );
 * ```
 */
export async function withAuthCheck<T>(fn: () => Promise<T>, returnUrl?: string): Promise<T> {
  try {
    const result = await fn();

    // Check if result indicates auth error
    if (checkResponseForAuthError(result, returnUrl)) {
      throw new Error('Session expired');
    }

    return result;
  } catch (error) {
    // Check if thrown error is auth-related
    if (isAuthError(error)) {
      handleSessionExpired(
        'Your session has expired. Please sign in again.',
        returnUrl || window.location.pathname
      );
    }
    throw error;
  }
}
