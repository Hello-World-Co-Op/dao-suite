/**
 * TokenBalance Component Tests
 *
 * Story: 9-2-1-token-balance-display
 * AC: 1, 2, 3, 4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { TokenBalance } from '@/components/TokenBalance';
import {
  $tokenBalance,
  $tokenMetadata,
  clearTokenBalance,
  setTokenBalance,
  DEFAULT_TOKEN_METADATA,
} from '@/stores';

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

// Mock tokenService
vi.mock('@/services/tokenService', () => ({
  useTokenBalance: vi.fn(() => ({
    state: $tokenBalance.get(),
    isLoading: false,
    isRefreshing: false,
    refresh: vi.fn(),
    clear: vi.fn(),
  })),
}));

import { useTokenBalance } from '@/services/tokenService';
import { trackEvent } from '@/utils/analytics';

// Wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

describe('TokenBalance', () => {
  beforeEach(() => {
    clearTokenBalance();
    $tokenMetadata.set({ ...DEFAULT_TOKEN_METADATA });
    vi.clearAllMocks();

    // Reset mock to default implementation
    vi.mocked(useTokenBalance).mockImplementation(() => ({
      state: $tokenBalance.get(),
      isLoading: false,
      isRefreshing: false,
      refresh: vi.fn(),
      clear: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when principal is null', () => {
      const { container } = render(
        <TestWrapper>
          <TokenBalance principal={null} />
        </TestWrapper>
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when principal is provided', () => {
      // Set up balance first
      setTokenBalance(BigInt(100000000), 'test-principal');

      // Mock the hook to return loaded state
      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      expect(screen.getByText('Token Balance')).toBeInTheDocument();
    });

    it('should display formatted balance', () => {
      // 5,000 DOM = 500000000000 e8s
      setTokenBalance(BigInt(500000000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      expect(screen.getByText('5,000.00')).toBeInTheDocument();
      expect(screen.getByText('DOM')).toBeInTheDocument();
    });

    it('should display zero balance state', () => {
      setTokenBalance(BigInt(0), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      expect(screen.getByText('0.00')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show skeleton when loading', () => {
      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: {
          balance: BigInt(0),
          lastUpdated: null,
          isLoading: true,
          error: null,
          principal: null,
        },
        isLoading: true,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      // Skeleton should have animate-pulse class
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', () => {
      const errorState = {
        balance: BigInt(0),
        lastUpdated: null,
        isLoading: false,
        error: 'Network error',
        principal: 'test-principal',
      };

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: errorState,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      $tokenBalance.set(errorState);

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      expect(screen.getByText('Failed to load balance')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should call refresh when retry is clicked', async () => {
      const mockRefresh = vi.fn();
      const errorState = {
        balance: BigInt(0),
        lastUpdated: null,
        isLoading: false,
        error: 'Network error',
        principal: 'test-principal',
      };

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: errorState,
        isLoading: false,
        isRefreshing: false,
        refresh: mockRefresh,
        clear: vi.fn(),
      }));

      $tokenBalance.set(errorState);

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      const retryButton = screen.getByText('Retry');
      await userEvent.click(retryButton);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Refresh button', () => {
    it('should render refresh button', () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /refresh balance/i })).toBeInTheDocument();
    });

    it('should call refresh when clicked', async () => {
      const mockRefresh = vi.fn();
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: mockRefresh,
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      const refreshButton = screen.getByRole('button', { name: /refresh balance/i });
      await userEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });

    it('should be disabled while refreshing', () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: true,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      const refreshButton = screen.getByRole('button', { name: /refreshing balance/i });
      expect(refreshButton).toBeDisabled();
    });

    it('should show spinner while refreshing', () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: true,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      // The refresh icon should have animate-spin class
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Burn donation link', () => {
    it('should show burn donation link by default', () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      expect(screen.getByRole('link', { name: /burn donation/i })).toBeInTheDocument();
    });

    it('should not show burn donation link when showBurnLink is false', () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" showBurnLink={false} />
        </TestWrapper>
      );

      expect(screen.queryByRole('link', { name: /burn donation/i })).not.toBeInTheDocument();
    });

    it('should link to /burn-donation', () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      const link = screen.getByRole('link', { name: /burn donation/i });
      expect(link).toHaveAttribute('href', '/burn-donation');
    });

    it('should track analytics on click', async () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" />
        </TestWrapper>
      );

      const link = screen.getByRole('link', { name: /burn donation/i });
      await userEvent.click(link);

      expect(trackEvent).toHaveBeenCalledWith('burn_donation_link_clicked', expect.any(Object));
    });
  });

  describe('Compact mode', () => {
    it('should not show header in compact mode', () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" compact />
        </TestWrapper>
      );

      expect(screen.queryByText('Token Balance')).not.toBeInTheDocument();
    });

    it('should show burn link with sr-only label in compact mode', () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(
        <TestWrapper>
          <TokenBalance principal="test-principal" compact />
        </TestWrapper>
      );

      // In compact mode, the link has sr-only text
      const srText = screen.getByText('Burn Donation');
      expect(srText).toHaveClass('sr-only');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      setTokenBalance(BigInt(100000000), 'test-principal');

      vi.mocked(useTokenBalance).mockImplementation(() => ({
        state: $tokenBalance.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      const { container } = render(
        <TestWrapper>
          <TokenBalance principal="test-principal" className="custom-class" />
        </TestWrapper>
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
