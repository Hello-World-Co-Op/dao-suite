/**
 * NotificationSettings Component Tests
 *
 * Story: 9-1-7-governance-notifications
 * AC: 4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationSettings } from '@/features/settings/components/NotificationSettings';
import {
  $notificationPreferences,
  $notificationSaveError,
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

describe('NotificationSettings', () => {
  beforeEach(() => {
    // Reset state
    $notificationPreferences.set({ ...DEFAULT_PREFERENCES });
    $notificationSaveError.set(null);
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the notification preferences card', () => {
    render(<NotificationSettings />);

    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    expect(
      screen.getByText('Configure which governance notifications you want to receive')
    ).toBeInTheDocument();
  });

  it('should display all toggle switches', () => {
    render(<NotificationSettings />);

    expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
    expect(screen.getByText('Vote Results')).toBeInTheDocument();
    expect(screen.getByText('New Proposals')).toBeInTheDocument();
    expect(screen.getByText('Voting Deadlines')).toBeInTheDocument();
    expect(screen.getByText('Hide Proposal Titles')).toBeInTheDocument();
  });

  it('should show master toggle as enabled by default', () => {
    render(<NotificationSettings />);

    const masterToggle = screen.getByRole('switch', { name: /enable notifications/i });
    expect(masterToggle).toHaveAttribute('aria-checked', 'true');
  });

  it('should toggle master switch off', () => {
    render(<NotificationSettings />);

    const masterToggle = screen.getByRole('switch', { name: /enable notifications/i });
    fireEvent.click(masterToggle);

    expect(masterToggle).toHaveAttribute('aria-checked', 'false');
    expect($notificationPreferences.get().enabled).toBe(false);
  });

  it('should disable individual toggles when master is off', () => {
    // Disable master toggle first
    $notificationPreferences.set({ ...DEFAULT_PREFERENCES, enabled: false });

    render(<NotificationSettings />);

    const voteResultsToggle = screen.getByRole('switch', { name: /vote results/i });
    const newProposalsToggle = screen.getByRole('switch', { name: /new proposals/i });
    const deadlinesToggle = screen.getByRole('switch', { name: /voting deadlines/i });
    const privacyToggle = screen.getByRole('switch', { name: /hide proposal titles/i });

    expect(voteResultsToggle).toBeDisabled();
    expect(newProposalsToggle).toBeDisabled();
    expect(deadlinesToggle).toBeDisabled();
    expect(privacyToggle).toBeDisabled();
  });

  it('should toggle vote results preference', () => {
    render(<NotificationSettings />);

    const toggle = screen.getByRole('switch', { name: /vote results/i });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect($notificationPreferences.get().vote_result).toBe(false);
  });

  it('should toggle new proposals preference', () => {
    render(<NotificationSettings />);

    const toggle = screen.getByRole('switch', { name: /new proposals/i });
    fireEvent.click(toggle);

    expect($notificationPreferences.get().new_proposal).toBe(false);
  });

  it('should toggle voting deadlines preference', () => {
    render(<NotificationSettings />);

    const toggle = screen.getByRole('switch', { name: /voting deadlines/i });
    fireEvent.click(toggle);

    expect($notificationPreferences.get().voting_ending).toBe(false);
  });

  it('should toggle hide proposal titles preference', () => {
    render(<NotificationSettings />);

    const toggle = screen.getByRole('switch', { name: /hide proposal titles/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect($notificationPreferences.get().hideProposalTitles).toBe(true);
  });

  it('should reset preferences to defaults', () => {
    // Modify preferences
    $notificationPreferences.set({
      ...DEFAULT_PREFERENCES,
      vote_result: false,
      new_proposal: false,
      hideProposalTitles: true,
    });

    render(<NotificationSettings />);

    const resetButton = screen.getByText('Reset to defaults');
    fireEvent.click(resetButton);

    const prefs = $notificationPreferences.get();
    expect(prefs.vote_result).toBe(true);
    expect(prefs.new_proposal).toBe(true);
    expect(prefs.hideProposalTitles).toBe(false);
  });

  it('should display error alert when save error exists', () => {
    $notificationSaveError.set('Failed to save preferences');

    render(<NotificationSettings />);

    expect(screen.getByText('Failed to save preferences')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('should dismiss error alert when clicked', () => {
    $notificationSaveError.set('Failed to save preferences');

    render(<NotificationSettings />);

    const dismissButton = screen.getByText('Dismiss');
    fireEvent.click(dismissButton);

    expect($notificationSaveError.get()).toBeNull();
  });

  it('should persist preferences to localStorage', () => {
    render(<NotificationSettings />);

    const toggle = screen.getByRole('switch', { name: /vote results/i });
    fireEvent.click(toggle);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'hwdao:notification-preferences-v1',
      expect.any(String)
    );
  });

  it('should apply custom className', () => {
    const { container } = render(<NotificationSettings className="custom-class" />);

    const card = container.querySelector('.custom-class');
    expect(card).toBeInTheDocument();
  });
});
