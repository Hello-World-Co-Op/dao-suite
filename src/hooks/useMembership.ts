/**
 * useMembership Hook
 *
 * Thin wrapper around useAuth() that provides membership-specific
 * derived state. Reads membershipStatus and icPrincipal directly
 * from AuthContext (populated by oracle-bridge session check on mount).
 *
 * Story: BL-011.5 — Frontend Membership Gating
 * Story: BL-030.1 — Migrate to useAuth() context
 * AC: 1, 6
 */

import { useAuth } from '@hello-world-co-op/auth';

export type MembershipStatusValue = 'Registered' | 'Active' | 'Expired' | 'Revoked' | null;

export interface UseMembershipResult {
  membershipStatus: MembershipStatusValue;
  isActiveMember: boolean;
  isRegistered: boolean;
  isLoading: boolean;
  icPrincipal: string | null;
}

function toMembershipStatus(raw: string | null | undefined): MembershipStatusValue {
  if (raw === 'Active' || raw === 'Registered' || raw === 'Expired' || raw === 'Revoked') {
    return raw;
  }
  return null;
}

/**
 * Hook to get current user's membership status from the auth context.
 *
 * Returns:
 * - membershipStatus: "Registered" | "Active" | "Expired" | "Revoked" | null
 * - isActiveMember: true only when membershipStatus === "Active"
 * - isRegistered: true when membershipStatus === "Registered"
 * - isLoading: true while auth session is being checked on mount
 * - icPrincipal: IC principal string or null if not linked
 */
export function useMembership(): UseMembershipResult {
  const { membershipStatus: rawStatus, icPrincipal, isLoading } = useAuth();
  const membershipStatus = toMembershipStatus(rawStatus);
  return {
    membershipStatus,
    isActiveMember: membershipStatus === 'Active',
    isRegistered: membershipStatus === 'Registered',
    isLoading,
    icPrincipal: icPrincipal ?? null,
  };
}
