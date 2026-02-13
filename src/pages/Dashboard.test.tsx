/**
 * Dashboard Tests
 *
 * Tests for membership upgrade prompt display.
 *
 * Story: BL-011.5 — Frontend Membership Gating
 * AC: 2, 3, 8
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

// Mock TokenBalance and TreasuryView to avoid canister calls
vi.mock('@/components/TokenBalance', () => ({
  TokenBalance: () => <div data-testid="token-balance">TokenBalance</div>,
}));

vi.mock('@/components/TreasuryView', () => ({
  TreasuryView: () => <div data-testid="treasury-view">TreasuryView</div>,
}));

import Dashboard from './Dashboard';

function renderDashboard() {
  // Set up user data in localStorage so Dashboard doesn't redirect
  localStorage.setItem(
    'user_data',
    JSON.stringify({
      userId: 'test-user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    })
  );

  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('AC3: Upgrade prompt for Registered users', () => {
    it('should show upgrade prompt when user is Registered', () => {
      mockUseMembership.mockReturnValue({
        membershipStatus: 'Registered',
        isActiveMember: false,
        isRegistered: true,
        isLoading: false,
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
      });

      renderDashboard();

      expect(screen.queryByText('Upgrade to Full Membership')).not.toBeInTheDocument();
    });
  });
});
