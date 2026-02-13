/**
 * useMembership Hook Tests
 *
 * Tests for session-based membership status hook.
 *
 * Story: BL-011.5 — Frontend Membership Gating
 * AC: 1, 8
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMembership, resetMembershipCache } from '../useMembership';

// Mock the authCookieClient module
vi.mock('@/services/authCookieClient', () => ({
  checkSession: vi.fn(),
  getSessionState: vi.fn(),
}));

import { checkSession, getSessionState } from '@/services/authCookieClient';

const mockCheckSession = vi.mocked(checkSession);
const mockGetSessionState = vi.mocked(getSessionState);

describe('useMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMembershipCache();
    // Default: no in-memory session state
    mockGetSessionState.mockReturnValue({ authenticated: false });
  });

  describe('Active member', () => {
    it('should return isActiveMember=true, isRegistered=false for Active status', async () => {
      mockCheckSession.mockResolvedValue({
        authenticated: true,
        userId: 'user-1',
        membershipStatus: 'Active',
      });

      const { result } = renderHook(() => useMembership());

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.membershipStatus).toBe('Active');
      expect(result.current.isActiveMember).toBe(true);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('Registered member', () => {
    it('should return isActiveMember=false, isRegistered=true for Registered status', async () => {
      mockCheckSession.mockResolvedValue({
        authenticated: true,
        userId: 'user-2',
        membershipStatus: 'Registered',
      });

      const { result } = renderHook(() => useMembership());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.membershipStatus).toBe('Registered');
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(true);
    });
  });

  describe('No membership (null)', () => {
    it('should return isActiveMember=false, isRegistered=false when no membership', async () => {
      mockCheckSession.mockResolvedValue({
        authenticated: true,
        userId: 'user-3',
        membershipStatus: null,
      });

      const { result } = renderHook(() => useMembership());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.membershipStatus).toBe(null);
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('Expired membership', () => {
    it('should return isActiveMember=false, isRegistered=false for Expired status', async () => {
      mockCheckSession.mockResolvedValue({
        authenticated: true,
        userId: 'user-4',
        membershipStatus: 'Expired',
      });

      const { result } = renderHook(() => useMembership());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.membershipStatus).toBe('Expired');
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('Session check failure — graceful degradation', () => {
    it('should default to null membership when session check fails', async () => {
      mockCheckSession.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useMembership());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.membershipStatus).toBe(null);
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('In-memory session state', () => {
    it('should use in-memory session state if available without making a server call', async () => {
      mockGetSessionState.mockReturnValue({
        authenticated: true,
        userId: 'user-5',
        membershipStatus: 'Active',
      });

      const { result } = renderHook(() => useMembership());

      // Should resolve immediately from in-memory state
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.membershipStatus).toBe('Active');
      expect(result.current.isActiveMember).toBe(true);
      // Should NOT have called checkSession since in-memory state was available
      expect(mockCheckSession).not.toHaveBeenCalled();
    });
  });

  describe('Unknown membership status', () => {
    it('should treat unknown status values as null', async () => {
      mockCheckSession.mockResolvedValue({
        authenticated: true,
        userId: 'user-6',
        membershipStatus: 'SomeUnknownStatus',
      });

      const { result } = renderHook(() => useMembership());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.membershipStatus).toBe(null);
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('User-scoped cache (AI-R64)', () => {
    it('should invalidate cache when userId changes between renders', async () => {
      // User A logs in with Active membership
      mockGetSessionState.mockReturnValue({
        authenticated: true,
        userId: 'user-A',
        membershipStatus: 'Active',
      });

      const { result, unmount } = renderHook(() => useMembership());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.membershipStatus).toBe('Active');
      expect(result.current.isActiveMember).toBe(true);
      unmount();

      // User A logs out, user B logs in with Registered membership
      // Cache from user A is still within TTL
      mockGetSessionState.mockReturnValue({
        authenticated: true,
        userId: 'user-B',
        membershipStatus: 'Registered',
      });

      const { result: result2 } = renderHook(() => useMembership());

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // Must see user B's status, NOT user A's cached status
      expect(result2.current.membershipStatus).toBe('Registered');
      expect(result2.current.isActiveMember).toBe(false);
      expect(result2.current.isRegistered).toBe(true);
    });

    it('should use cache when same user re-mounts within TTL', async () => {
      // User A logs in
      mockGetSessionState.mockReturnValue({
        authenticated: true,
        userId: 'user-A',
        membershipStatus: 'Active',
      });

      const { result, unmount } = renderHook(() => useMembership());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.membershipStatus).toBe('Active');
      unmount();

      // Same user re-mounts — cache should be reused
      const { result: result2 } = renderHook(() => useMembership());

      // Should resolve immediately from cache (no loading state)
      expect(result2.current.isLoading).toBe(false);
      expect(result2.current.membershipStatus).toBe('Active');
      expect(result2.current.isActiveMember).toBe(true);

      // Should NOT have called checkSession since cache was valid for same user
      expect(mockCheckSession).not.toHaveBeenCalled();
    });
  });
});
