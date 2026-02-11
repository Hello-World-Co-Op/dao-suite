/**
 * GDPR Consent Management Utility
 *
 * Manages user consent for analytics tracking.
 * Respects Do Not Track (DNT) browser settings.
 */

// Extend interfaces for non-standard DNT properties
declare global {
  interface Window {
    doNotTrack?: string;
  }
  interface Navigator {
    msDoNotTrack?: string;
  }
}

const CONSENT_KEY = 'analytics_consent';
const CONSENT_TIMESTAMP_KEY = 'analytics_consent_timestamp';

export type ConsentStatus = 'granted' | 'denied' | 'pending';

/**
 * Check if user's browser has Do Not Track enabled
 */
export function isDNTEnabled(): boolean {
  // Check multiple DNT header formats
  const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;

  // DNT can be "1" (enabled), "0" (disabled), or null (unspecified)
  return dnt === '1' || dnt === 'yes';
}

/**
 * Get current consent status
 * Returns 'denied' if DNT is enabled
 */
export function getConsentStatus(): ConsentStatus {
  // Respect Do Not Track setting - if enabled, always return denied
  if (isDNTEnabled()) {
    return 'denied';
  }

  const storedConsent = localStorage.getItem(CONSENT_KEY);

  if (storedConsent === 'granted' || storedConsent === 'denied') {
    return storedConsent as ConsentStatus;
  }

  return 'pending';
}

/**
 * Set consent status
 */
export function setConsentStatus(status: 'granted' | 'denied'): void {
  localStorage.setItem(CONSENT_KEY, status);
  localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString());

  // Dispatch custom event so other parts of the app can react
  window.dispatchEvent(
    new CustomEvent('consentchange', {
      detail: { consent: status },
    })
  );
}

/**
 * Grant analytics consent
 */
export function grantConsent(): void {
  setConsentStatus('granted');
}

/**
 * Deny analytics consent
 */
export function denyConsent(): void {
  setConsentStatus('denied');
}

/**
 * Check if user has granted consent
 */
export function hasConsent(): boolean {
  return getConsentStatus() === 'granted';
}

/**
 * Check if consent is still pending (user hasn't made a choice)
 */
export function isConsentPending(): boolean {
  return getConsentStatus() === 'pending';
}

/**
 * Get timestamp when consent was last updated
 */
export function getConsentTimestamp(): Date | null {
  const timestamp = localStorage.getItem(CONSENT_TIMESTAMP_KEY);
  return timestamp ? new Date(timestamp) : null;
}

/**
 * Clear all consent data (useful for testing or user request)
 */
export function clearConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
  localStorage.removeItem(CONSENT_TIMESTAMP_KEY);
}
