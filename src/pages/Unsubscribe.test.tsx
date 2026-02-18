/**
 * Unsubscribe Page Tests
 *
 * Tests for the public unsubscribe landing page component.
 * Covers loading state, success state, error state, and "Manage preferences" link.
 *
 * Story: BL-022.3 — Unsubscribe Landing Page
 * AC: 1, 2, 3, 4, 5, 6, 7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'react-router-dom';

// Mock react-router-dom, preserving MemoryRouter for rendering
vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...mod,
    useSearchParams: vi.fn(),
  };
});

const mockUseSearchParams = vi.mocked(useSearchParams);

import Unsubscribe from './Unsubscribe';

describe('Unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('VITE_ORACLE_BRIDGE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows loading state on initial mount', () => {
    // fetch that never resolves to keep loading state visible
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('token=test-token&category=treasury'),
      vi.fn(),
    ]);

    render(<Unsubscribe />);

    expect(screen.getByTestId('unsubscribe-loading')).toBeInTheDocument();
    expect(
      screen.getByText('Processing your unsubscribe request...')
    ).toBeInTheDocument();
  });

  it('shows success state after successful unsubscribe', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, category: 'treasury' }),
    } as Response);
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('token=valid-token&category=treasury'),
      vi.fn(),
    ]);

    render(<Unsubscribe />);

    await waitFor(() =>
      expect(
        screen.getByTestId('unsubscribe-success-heading')
      ).toBeInTheDocument()
    );
    expect(
      screen.getByTestId('unsubscribe-success-message')
    ).toHaveTextContent('You have been unsubscribed from treasury emails.');
    expect(screen.getByTestId('manage-preferences-link')).toBeInTheDocument();
  });

  it('shows error state when oracle-bridge returns 400', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({ error: 'Invalid or expired unsubscribe token' }),
    } as Response);
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('token=expired-token&category=treasury'),
      vi.fn(),
    ]);

    render(<Unsubscribe />);

    await waitFor(() =>
      expect(
        screen.getByTestId('unsubscribe-error-heading')
      ).toBeInTheDocument()
    );
    expect(screen.getByTestId('unsubscribe-error-message')).toHaveTextContent(
      'This unsubscribe link has expired or is invalid.'
    );
    expect(screen.getByTestId('manage-preferences-link')).toBeInTheDocument();
  });

  it('"Manage preferences" link on success has correct href', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, category: 'treasury' }),
    } as Response);
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('token=valid-token&category=treasury'),
      vi.fn(),
    ]);

    render(<Unsubscribe />);

    await waitFor(() =>
      expect(
        screen.getByTestId('unsubscribe-success-heading')
      ).toBeInTheDocument()
    );

    const link = screen.getByTestId('manage-preferences-link');
    expect(link).toHaveAttribute('href', '/settings?tab=notifications');
    expect(link).toHaveTextContent('Manage all notification preferences');
  });

  it('shows error state when no token in query params', async () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams(''),
      vi.fn(),
    ]);

    render(<Unsubscribe />);

    await waitFor(() =>
      expect(
        screen.getByTestId('unsubscribe-error-heading')
      ).toBeInTheDocument()
    );
    expect(screen.getByTestId('unsubscribe-error-message')).toHaveTextContent(
      'This unsubscribe link is missing a token.'
    );
    // No fetch call should be made when token is missing
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows error state when fetch throws a network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('token=some-token&category=membership'),
      vi.fn(),
    ]);

    render(<Unsubscribe />);

    await waitFor(() =>
      expect(
        screen.getByTestId('unsubscribe-error-heading')
      ).toBeInTheDocument()
    );
    expect(screen.getByTestId('unsubscribe-error-message')).toHaveTextContent(
      'Something went wrong. Please try again or log in to manage your notification preferences.'
    );
  });

  it('shows error state when oracle-bridge returns 500', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    } as Response);
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('token=some-token&category=treasury'),
      vi.fn(),
    ]);

    render(<Unsubscribe />);

    await waitFor(() =>
      expect(
        screen.getByTestId('unsubscribe-error-heading')
      ).toBeInTheDocument()
    );
    expect(screen.getByTestId('unsubscribe-error-message')).toHaveTextContent(
      'Something went wrong.'
    );
  });

  it('defaults category to "notifications" when no category query param', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('token=valid-token'),
      vi.fn(),
    ]);

    render(<Unsubscribe />);

    await waitFor(() =>
      expect(
        screen.getByTestId('unsubscribe-success-heading')
      ).toBeInTheDocument()
    );
    expect(
      screen.getByTestId('unsubscribe-success-message')
    ).toHaveTextContent(
      'You have been unsubscribed from notifications emails.'
    );
  });
});
