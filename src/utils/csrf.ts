/**
 * CSRF Token Utilities
 *
 * FOS-5.6.6: Frontend Token Security
 * Client-side utilities for CSRF protection using the double-submit cookie pattern.
 *
 * @see AC-5.6.6.3 - CSRF tokens implemented for all state-changing requests
 *
 * How it works:
 * 1. Server sets a CSRF token in a non-httpOnly cookie on login/refresh
 * 2. Frontend reads the cookie and includes token in X-CSRF-Token header
 * 3. Server validates that cookie value matches header value
 *
 * This prevents CSRF because:
 * - Attacker can't read cookies from victim's browser (same-origin policy)
 * - Attacker can't set the correct header value without knowing the token
 */

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Get the CSRF token from the cookie
 *
 * @returns The CSRF token or null if not found
 */
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Attach CSRF token header to a Headers object
 *
 * @param headers - Headers object to modify
 * @param options - Configuration options
 * @param options.strict - If true, throws error when token is missing (default: false)
 * @returns The modified Headers object
 * @throws Error if strict mode is enabled and no CSRF token is available
 *
 * @example
 * ```typescript
 * const headers = new Headers();
 * headers.set('Content-Type', 'application/json');
 * attachCSRFHeader(headers);
 *
 * // In strict mode (throws if token missing):
 * attachCSRFHeader(headers, { strict: true });
 *
 * fetch('/api/submit', { method: 'POST', headers, body: ... });
 * ```
 */
export function attachCSRFHeader(
  headers: Headers,
  options: { strict?: boolean } = {}
): Headers {
  const token = getCSRFToken();
  if (!token) {
    if (options.strict) {
      throw new Error('CSRF token required but not available. Ensure ensureCSRFToken() was called.');
    }
    console.warn('[CSRF] No CSRF token available. Request may be rejected.');
  } else {
    headers.set(CSRF_HEADER_NAME, token);
  }
  return headers;
}

/**
 * Create headers with CSRF token for state-changing requests
 *
 * @param additionalHeaders - Additional headers to include
 * @returns Headers object with CSRF token and additional headers
 *
 * @example
 * ```typescript
 * const headers = createCSRFHeaders({ 'Content-Type': 'application/json' });
 * fetch('/api/submit', { method: 'POST', headers, body: ... });
 * ```
 */
export function createCSRFHeaders(
  additionalHeaders: Record<string, string> = {}
): Headers {
  const headers = new Headers(additionalHeaders);
  attachCSRFHeader(headers);
  return headers;
}

/**
 * Fetch with CSRF protection for state-changing requests
 *
 * Automatically includes CSRF token header for POST, PUT, PATCH, DELETE requests.
 * GET, HEAD, OPTIONS requests skip CSRF (they shouldn't change state).
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Fetch response promise
 *
 * @example
 * ```typescript
 * // POST request - CSRF token automatically included
 * await csrfFetch('/api/submit', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' }),
 * });
 *
 * // GET request - CSRF token skipped
 * await csrfFetch('/api/data');
 * ```
 */
export async function csrfFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();

  // Only add CSRF token for state-changing methods
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!stateChangingMethods.includes(method)) {
    return fetch(url, options);
  }

  // Create headers with CSRF token
  const headers = new Headers(options.headers);
  attachCSRFHeader(headers);

  // Always include credentials for cookie-based auth
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

/**
 * Check if CSRF token is available
 *
 * @returns True if CSRF token exists in cookies
 */
export function hasCSRFToken(): boolean {
  return getCSRFToken() !== null;
}

/**
 * Request a new CSRF token from the server
 *
 * Call this on initial page load or after a token expires.
 * The server will set a new CSRF token cookie.
 *
 * @param baseUrl - Base URL for auth endpoints (defaults to /api/auth)
 * @returns The new CSRF token
 * @throws Error if token fetch fails
 */
export async function fetchCSRFToken(
  baseUrl: string = '/api/auth'
): Promise<string> {
  const response = await fetch(`${baseUrl}/csrf-token`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token: ${response.status}`);
  }

  const data = await response.json();

  if (!data.csrf_token) {
    throw new Error('No CSRF token in response');
  }

  return data.csrf_token;
}

/**
 * Ensure CSRF token exists, fetching one if needed
 *
 * Use this at app initialization to ensure CSRF protection is ready.
 *
 * @param baseUrl - Base URL for auth endpoints
 * @returns The CSRF token (existing or newly fetched)
 */
export async function ensureCSRFToken(
  baseUrl: string = '/api/auth'
): Promise<string> {
  const existing = getCSRFToken();
  if (existing) {
    return existing;
  }

  return fetchCSRFToken(baseUrl);
}
