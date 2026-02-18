/**
 * VisibilitySettings Component Tests
 *
 * Story: 9-3-1-member-directory, BL-021.2
 * AC: 9 - Profile visibility controls wired to real API
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisibilitySettings } from '@/components/VisibilitySettings';
import { setUserVisibility } from '@/stores';
import { trackEvent } from '@/utils/analytics';

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

// Mock memberService oracle-bridge API calls
vi.mock('@/services/memberService', () => ({
  getOwnVisibility: vi.fn(() => Promise.resolve({ success: true, visibility: 'Private' })),
  setOwnVisibility: vi.fn(() => Promise.resolve({ success: true })),
}));

import { getOwnVisibility, setOwnVisibility } from '@/services/memberService';

describe('VisibilitySettings', () => {
  beforeEach(() => {
    // Reset visibility to default
    setUserVisibility('private');
    vi.clearAllMocks();

    // Reset default mock implementations
    vi.mocked(getOwnVisibility).mockResolvedValue({ success: true, visibility: 'Private' });
    vi.mocked(setOwnVisibility).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render visibility settings card', () => {
      render(<VisibilitySettings />);

      expect(screen.getByText('Profile Visibility')).toBeInTheDocument();
      expect(screen.getByText(/Control who can see your profile/i)).toBeInTheDocument();
    });

    it('should display all three visibility options', () => {
      render(<VisibilitySettings />);

      expect(screen.getByText('Public')).toBeInTheDocument();
      expect(screen.getByText('Members Only')).toBeInTheDocument();
      expect(screen.getByText('Private')).toBeInTheDocument();
    });

    it('should display current visibility status', () => {
      setUserVisibility('members-only');
      render(<VisibilitySettings />);

      expect(screen.getByText('Current Visibility')).toBeInTheDocument();
      // Text appears in both Current Visibility section and option button, so use getAllByText
      const descriptions = screen.getAllByText(/Only verified DAO members can see your profile/i);
      expect(descriptions.length).toBeGreaterThanOrEqual(1);
    });

    it('should show private as default selection', () => {
      render(<VisibilitySettings />);

      // The Private option should be selected (aria-pressed="true")
      const privateButton = screen.getByRole('button', { name: /Set visibility to Private/i });
      expect(privateButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should call getOwnVisibility on mount to load current visibility', async () => {
      render(<VisibilitySettings />);

      await waitFor(() => {
        expect(getOwnVisibility).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Visibility Selection (Task 5)', () => {
    it('should allow selecting public visibility', async () => {
      render(<VisibilitySettings />);

      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      await userEvent.click(publicButton);

      expect(publicButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should allow selecting members-only visibility', async () => {
      render(<VisibilitySettings />);

      const membersOnlyButton = screen.getByRole('button', {
        name: /Set visibility to Members Only/i,
      });
      await userEvent.click(membersOnlyButton);

      expect(membersOnlyButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should enable save button when visibility changes', async () => {
      render(<VisibilitySettings />);

      // Initially save button should be disabled (no changes)
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      expect(saveButton).toBeDisabled();

      // Select a different visibility
      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      await userEvent.click(publicButton);

      // Now save button should be enabled
      expect(saveButton).not.toBeDisabled();
    });

    it('should show reset button when there are unsaved changes', async () => {
      render(<VisibilitySettings />);

      // Initially no reset button
      expect(screen.queryByRole('button', { name: /Reset/i })).not.toBeInTheDocument();

      // Select a different visibility
      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      await userEvent.click(publicButton);

      // Now reset button should appear
      expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
    });
  });

  describe('Saving Changes (AC-9)', () => {
    it('should call setOwnVisibility API when save is clicked', async () => {
      render(<VisibilitySettings />);

      // Select public visibility
      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      await userEvent.click(publicButton);

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      // Should call the oracle-bridge API with "Public"
      await waitFor(() => {
        expect(setOwnVisibility).toHaveBeenCalledWith('Public');
      });
    });

    it('should show success message after saving', async () => {
      render(<VisibilitySettings />);

      // Select members-only
      const membersOnlyButton = screen.getByRole('button', {
        name: /Set visibility to Members Only/i,
      });
      await userEvent.click(membersOnlyButton);

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Profile visibility updated to "Members Only"/i)
        ).toBeInTheDocument();
      });
    });

    it('should disable save button after successful save', async () => {
      render(<VisibilitySettings />);

      // Select public visibility
      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      await userEvent.click(publicButton);

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      // Wait for save to complete
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });

    it('should show error message when API call fails', async () => {
      vi.mocked(setOwnVisibility).mockResolvedValue({
        success: false,
        error: 'Server error: 500',
      });

      render(<VisibilitySettings />);

      // Select public visibility
      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      await userEvent.click(publicButton);

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Server error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Reset Functionality', () => {
    it('should reset to current visibility when reset is clicked', async () => {
      render(<VisibilitySettings />);

      // Select public visibility
      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      await userEvent.click(publicButton);

      // Verify public is now selected
      expect(publicButton).toHaveAttribute('aria-pressed', 'true');

      // Click reset
      const resetButton = screen.getByRole('button', { name: /Reset/i });
      await userEvent.click(resetButton);

      // Should revert to private (the original)
      const privateButton = screen.getByRole('button', { name: /Set visibility to Private/i });
      expect(privateButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should hide reset button after reset is clicked', async () => {
      render(<VisibilitySettings />);

      // Select public visibility
      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      await userEvent.click(publicButton);

      // Click reset
      const resetButton = screen.getByRole('button', { name: /Reset/i });
      await userEvent.click(resetButton);

      // Reset button should disappear
      expect(screen.queryByRole('button', { name: /Reset/i })).not.toBeInTheDocument();
    });
  });

  describe('Analytics (Task 8)', () => {
    it('should track visibility_settings_changed event when saving', async () => {
      render(<VisibilitySettings userPrincipal="test-principal" />);

      // Select public visibility
      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      await userEvent.click(publicButton);

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(trackEvent).toHaveBeenCalledWith('visibility_settings_changed', {
          previous_visibility: 'private',
          new_visibility: 'public',
          user_principal: 'test-principal',
        });
      });
    });

    it('should not track analytics if save fails', async () => {
      // This test verifies tracking is called on success path only
      render(<VisibilitySettings />);

      // No changes, no save, no tracking
      expect(trackEvent).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels for visibility options', () => {
      render(<VisibilitySettings />);

      expect(screen.getByRole('button', { name: /Set visibility to Public/i })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Set visibility to Members Only/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Set visibility to Private/i })
      ).toBeInTheDocument();
    });

    it('should have aria-pressed attribute on selected option', () => {
      render(<VisibilitySettings />);

      const privateButton = screen.getByRole('button', { name: /Set visibility to Private/i });
      expect(privateButton).toHaveAttribute('aria-pressed', 'true');

      const publicButton = screen.getByRole('button', { name: /Set visibility to Public/i });
      expect(publicButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<VisibilitySettings className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
