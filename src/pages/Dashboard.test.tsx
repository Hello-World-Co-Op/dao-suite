/**
 * Dashboard Tests
 *
 * Tests for membership upgrade prompt display and icPrincipal usage.
 *
 * Story: BL-011.5 — Frontend Membership Gating
 * Story: BL-027.3 — Dashboard Token Balance Uses IC Principal
 * Story: BL-030.1 — Migrate to useAuth() context
 * AC: 2, 3, 8 (BL-011.5), 1 (BL-027.3), 2, 8 (BL-030.1)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock useAuth from @hello-world-co-op/auth
const mockUseAuth = vi.fn();
vi.mock('@hello-world-co-op/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock useMembership hook
const mockUseMembership = vi.fn();
vi.mock('@/hooks/useMembership', () => ({
  useMembership: () => mockUseMembership(),
}));

// Mock notification poller
vi.mock('@/services/notificationPoller', () => ({
  useNotificationPoller: vi.fn(() => ({
    isPolling: false,
    lastPollAt: null,
    error: null,
    isStale: false,
    isCanisterAvailable: true,
  })),
}));

// Mock TokenBalance to capture the principal prop
const mockTokenBalance = vi.fn();
vi.mock('@/components/TokenBalance', () => ({
  TokenBalance: (props: Record<string, unknown>) => {
    mockTokenBalance(props);
    return <div data-testid="token-balance">TokenBalance</div>;
  },
}));

vi.mock('@/components/TreasuryView', () => ({
  TreasuryView: () => <div data-testid="treasury-view">TreasuryView</div>,
}));

import Dashboard from './Dashboard';

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default auth mock — authenticated user
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

  describe('BL-030.1 AC2: Dashboard displays correct identity from useAuth()', () => {
    it('should show displayName in welcome heading', () => {
      mockUseMembership.mockReturnValue({
        membershipStatus: 'Active',
        isActiveMember: true,
        isRegistered: false,
        isLoading: false,
        icPrincipal: null,
      });

      renderDashboard();

      expect(screen.getByText('Welcome back, Test User!')).toBeInTheDocument();
    });

    it('should fall back to email prefix when displayName is null', () => {
      mockUseAuth.mockReturnValue({
        user: { userId: 'test-user-123', email: 'coby@example.com', providers: ['EmailPassword'] },
        isAuthenticated: true,
        isLoading: false,
        displayName: null,
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
      mockUseMembership.mockReturnValue({
        membershipStatus: null,
        isActiveMember: false,
        isRegistered: false,
        isLoading: false,
        icPrincipal: null,
      });

      renderDashboard();

      expect(screen.getByText('Welcome back, coby!')).toBeInTheDocument();
    });

    it('should show user email and userId from useAuth() context', () => {
      mockUseMembership.mockReturnValue({
        membershipStatus: 'Active',
        isActiveMember: true,
        isRegistered: false,
        isLoading: false,
        icPrincipal: null,
      });

      renderDashboard();

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('test-user-123')).toBeInTheDocument();
    });
  });

  describe('AC3: Upgrade prompt for Registered users', () => {
    it('should show upgrade prompt when user is Registered', () => {
      mockUseMembership.mockReturnValue({
        membershipStatus: 'Registered',
        isActiveMember: false,
        isRegistered: true,
        isLoading: false,
        icPrincipal: null,
      });

      renderDashboard();

      expect(screen.getByText('Upgrade to Full Membership')).toBeInTheDocument();
      expect(
        screen.getByText(/Upgrade to full membership to vote on proposals/)
      ).toBeInTheDocument();
      expect(screen.getByText('Upgrade Membership')).toBeInTheDocument();
    });

    it('should NOT show upgrade prompt when user is Active', () => {
      mockUseMembership.mockReturnValue({
        membershipStatus: 'Active',
        isActiveMember: true,
        isRegistered: false,
        isLoading: false,
        icPrincipal: 'gbzb4-test-principal',
      });

      renderDashboard();

      expect(screen.queryByText('Upgrade to Full Membership')).not.toBeInTheDocument();
    });

    it('should NOT show upgrade prompt when membership status is null', () => {
      mockUseMembership.mockReturnValue({
        membershipStatus: null,
        isActiveMember: false,
        isRegistered: false,
        isLoading: false,
        icPrincipal: null,
      });

      renderDashboard();

      expect(screen.queryByText('Upgrade to Full Membership')).not.toBeInTheDocument();
    });
  });

  describe('BL-027.3 AC1: Dashboard passes icPrincipal to TokenBalance', () => {
    it('should pass icPrincipal from useMembership to TokenBalance', () => {
      mockUseMembership.mockReturnValue({
        membershipStatus: 'Active',
        isActiveMember: true,
        isRegistered: false,
        isLoading: false,
        icPrincipal: 'gbzb4-test-principal',
      });

      renderDashboard();

      expect(mockTokenBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          principal: 'gbzb4-test-principal',
        })
      );
    });

    it('should pass null principal to TokenBalance when user has no IC principal', () => {
      mockUseMembership.mockReturnValue({
        membershipStatus: 'Active',
        isActiveMember: true,
        isRegistered: false,
        isLoading: false,
        icPrincipal: null,
      });

      renderDashboard();

      expect(mockTokenBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          principal: null,
        })
      );
    });
  });

  describe('Loading state', () => {
    it('should show loading spinner when auth is loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        displayName: null,
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
      mockUseMembership.mockReturnValue({
        membershipStatus: null,
        isActiveMember: false,
        isRegistered: false,
        isLoading: true,
        icPrincipal: null,
      });

      renderDashboard();

      expect(screen.getByText('Loading your dashboard...')).toBeInTheDocument();
    });
  });
});
