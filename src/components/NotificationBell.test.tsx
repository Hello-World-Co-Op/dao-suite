/**
 * NotificationBell Component Tests
 *
 * Story: 9-1-7-governance-notifications
 * AC: 1, 2, 3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationBell } from '@/components/NotificationBell';
import {
  $notifications,
  $notificationPreferences,
  addNotification,
  DEFAULT_PREFERENCES,
} from '@/stores';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock governanceCanister
vi.mock('@/services/governanceCanister', () => ({
  getProposalStatus: vi.fn().mockResolvedValue({ status: 'active' }),
}));

// Wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe('NotificationBell', () => {
  beforeEach(() => {
    // Reset state
    $notifications.set([]);
    $notificationPreferences.set({ ...DEFAULT_PREFERENCES });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the bell icon', () => {
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );

    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('should not show badge when no unread notifications', () => {
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );

    // Badge text "1" should not be present
    const button = screen.getByRole('button', { name: /notifications/i });
    const spans = button.querySelectorAll('span');
    // Should only have no badge spans with numbers
    const badgeSpan = Array.from(spans).find((span) => /^\d+$/.test(span.textContent || ''));
    expect(badgeSpan).toBeUndefined();
  });

  it('should show badge with unread count', () => {
    // Add notifications first
    addNotification('vote_result', 'Test notification 1', { proposalId: 'p1' });
    addNotification('new_proposal', 'Test notification 2', { proposalId: 'p2' });

    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should show 99+ for high unread counts', () => {
    // Add many notifications by directly setting state
    const manyNotifications = Array.from({ length: 100 }, (_, i) => ({
      id: `notif-${i}`,
      type: 'new_proposal' as const,
      message: `Notification ${i}`,
      read: false,
      createdAt: Date.now(),
      metadata: {},
    }));
    $notifications.set(manyNotifications);

    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );

    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('should update aria-label with unread count', () => {
    addNotification('vote_result', 'Test notification', { proposalId: 'p1' });
    addNotification('new_proposal', 'Test notification 2', { proposalId: 'p2' });

    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );

    expect(screen.getByRole('button', { name: /notifications, 2 unread/i })).toBeInTheDocument();
  });

  it('should have aria-label without count when no notifications', () => {
    render(
      <TestWrapper>
        <NotificationBell />
      </TestWrapper>
    );

    // The aria-label should just be "Notifications" without count
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Notifications');
  });

  it('should apply custom className', () => {
    render(
      <TestWrapper>
        <NotificationBell className="custom-class" />
      </TestWrapper>
    );

    const container = screen.getByRole('button').parentElement;
    expect(container).toHaveClass('custom-class');
  });
});
