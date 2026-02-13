/**
 * useMembership Hook
 *
 * Session-based membership status hook for UI gating.
 * Reads membership_status from the oracle-bridge session (BL-011.4).
 * Does NOT call the membership canister directly.
 *
 * Story: BL-011.5 — Frontend Membership Gating
 * AC: 1
 */

import { useState, useEffect } from 'react';
import { checkSession, getSessionState } from '@/services/authCookieClient';

export type MembershipStatusValue = 'Registered' | 'Active' | 'Expired' | 'Revoked' | null;

export interface UseMembershipResult {
  membershipStatus: MembershipStatusValue;
  isActiveMember: boolean;
  isRegistered: boolean;
  isLoading: boolean;
}

// Module-level cache to avoid redundant session calls across
// components that mount simultaneously
let cachedStatus: MembershipStatusValue | undefined;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000; // 5 seconds

function isCacheValid(): boolean {
  return cachedStatus !== undefined && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

function toMembershipStatus(raw: string | null | undefined): MembershipStatusValue {
  if (raw === 'Active' || raw === 'Registered' || raw === 'Expired' || raw === 'Revoked') {
    return raw;
  }
  return null;
}

/**
 * Hook to get current user's membership status from the session.
 *
 * Returns:
 * - membershipStatus: "Registered" | "Active" | "Expired" | "Revoked" | null
 * - isActiveMember: true only when membershipStatus === "Active"
 * - isRegistered: true when membershipStatus === "Registered"
 * - isLoading: true while fetching session
 */
export function useMembership(): UseMembershipResult {
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatusValue>(
    isCacheValid() ? cachedStatus! : null
  );
  const [isLoading, setIsLoading] = useState(!isCacheValid());

  useEffect(() => {
    // If cache is valid, use it immediately
    if (isCacheValid()) {
      setMembershipStatus(cachedStatus!);
      setIsLoading(false);
      return;
    }

    // Check if in-memory session state already has membershipStatus
    const currentState = getSessionState();
    if (currentState.authenticated && currentState.membershipStatus !== undefined) {
      const status = toMembershipStatus(currentState.membershipStatus);
      cachedStatus = status;
      cacheTimestamp = Date.now();
      setMembershipStatus(status);
      setIsLoading(false);
      return;
    }

    // Otherwise, fetch from server
    let cancelled = false;

    async function fetchMembership() {
      try {
        const session = await checkSession();
        if (cancelled) return;

        const status = toMembershipStatus(session.membershipStatus);
        cachedStatus = status;
        cacheTimestamp = Date.now();
        setMembershipStatus(status);
      } catch {
        if (cancelled) return;
        // Graceful degradation: session check failed
        cachedStatus = null;
        cacheTimestamp = Date.now();
        setMembershipStatus(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchMembership();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    membershipStatus,
    isActiveMember: membershipStatus === 'Active',
    isRegistered: membershipStatus === 'Registered',
    isLoading,
  };
}

/**
 * Reset the module-level cache (for testing only)
 * @internal
 */
export function resetMembershipCache(): void {
  cachedStatus = undefined;
  cacheTimestamp = 0;
}
