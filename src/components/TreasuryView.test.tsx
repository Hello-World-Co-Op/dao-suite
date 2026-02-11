/**
 * TreasuryView Component Tests
 *
 * Story: 9-2-2-treasury-view
 * AC: 1, 2, 3, 4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreasuryView } from '@/components/TreasuryView';
import {
  $treasury,
  clearTreasury,
  setTreasuryData,
  type TreasuryBalance,
  type Transaction,
} from '@/stores';

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

// Mock treasuryService
vi.mock('@/services/treasuryService', () => ({
  useTreasuryBalance: vi.fn(() => ({
    state: $treasury.get(),
    isLoading: false,
    isRefreshing: false,
    refresh: vi.fn(),
    clear: vi.fn(),
  })),
}));

import { useTreasuryBalance } from '@/services/treasuryService';

// Helper to create a mock balance
function createMockBalance(overrides: Partial<TreasuryBalance> = {}): TreasuryBalance {
  return {
    icpBalance: BigInt(50000000000), // 500 ICP
    domBalance: BigInt(123456789000000), // 1,234,567.89 DOM
    pendingPayoutsIcp: BigInt(10000000000), // 100 ICP
    pendingPayoutsDom: BigInt(50000000000000), // 500,000 DOM
    activeEscrowsIcp: BigInt(5000000000), // 50 ICP
    activeEscrowsDom: BigInt(25000000000000), // 250,000 DOM
    ...overrides,
  };
}

// Helper to create mock transactions
function createMockTransactions(): Transaction[] {
  const now = BigInt(Date.now() * 1_000_000);
  return [
    {
      id: 'tx-001',
      type: 'deposit',
      amount: BigInt(10000000000000), // 100,000 DOM
      timestamp: now - BigInt(3600 * 1_000_000_000), // 1 hour ago
      description: 'Membership dues deposit',
      tokenType: 'DOM',
    },
    {
      id: 'tx-002',
      type: 'payout',
      amount: BigInt(5000000000000), // 50,000 DOM
      timestamp: now - BigInt(5 * 3600 * 1_000_000_000), // 5 hours ago
      description: 'Community grant payout',
      tokenType: 'DOM',
    },
  ];
}

describe('TreasuryView', () => {
  beforeEach(() => {
    clearTreasury();
    vi.clearAllMocks();

    // Reset mock to default implementation
    vi.mocked(useTreasuryBalance).mockImplementation(() => ({
      state: $treasury.get(),
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
    it('should render treasury header', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      expect(screen.getByText('DAO Treasury')).toBeInTheDocument();
    });

    it('should display DOM balance (AC-1)', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      expect(screen.getByText('DOM Balance')).toBeInTheDocument();
      // Total DOM = 1,234,567.89 + 500,000 + 250,000 = 1,984,567.89
      expect(screen.getByText('1,984,567.89')).toBeInTheDocument();
    });

    it('should display ICP balance (AC-1)', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      expect(screen.getByText('ICP Balance')).toBeInTheDocument();
      // Total ICP = 500 + 100 + 50 = 650
      expect(screen.getByText('650.00')).toBeInTheDocument();
    });

    it('should display DOM allocation breakdown (AC-2)', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      expect(screen.getByText('DOM Allocation')).toBeInTheDocument();
      // Should have allocation categories - use getAllBy since they appear in both DOM and ICP sections
      const operationalTexts = screen.getAllByText(/Operational/);
      const pendingTexts = screen.getAllByText(/Pending Payouts/);
      const escrowTexts = screen.getAllByText(/Escrow/);
      expect(operationalTexts.length).toBeGreaterThanOrEqual(1);
      expect(pendingTexts.length).toBeGreaterThanOrEqual(1);
      expect(escrowTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('should display ICP allocation breakdown (AC-2)', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      expect(screen.getByText('ICP Allocation')).toBeInTheDocument();
    });

    it('should display recent transactions (AC-3)', () => {
      setTreasuryData(createMockBalance(), createMockTransactions());

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
      expect(screen.getByText('Deposit')).toBeInTheDocument();
      expect(screen.getByText('Payout')).toBeInTheDocument();
      expect(screen.getByText('Membership dues deposit')).toBeInTheDocument();
    });

    it('should be read-only with no edit controls (AC-4)', () => {
      setTreasuryData(createMockBalance(), createMockTransactions());

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      // Should not have edit buttons
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Transfer')).not.toBeInTheDocument();
      expect(screen.queryByText('Withdraw')).not.toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show skeleton when loading', () => {
      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: {
          balance: null,
          transactions: [],
          lastUpdated: null,
          isLoading: true,
          error: null,
        },
        isLoading: true,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      // Skeleton should have animate-pulse class
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', () => {
      const errorState = {
        balance: null,
        transactions: [],
        lastUpdated: null,
        isLoading: false,
        error: 'Network error',
      };

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: errorState,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      $treasury.set(errorState);

      render(<TreasuryView />);

      expect(screen.getByText('Failed to load treasury data')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should call refresh when retry is clicked', async () => {
      const mockRefresh = vi.fn();
      const errorState = {
        balance: null,
        transactions: [],
        lastUpdated: null,
        isLoading: false,
        error: 'Network error',
      };

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: errorState,
        isLoading: false,
        isRefreshing: false,
        refresh: mockRefresh,
        clear: vi.fn(),
      }));

      $treasury.set(errorState);

      render(<TreasuryView />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Refresh button', () => {
    it('should render refresh button', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      expect(screen.getByRole('button', { name: /refresh treasury/i })).toBeInTheDocument();
    });

    it('should call refresh when clicked', async () => {
      const mockRefresh = vi.fn();
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: mockRefresh,
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      const refreshButton = screen.getByRole('button', { name: /refresh treasury/i });
      await userEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });

    it('should be disabled while refreshing', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: true,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      const refreshButton = screen.getByRole('button', { name: /refreshing treasury/i });
      expect(refreshButton).toBeDisabled();
    });

    it('should show spinner while refreshing', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: true,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Empty transactions', () => {
    it('should show empty state when no transactions', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView />);

      expect(screen.getByText('No recent transactions')).toBeInTheDocument();
    });
  });

  describe('Conditional display', () => {
    it('should hide DOM breakdown when showDomBreakdown is false', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView showDomBreakdown={false} />);

      expect(screen.queryByText('DOM Allocation')).not.toBeInTheDocument();
    });

    it('should hide ICP breakdown when showIcpBreakdown is false', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView showIcpBreakdown={false} />);

      expect(screen.queryByText('ICP Allocation')).not.toBeInTheDocument();
    });

    it('should hide transactions when showTransactions is false', () => {
      setTreasuryData(createMockBalance(), createMockTransactions());

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView showTransactions={false} />);

      expect(screen.queryByText('Recent Transactions')).not.toBeInTheDocument();
    });
  });

  describe('Compact mode', () => {
    it('should not show header in compact mode', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<TreasuryView compact />);

      expect(screen.queryByText('DAO Treasury')).not.toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      setTreasuryData(createMockBalance(), []);

      vi.mocked(useTreasuryBalance).mockImplementation(() => ({
        state: $treasury.get(),
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      const { container } = render(<TreasuryView className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
