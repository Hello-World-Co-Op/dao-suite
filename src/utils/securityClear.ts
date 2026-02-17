/**
 * Security Clear Utility
 *
 * FOS-5.6.7: Frontend Security Headers
 * Centralized function to clear all sensitive data from browser storage.
 *
 * @see AC-5.6.7.6 - Logout clears all sensitive data
 *
 * Usage:
 * ```typescript
 * import { clearAllSensitiveData } from './securityClear';
 *
 * // On logout
 * clearAllSensitiveData();
 * ```
 */

// =============================================================================
// Constants - Keys that store sensitive data
// =============================================================================

/**
 * Auth-related keys that contain tokens or session info
 */
const AUTH_KEYS = [
  'access_token',
  'refresh_token',
  'access_expires_at',
  'refresh_expires_at',
  'user_id',
  'session_id',
  // FOS-style prefixed keys
  'fos_access_token',
  'fos_refresh_token',
  'fos_access_expires_at',
  'fos_refresh_expires_at',
  'fos_user_id',
  'fos_session_id',
];

/**
 * PII keys that contain personal information
 */
const PII_KEYS = [
  'user_profile',
  'user_email',
  'user_name',
  'verify_firstName',
  'verify_lastName',
  'verify_email',
  'kyc_status',
];

/**
 * Session/state keys that should be cleared
 */
const SESSION_KEYS = ['ii_linked'];

/**
 * Keys that are safe to keep (preferences, not PII)
 */
const SAFE_TO_KEEP = [
  'analytics_consent',
  'analytics_consent_timestamp',
  'i18nextLng',
  'theme',
  // Form drafts are tied to forms, not sensitive
  // Proposal notification caches don't contain PII
];

// =============================================================================
// Production-safe Logging
// =============================================================================

/**
 * Log info with appropriate detail level
 */
function logInfo(context: string): void {
  if (import.meta.env.DEV) {
    console.info(`[securityClear] ${context}`);
  }
}

// =============================================================================
// Clear Functions
// =============================================================================

/**
 * Clear all auth-related data from localStorage
 */
function clearAuthData(): void {
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key);
  }
}

/**
 * Clear all PII from localStorage
 */
function clearPIIData(): void {
  for (const key of PII_KEYS) {
    localStorage.removeItem(key);
  }
}

/**
 * Clear session-related data
 */
function clearSessionData(): void {
  for (const key of SESSION_KEYS) {
    localStorage.removeItem(key);
  }
}

/**
 * Clear all sessionStorage (encryption keys, session state)
 * sessionStorage is cleared when tab/browser closes, but we also
 * clear it explicitly on logout for immediate effect
 */
function clearSessionStorage(): void {
  sessionStorage.clear();
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Clear all sensitive data from browser storage
 *
 * This function should be called on logout to ensure:
 * - Auth tokens are removed from localStorage
 * - PII (email, name, profile) is removed
 * - Session state is cleared
 * - sessionStorage is cleared
 *
 * Safe to call multiple times (idempotent)
 */
export function clearAllSensitiveData(): void {
  logInfo('Clearing all sensitive data from browser storage');

  // 1. Clear plain auth data (legacy/fallback)
  clearAuthData();

  // 2. Clear PII (user email, name, profile)
  clearPIIData();

  // 3. Clear session markers
  clearSessionData();

  // 4. Clear all sessionStorage
  // This removes any cached state, etc.
  clearSessionStorage();

  logInfo('Sensitive data cleared');
}

/**
 * Check if any sensitive data remains in storage
 * Useful for testing and verification
 *
 * @returns Array of keys that still contain sensitive data
 */
export function auditSensitiveData(): string[] {
  const found: string[] = [];

  // Check auth keys
  for (const key of AUTH_KEYS) {
    if (localStorage.getItem(key) !== null) {
      found.push(`localStorage:${key}`);
    }
  }

  // Check PII keys
  for (const key of PII_KEYS) {
    if (localStorage.getItem(key) !== null) {
      found.push(`localStorage:${key}`);
    }
  }

  // Check session keys
  for (const key of SESSION_KEYS) {
    if (localStorage.getItem(key) !== null) {
      found.push(`localStorage:${key}`);
    }
  }

  return found;
}

/**
 * Get list of allowed localStorage keys (non-sensitive)
 * Useful for documentation and testing
 */
export function getAllowedKeys(): readonly string[] {
  return SAFE_TO_KEEP;
}
