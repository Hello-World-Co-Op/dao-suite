/**
 * Return URL Validation Utility
 *
 * Prevents open redirect vulnerabilities by validating and sanitizing
 * return URLs before redirect. Only allows relative paths to known
 * application routes.
 *
 * @see FOS-5.6.5 AC-5.6.5.1 - Open redirect vulnerability fix
 * @see OWASP Unvalidated Redirects and Forwards
 *
 * @module validateReturnUrl
 */

/**
 * Allowed path prefixes for redirects.
 * Only paths starting with these prefixes are considered valid.
 * Updated to match actual dao-suite routes from App.tsx.
 */
const ALLOWED_PATH_PREFIXES = [
  '/dashboard',
  '/settings',
  '/kyc',
  '/membership',
  '/renewal',
  '/payment',
  '/proposals',
  '/notifications',
  '/burn-donation',
  '/escrow',
  '/members',
];

/**
 * Default redirect destination when validation fails
 */
const DEFAULT_REDIRECT = '/dashboard';

/**
 * Validates and sanitizes a return URL to prevent open redirect attacks.
 *
 * Security checks:
 * - Rejects absolute URLs (http://, https://)
 * - Rejects protocol-relative URLs (//)
 * - Rejects dangerous URI schemes (data:, javascript:)
 * - Validates against allowlist of path prefixes
 * - Handles URL-encoded payloads
 *
 * @param url - The return URL to validate (may be URL-encoded)
 * @returns A safe, validated relative path or the default redirect
 *
 * @example
 * validateReturnUrl('/dashboard')           // Returns: '/dashboard'
 * validateReturnUrl('/profile/settings')    // Returns: '/profile/settings'
 * validateReturnUrl('https://evil.com')     // Returns: '/dashboard' (default)
 * validateReturnUrl('//evil.com/phishing')  // Returns: '/dashboard' (default)
 */
export function validateReturnUrl(url: string | null | undefined): string {
  if (!url) {
    return DEFAULT_REDIRECT;
  }

  try {
    // Decode URL-encoded payloads to catch bypass attempts
    const decoded = decodeURIComponent(url);

    // Reject absolute URLs (http://, https://)
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      console.warn('[Security] Rejected absolute redirect URL:', decoded);
      return DEFAULT_REDIRECT;
    }

    // Reject protocol-relative URLs (//) which browsers treat as absolute
    if (decoded.startsWith('//')) {
      console.warn('[Security] Rejected protocol-relative redirect URL:', decoded);
      return DEFAULT_REDIRECT;
    }

    // Reject dangerous URI schemes
    const lowerDecoded = decoded.toLowerCase();
    if (lowerDecoded.startsWith('data:') || lowerDecoded.startsWith('javascript:')) {
      console.warn('[Security] Rejected dangerous URI scheme:', decoded);
      return DEFAULT_REDIRECT;
    }

    // Must start with / to be a relative path
    if (!decoded.startsWith('/')) {
      console.warn('[Security] Rejected non-relative path:', decoded);
      return DEFAULT_REDIRECT;
    }

    // Validate against allowed prefixes
    const isAllowed = ALLOWED_PATH_PREFIXES.some(
      (prefix) => decoded === prefix || decoded.startsWith(prefix + '/')
    );

    if (!isAllowed) {
      // Allow root path as a special case
      if (decoded === '/') {
        return DEFAULT_REDIRECT;
      }
      console.warn('[Security] Redirect path not in allowlist:', decoded);
      return DEFAULT_REDIRECT;
    }

    return decoded;
  } catch {
    // Handle malformed URL encoding
    console.warn('[Security] Failed to decode return URL:', url);
    return DEFAULT_REDIRECT;
  }
}
