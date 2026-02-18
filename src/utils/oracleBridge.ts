/**
 * Oracle Bridge URL Utility
 *
 * Single source of truth for resolving the oracle-bridge base URL.
 * Reads VITE_ORACLE_BRIDGE_URL env var, falls back to same-origin in
 * production (IC asset canister) or localhost:3000 in development/test.
 *
 * AI-R107: Extracted from duplicate copies in memberService, Settings, and
 * notificationPreferencesService.
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
