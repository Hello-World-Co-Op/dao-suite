/**
 * NotificationPreferences Component Tests
 *
 * Story: BL-022.2
 * ACs: 2, 6, 7, 9, 10
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationPreferences } from '../NotificationPreferences';
import type { CanisterNotificationPreferences } from '@/services/notificationPreferencesService';

// ============================================================================
// Mocks
// ============================================================================

const mockGetPreferences = vi.fn();
const mockUpdatePreferences = vi.fn();

vi.mock('@/services/notificationPreferencesService', () => ({
  getNotificationPreferences: (...args: unknown[]) => mockGetPreferences(...args),
  updateCanisterNotificationPreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
  DEFAULT_CANISTER_PREFERENCES: {
    email_enabled: true,
    push_enabled: true,
    in_app_toasts: true,
    categories: {
      proposals: true,
      votes: true,
      mentions: true,
      system: true,
      treasury: true,
      membership: true,
    },
  },
}));

vi.mock('@/stores', () => ({
  updateNotificationPreferences: vi.fn(),
}));

const DEFAULT_PREFS: CanisterNotificationPreferences = {
  email_enabled: true,
  push_enabled: true,
  in_app_toasts: true,
  categories: {
    proposals: true,
    votes: true,
    mentions: true,
    system: true,
    treasury: true,
    membership: true,
  },
};

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetPreferences.mockResolvedValue({ ...DEFAULT_PREFS });
    mockUpdatePreferences.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render loading spinner on mount while fetch is in-flight', () => {
    // Keep the promise pending
    mockGetPreferences.mockReturnValue(new Promise(() => {}));

    render(<NotificationPreferences />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should render preferences form after loading', async () => {
    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    expect(screen.getByText('Email notifications')).toBeInTheDocument();
    expect(screen.getByText('In-app toast notifications')).toBeInTheDocument();
    expect(screen.getByText('Push notifications')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('should render all 6 category rows', async () => {
    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    expect(screen.getByText('Proposals')).toBeInTheDocument();
    expect(screen.getByText('Votes')).toBeInTheDocument();
    expect(screen.getByText('Mentions')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Treasury')).toBeInTheDocument();
    expect(screen.getByText('Membership')).toBeInTheDocument();
  });

  it('should disable all category email toggles when master email toggle is off', async () => {
    mockGetPreferences.mockResolvedValue({
      ...DEFAULT_PREFS,
      email_enabled: false,
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    // All email toggles should be disabled
    const emailToggles = [
      screen.getByTestId('email-toggle-proposals'),
      screen.getByTestId('email-toggle-votes'),
      screen.getByTestId('email-toggle-mentions'),
      screen.getByTestId('email-toggle-system'),
      screen.getByTestId('email-toggle-treasury'),
      screen.getByTestId('email-toggle-membership'),
    ];

    for (const toggle of emailToggles) {
      expect(toggle).toBeDisabled();
    }
  });

  it('should disable category email toggles after toggling master email off', async () => {
    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    // Turn off email master toggle (use the specific master toggle by id)
    const emailMasterToggle = document.getElementById('email-master-toggle')!;
    fireEvent.click(emailMasterToggle);

    // All category email toggles should be disabled
    expect(screen.getByTestId('email-toggle-proposals')).toBeDisabled();
    expect(screen.getByTestId('email-toggle-votes')).toBeDisabled();
  });

  it('should call PUT API when save button is clicked', async () => {
    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-preferences-btn');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith(DEFAULT_PREFS);
    });
  });

  it('should show success toast after successful save', async () => {
    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-preferences-btn');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('save-success')).toBeInTheDocument();
      expect(screen.getByText('Preferences saved successfully.')).toBeInTheDocument();
    });
  });

  it('should show error alert when save fails', async () => {
    mockUpdatePreferences.mockRejectedValue(new Error('Network error'));

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-preferences-btn');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('save-error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should show migration banner when localStorage has governance prefs and canister returns defaults', async () => {
    // Set localStorage governance prefs that differ from defaults
    localStorage.setItem(
      'hwdao:notification-preferences-v1',
      JSON.stringify({
        enabled: false,
        vote_result: true,
        new_proposal: false,
        voting_ending: true,
        hideProposalTitles: false,
        schemaVersion: 1,
      })
    );

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByTestId('migration-banner')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Sync your existing notification preferences to your account?')
    ).toBeInTheDocument();
  });

  it('should hide migration banner when Dismiss is clicked', async () => {
    localStorage.setItem(
      'hwdao:notification-preferences-v1',
      JSON.stringify({
        enabled: false,
        vote_result: true,
        new_proposal: false,
        voting_ending: true,
        hideProposalTitles: false,
        schemaVersion: 1,
      })
    );

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByTestId('migration-banner')).toBeInTheDocument();
    });

    const dismissButton = screen.getByTestId('migration-dismiss-btn');
    fireEvent.click(dismissButton);

    expect(screen.queryByTestId('migration-banner')).not.toBeInTheDocument();
  });

  it('should call PUT API and hide banner when Sync is clicked on migration banner', async () => {
    const localGovernancePrefs = {
      enabled: false,
      vote_result: false,
      new_proposal: true,
      voting_ending: false,
      hideProposalTitles: false,
      schemaVersion: 1,
    };
    localStorage.setItem('hwdao:notification-preferences-v1', JSON.stringify(localGovernancePrefs));

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByTestId('migration-banner')).toBeInTheDocument();
    });

    const syncButton = screen.getByTestId('migration-sync-btn');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(mockUpdatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          in_app_toasts: false,
          categories: expect.objectContaining({
            proposals: true,
            votes: false,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId('migration-banner')).not.toBeInTheDocument();
    });
  });

  it('should show push notifications toggle as disabled with Coming soon badge', async () => {
    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    const pushToggle = screen.getByTestId('push-master-toggle');
    expect(pushToggle).toBeDisabled();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('should disable save button while saving', async () => {
    // Make the update take a while
    mockUpdatePreferences.mockReturnValue(new Promise(() => {}));

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-preferences-btn');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });
});
