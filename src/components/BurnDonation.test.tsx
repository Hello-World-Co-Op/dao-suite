/**
 * BurnDonation Component Tests
 *
 * Story: 9-2-3-burn-donation
 * AC: 1, 2, 3, 4, 5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { BurnDonation } from '@/components/BurnDonation';
import {
  $burnPool,
  $burnExecution,
  clearBurnPool,
  resetBurnExecution,
  clearBurnHistory,
  setBurnPoolData,
  setTokenBalance,
  addBurnRecord,
} from '@/stores';

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

// Mock burnService
const mockExecuteBurn = vi.fn();
const mockRefresh = vi.fn();

vi.mock('@/services/burnService', () => ({
  useBurnDonation: vi.fn(() => ({
    poolState: $burnPool.get(),
    executionState: $burnExecution.get(),
    burnHistory: [],
    isLoading: false,
    isRefreshing: false,
    executeBurn: mockExecuteBurn,
    refresh: mockRefresh,
    resetExecution: vi.fn(),
    clear: vi.fn(),
  })),
}));

import { useBurnDonation } from '@/services/burnService';

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('BurnDonation', () => {
  beforeEach(() => {
    clearBurnPool();
    resetBurnExecution();
    clearBurnHistory();
    vi.clearAllMocks();

    // Set up token balance for validation
    setTokenBalance(BigInt(1_000_000_000), 'test-principal'); // 10 DOM

    // Set up burn pool data
    setBurnPoolData(BigInt(250_000_000_000_000)); // 2,500,000 DOM

    // Reset mock to default implementation
    vi.mocked(useBurnDonation).mockImplementation(() => ({
      poolState: $burnPool.get(),
      executionState: $burnExecution.get(),
      burnHistory: [],
      isLoading: false,
      isRefreshing: false,
      executeBurn: mockExecuteBurn,
      refresh: mockRefresh,
      resetExecution: vi.fn(),
      clear: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render burn donation header', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('Burn Donation')).toBeInTheDocument();
    });

    it('should display total burned (AC-2)', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('Total Tokens Burned')).toBeInTheDocument();
      expect(screen.getByText('2,500,000.00')).toBeInTheDocument();
    });

    it('should display permanent warning banner', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByText(/Burns are permanent and cannot be undone/)).toBeInTheDocument();
    });

    it('should display input field for amount (AC-1)', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByLabelText('Amount to Burn')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('0.00')).toBeInTheDocument();
    });

    it('should display user balance (AC-1)', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByText(/Your balance:/)).toBeInTheDocument();
      // With fee = 0, balance and max are both 10.00 DOM, so use getAllByText
      expect(screen.getAllByText(/10.00/)).toHaveLength(2); // Balance + Max
    });

    it('should display MAX button', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('MAX')).toBeInTheDocument();
    });

    it('should display info about standard burns (AC-3)', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('About Standard Burns')).toBeInTheDocument();
      expect(screen.getByText(/Standard burns destroy tokens 1:1/)).toBeInTheDocument();
    });

    it('should display Why Burn section', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('Why Burn Tokens?')).toBeInTheDocument();
      expect(screen.getByText(/Deflationary pressure/)).toBeInTheDocument();
    });

    it('should display FAQ section', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('What is token burning?')).toBeInTheDocument();
    });

    it('should display empty burn history message (AC-5)', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('No burns yet - be the first!')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show skeleton when loading', () => {
      vi.mocked(useBurnDonation).mockImplementation(() => ({
        poolState: {
          pool: null,
          lastUpdated: null,
          isLoading: true,
          error: null,
        },
        executionState: $burnExecution.get(),
        burnHistory: [],
        isLoading: true,
        isRefreshing: false,
        executeBurn: mockExecuteBurn,
        refresh: mockRefresh,
        resetExecution: vi.fn(),
        clear: vi.fn(),
      }));

      renderWithRouter(<BurnDonation />);

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', () => {
      vi.mocked(useBurnDonation).mockImplementation(() => ({
        poolState: {
          pool: null,
          lastUpdated: null,
          isLoading: false,
          error: 'Network error',
        },
        executionState: $burnExecution.get(),
        burnHistory: [],
        isLoading: false,
        isRefreshing: false,
        executeBurn: mockExecuteBurn,
        refresh: mockRefresh,
        resetExecution: vi.fn(),
        clear: vi.fn(),
      }));

      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('Failed to load burn data')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should show Get Help link on error', () => {
      vi.mocked(useBurnDonation).mockImplementation(() => ({
        poolState: {
          pool: null,
          lastUpdated: null,
          isLoading: false,
          error: 'Error',
        },
        executionState: $burnExecution.get(),
        burnHistory: [],
        isLoading: false,
        isRefreshing: false,
        executeBurn: mockExecuteBurn,
        refresh: mockRefresh,
        resetExecution: vi.fn(),
        clear: vi.fn(),
      }));

      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('Get Help')).toBeInTheDocument();
    });
  });

  describe('Input validation (AC-1)', () => {
    it('should disable submit when input is empty', () => {
      renderWithRouter(<BurnDonation />);

      const submitButton = screen.getByRole('button', { name: /burn tokens/i });
      expect(submitButton).toBeDisabled();
    });

    it('should show error for amount exceeding balance', async () => {
      renderWithRouter(<BurnDonation />);

      const input = screen.getByPlaceholderText('0.00');
      await userEvent.type(input, '100'); // More than 10 DOM balance

      await waitFor(() => {
        expect(screen.getByText(/Maximum burn is/)).toBeInTheDocument();
      });
    });

    it('should show error for amount below minimum', async () => {
      renderWithRouter(<BurnDonation />);

      const input = screen.getByPlaceholderText('0.00');
      await userEvent.type(input, '0.5'); // Less than 1 DOM minimum

      await waitFor(() => {
        expect(screen.getByText(/Minimum burn is/)).toBeInTheDocument();
      });
    });
  });

  describe('MAX button', () => {
    it('should fill max burnable amount when clicked', async () => {
      renderWithRouter(<BurnDonation />);

      const maxButton = screen.getByText('MAX');
      await userEvent.click(maxButton);

      const input = screen.getByPlaceholderText('0.00') as HTMLInputElement;
      // Max = 10 DOM - 0.0001 DOM fee = 9.9999
      expect(input.value).toBeTruthy();
    });
  });

  describe('Refresh button', () => {
    it('should render refresh button', () => {
      renderWithRouter(<BurnDonation />);

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should call refresh when clicked', async () => {
      renderWithRouter(<BurnDonation />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('FAQ expansion', () => {
    it('should have FAQ section with toggle button', () => {
      renderWithRouter(<BurnDonation />);

      const faqButton = screen.getByText('What is token burning?');
      expect(faqButton).toBeInTheDocument();
    });
  });

  describe('Burn History display (AC-5)', () => {
    it('should display burn history section when records are added to atom', () => {
      // The component uses useStore($burnHistory) directly, so we need to add to the atom
      addBurnRecord({
        id: 'burn-1',
        amount: BigInt(100_000_000),
        timestamp: Date.now(),
        status: 'confirmed' as const,
        txIndex: '1001',
      });

      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('Your Burn History')).toBeInTheDocument();
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
      expect(screen.getByText(/History stored locally/)).toBeInTheDocument();
    });
  });

  describe('User total burns display', () => {
    it('should display user total when burns exist', () => {
      const mockRecord = {
        id: 'burn-1',
        amount: BigInt(500_000_000), // 5 DOM
        timestamp: Date.now(),
        status: 'confirmed' as const,
      };

      vi.mocked(useBurnDonation).mockImplementation(() => ({
        poolState: $burnPool.get(),
        executionState: $burnExecution.get(),
        burnHistory: [mockRecord],
        isLoading: false,
        isRefreshing: false,
        executeBurn: mockExecuteBurn,
        refresh: mockRefresh,
        resetExecution: vi.fn(),
        clear: vi.fn(),
      }));

      // Set $burnCount > 0 through adding record
      addBurnRecord(mockRecord);

      renderWithRouter(<BurnDonation />);

      expect(screen.getByText('Your Total Burns')).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = renderWithRouter(<BurnDonation className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
