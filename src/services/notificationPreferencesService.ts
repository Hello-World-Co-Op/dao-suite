/**
 * Notification Preferences Service
 *
 * Service for managing canister-backed notification preferences via oracle-bridge.
 * All calls use cookie-based auth (credentials: 'include').
 *
 * Story: BL-022.2
 * ACs: 6, 7
 */

// ============================================================================
// Types
// ============================================================================

export interface CanisterNotificationCategories {
  proposals: boolean;
  votes: boolean;
  mentions: boolean;
  system: boolean;
  treasury: boolean;
  membership: boolean;
}

export interface CanisterNotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_toasts: boolean;
  categories: CanisterNotificationCategories;
}

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_CANISTER_PREFERENCES: CanisterNotificationPreferences = {
  email_enabled: true,
  push_enabled: true,
  in_app_toasts: true,
  categories: {
    proposals: true,
    votes: true,
    mentions: true,
    system: true,
    treasury: true,
    membership: true,
  },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get oracle-bridge base URL.
 * Same pattern as Settings.tsx and memberService.ts.
 */
export function getOracleBridgeUrl(): string {
  if (import.meta.env.VITE_ORACLE_BRIDGE_URL) {
    return import.meta.env.VITE_ORACLE_BRIDGE_URL;
  }
  if (import.meta.env.PROD) {
    return ''; // Same-origin in production (IC asset canister)
  }
  return 'http://localhost:3000';
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch notification preferences from oracle-bridge.
 * Returns canister-backed preferences or defaults if none exist.
 *
 * @throws Error on non-2xx response
 */
export async function getNotificationPreferences(): Promise<CanisterNotificationPreferences> {
  const baseUrl = getOracleBridgeUrl();
  const response = await fetch(`${baseUrl}/api/notifications/preferences`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load notification preferences: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Update notification preferences via oracle-bridge.
 * Supports partial merge — only provided fields are updated.
 *
 * @throws Error on non-2xx response
 */
export async function updateCanisterNotificationPreferences(
  prefs: Partial<CanisterNotificationPreferences>
): Promise<void> {
  const baseUrl = getOracleBridgeUrl();
  const response = await fetch(`${baseUrl}/api/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(prefs),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to save notification preferences: ${response.status} ${text}`);
  }
}
