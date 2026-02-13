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
// components that mount simultaneously.
// cachedUserId ensures the cache is scoped per-user: if user A logs out
// and user B logs in within the TTL, the stale entry is invalidated.
let cachedStatus: MembershipStatusValue | undefined;
let cachedUserId: string | undefined;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000; // 5 seconds

function isCacheValidForUser(userId: string | undefined): boolean {
  return (
    cachedStatus !== undefined &&
    cachedUserId !== undefined &&
    cachedUserId === userId &&
    Date.now() - cacheTimestamp < CACHE_TTL_MS
  );
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
  // Read current userId from in-memory session state to scope the cache
  const currentUserId = getSessionState().userId;

  const [membershipStatus, setMembershipStatus] = useState<MembershipStatusValue>(
    isCacheValidForUser(currentUserId) ? cachedStatus! : null
  );
  const [isLoading, setIsLoading] = useState(!isCacheValidForUser(currentUserId));

  useEffect(() => {
    // If cache is valid for the current user, use it immediately
    if (isCacheValidForUser(currentUserId)) {
      setMembershipStatus(cachedStatus!);
      setIsLoading(false);
      return;
    }

    // Check if in-memory session state already has membershipStatus
    const currentState = getSessionState();
    if (currentState.authenticated && currentState.membershipStatus !== undefined) {
      const status = toMembershipStatus(currentState.membershipStatus);
      cachedStatus = status;
      cachedUserId = currentState.userId;
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
        cachedUserId = session.userId;
        cacheTimestamp = Date.now();
        setMembershipStatus(status);
      } catch {
        if (cancelled) return;
        // Graceful degradation: session check failed
        cachedStatus = null;
        cachedUserId = undefined;
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
  }, [currentUserId]);

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
  cachedUserId = undefined;
  cacheTimestamp = 0;
}
