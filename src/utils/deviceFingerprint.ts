/**
 * Device Fingerprint Utility
 *
 * Uses FingerprintJS for reliable, collision-resistant device fingerprinting.
 * Fingerprints are cached in memory for the session duration.
 *
 * @see FOS-5.6.5 AC-5.6.5.3 - Improve device fingerprinting
 * @see https://dev.fingerprint.com/docs
 *
 * @module deviceFingerprint
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

/**
 * Cached fingerprint for the current session.
 * Using memory cache instead of localStorage to avoid XSS exposure.
 */
let cachedFingerprint: string | null = null;

/**
 * FingerprintJS agent instance (cached after first load)
 */
let fpAgent: Awaited<ReturnType<typeof FingerprintJS.load>> | null = null;

/**
 * Gets or generates a device fingerprint using FingerprintJS.
 *
 * Features:
 * - Uses FingerprintJS for collision-resistant fingerprinting
 * - Caches fingerprint in memory for session duration
 * - Falls back to crypto.randomUUID() if fingerprinting fails
 *
 * @returns A stable device identifier string (visitorId)
 *
 * @example
 * const fingerprint = await getDeviceFingerprint();
 * // Use fingerprint for session binding, rate limiting, etc.
 */
export async function getDeviceFingerprint(): Promise<string> {
  // Return cached fingerprint if available
  if (cachedFingerprint) {
    return cachedFingerprint;
  }

  try {
    // Load FingerprintJS agent (cached after first load)
    if (!fpAgent) {
      fpAgent = await FingerprintJS.load();
    }

    // Get the fingerprint
    const result = await fpAgent.get();
    cachedFingerprint = result.visitorId;
    return cachedFingerprint;
  } catch (error) {
    console.error('[Fingerprint] Failed to generate fingerprint:', error);

    // Fallback to random UUID if fingerprinting fails
    // This is less reliable but ensures we always have an identifier
    cachedFingerprint = crypto.randomUUID();
    return cachedFingerprint;
  }
}

/**
 * Clears the cached fingerprint.
 * Useful for testing or when user explicitly logs out.
 */
export function clearCachedFingerprint(): void {
  cachedFingerprint = null;
}
