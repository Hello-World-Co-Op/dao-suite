/**
 * useMembership Hook Tests
 *
 * Tests for the thin wrapper around useAuth() that provides
 * membership-specific derived state.
 *
 * Story: BL-011.5 — Frontend Membership Gating
 * Story: BL-027.3 — Dashboard Token Balance Uses IC Principal
 * Story: BL-030.1 — Migrate to useAuth() context
 * AC: 1, 6, 8 (BL-030.1)
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMembership } from '../useMembership';

// Mock useAuth from @hello-world-co-op/auth
const mockUseAuth = vi.fn();
vi.mock('@hello-world-co-op/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('useMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user with no membership
    mockUseAuth.mockReturnValue({
      user: { userId: 'test-user-123', email: 'test@example.com', providers: ['EmailPassword'] },
      isAuthenticated: true,
      isLoading: false,
      displayName: 'Test User',
      icPrincipal: null,
      membershipStatus: null,
      refresh: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      roles: [],
      hasRole: vi.fn(() => false),
      isAdmin: false,
      error: null,
      isBypassed: false,
    });
  });

  describe('Active member', () => {
    it('should return isActiveMember=true, isRegistered=false for Active status', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: 'Active',
        icPrincipal: 'gbzb4-test-principal',
        isLoading: false,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.membershipStatus).toBe('Active');
      expect(result.current.isActiveMember).toBe(true);
      expect(result.current.isRegistered).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.icPrincipal).toBe('gbzb4-test-principal');
    });
  });

  describe('Registered member', () => {
    it('should return isActiveMember=false, isRegistered=true for Registered status', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: 'Registered',
        icPrincipal: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.membershipStatus).toBe('Registered');
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(true);
    });
  });

  describe('No membership (null)', () => {
    it('should return isActiveMember=false, isRegistered=false when no membership', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: null,
        icPrincipal: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.membershipStatus).toBe(null);
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('Expired membership', () => {
    it('should return isActiveMember=false, isRegistered=false for Expired status', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: 'Expired',
        icPrincipal: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.membershipStatus).toBe('Expired');
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('Revoked membership', () => {
    it('should return isActiveMember=false, isRegistered=false for Revoked status', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: 'Revoked',
        icPrincipal: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.membershipStatus).toBe('Revoked');
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('Loading state', () => {
    it('should pass through isLoading from useAuth()', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: null,
        icPrincipal: null,
        isLoading: true,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Unknown membership status', () => {
    it('should treat unknown status values as null', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: 'SomeUnknownStatus',
        icPrincipal: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.membershipStatus).toBe(null);
      expect(result.current.isActiveMember).toBe(false);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('icPrincipal from useAuth() (BL-027.2, BL-030.1)', () => {
    it('should return icPrincipal when present in auth context', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: 'Active',
        icPrincipal: '2vxsx-fae',
        isLoading: false,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.icPrincipal).toBe('2vxsx-fae');
    });

    it('should return icPrincipal null when user has not linked II', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: 'Registered',
        icPrincipal: null,
        isLoading: false,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.icPrincipal).toBeNull();
    });

    it('should normalize undefined icPrincipal to null', () => {
      mockUseAuth.mockReturnValue({
        membershipStatus: 'Active',
        icPrincipal: undefined,
        isLoading: false,
      });

      const { result } = renderHook(() => useMembership());

      expect(result.current.icPrincipal).toBeNull();
    });
  });
});
