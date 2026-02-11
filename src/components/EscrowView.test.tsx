/**
 * EscrowView Component Tests
 *
 * Story: 9-2-4-escrow-view
 * ACs: 1, 2, 3, 4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EscrowView } from '@/components/EscrowView';
import {
  $escrow,
  clearEscrow,
  setUserEscrows,
  type Escrow,
  type EscrowStatusFilter,
} from '@/stores';

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

// Mock escrowService
vi.mock('@/services/escrowService', () => ({
  useEscrowView: vi.fn(() => ({
    escrowState: $escrow.get(),
    filteredEscrows: $escrow.get().escrows,
    statusCounts: { All: 0, Active: 0, Released: 0, Cancelled: 0, Expired: 0 },
    statusFilter: 'All' as EscrowStatusFilter,
    selectedEscrow: null,
    isLoading: false,
    isRefreshing: false,
    refresh: vi.fn(),
    selectEscrow: vi.fn(),
    setFilter: vi.fn(),
    clear: vi.fn(),
  })),
}));

import { useEscrowView } from '@/services/escrowService';
import { trackEvent } from '@/utils/analytics';

// Helper to create a mock escrow
function createMockEscrow(overrides: Partial<Escrow> = {}): Escrow {
  return {
    id: BigInt(1),
    recipient: 'test-principal',
    amount: BigInt(100000000000), // 1,000 DOM
    released_amount: BigInt(0),
    token_type: 'DOM',
    conditions: 'Test escrow conditions',
    release_authority: { Controller: null },
    status: 'Active',
    created_at: BigInt(Date.now() * 1_000_000),
    expiry: BigInt((Date.now() + 30 * 24 * 60 * 60 * 1000) * 1_000_000), // 30 days from now
    milestones: [],
    ...overrides,
  };
}

// Helper to create mock escrows with various statuses
function createMockEscrows(): Escrow[] {
  return [
    createMockEscrow({
      id: BigInt(1),
      conditions: 'Active project escrow',
      status: 'Active',
      amount: BigInt(100000000000), // 1,000 DOM
      released_amount: BigInt(25000000000), // 250 DOM
    }),
    createMockEscrow({
      id: BigInt(2),
      conditions: 'Released bounty escrow',
      status: 'Released',
      amount: BigInt(50000000000), // 500 DOM
      released_amount: BigInt(50000000000), // 500 DOM
    }),
    createMockEscrow({
      id: BigInt(3),
      conditions: 'Cancelled grant escrow',
      status: 'Cancelled',
    }),
    createMockEscrow({
      id: BigInt(4),
      conditions: 'Expired escrow',
      status: 'Expired',
    }),
  ];
}

// Calculate status counts from escrows
function calculateStatusCounts(escrows: Escrow[]): Record<EscrowStatusFilter, number> {
  return {
    All: escrows.length,
    Active: escrows.filter((e) => e.status === 'Active').length,
    Released: escrows.filter((e) => e.status === 'Released').length,
    Cancelled: escrows.filter((e) => e.status === 'Cancelled').length,
    Expired: escrows.filter((e) => e.status === 'Expired').length,
  };
}

describe('EscrowView', () => {
  beforeEach(() => {
    clearEscrow();
    vi.clearAllMocks();

    // Reset mock to default implementation
    vi.mocked(useEscrowView).mockImplementation(() => ({
      escrowState: $escrow.get(),
      filteredEscrows: $escrow.get().escrows,
      statusCounts: calculateStatusCounts($escrow.get().escrows),
      statusFilter: 'All' as EscrowStatusFilter,
      selectedEscrow: null,
      isLoading: false,
      isRefreshing: false,
      refresh: vi.fn(),
      selectEscrow: vi.fn(),
      setFilter: vi.fn(),
      clear: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render escrow view header', () => {
      setUserEscrows(createMockEscrows());
      const escrows = createMockEscrows();

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      expect(screen.getByText('Escrow View')).toBeInTheDocument();
    });

    it('should display list of escrows (AC-1)', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      expect(screen.getByText('Active project escrow')).toBeInTheDocument();
      expect(screen.getByText('Released bounty escrow')).toBeInTheDocument();
      expect(screen.getByText('Cancelled grant escrow')).toBeInTheDocument();
      expect(screen.getByText('Expired escrow')).toBeInTheDocument();
    });

    it('should display escrow status badges (AC-2)', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      // Should have status badges for each escrow
      const activeBadges = screen.getAllByText('Active');
      const releasedBadges = screen.getAllByText('Released');
      const cancelledBadges = screen.getAllByText('Cancelled');
      const expiredBadges = screen.getAllByText('Expired');

      // At least one of each status should exist (card + filter)
      expect(activeBadges.length).toBeGreaterThanOrEqual(1);
      expect(releasedBadges.length).toBeGreaterThanOrEqual(1);
      expect(cancelledBadges.length).toBeGreaterThanOrEqual(1);
      expect(expiredBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('should display total and released amounts (AC-4)', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      // Each escrow card has amount display - verify at least one of each exists
      const totalAmountLabels = screen.getAllByText('Total Amount');
      const releasedLabels = screen.getAllByText('Released');
      const remainingLabels = screen.getAllByText('Remaining');

      expect(totalAmountLabels.length).toBeGreaterThanOrEqual(1);
      expect(releasedLabels.length).toBeGreaterThanOrEqual(1);
      expect(remainingLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('should be read-only with no edit controls (AC-4)', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      // Should not have edit buttons
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Release')).not.toBeInTheDocument();
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('should display token type indicator', () => {
      const escrows = [createMockEscrow({ token_type: 'DOM' })];
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      // DOM token type indicator should be visible
      const domBadges = screen.getAllByText('DOM');
      expect(domBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Status Filter (AC-2)', () => {
    it('should render status filter buttons', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      // Filter buttons
      expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
    });

    it('should call setFilter when filter is clicked', async () => {
      const mockSetFilter = vi.fn();
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: mockSetFilter,
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      // Find and click the Active filter button
      const activeButton = screen.getByRole('button', { name: /Active/i });
      await userEvent.click(activeButton);

      expect(mockSetFilter).toHaveBeenCalledWith('Active');
    });
  });

  describe('Loading state', () => {
    it('should show skeleton when loading', () => {
      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: {
          escrows: [],
          lastUpdated: null,
          isLoading: true,
          error: null,
        },
        filteredEscrows: [],
        statusCounts: { All: 0, Active: 0, Released: 0, Cancelled: 0, Expired: 0 },
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: true,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      // Skeleton should have animate-pulse class
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', () => {
      const errorState = {
        escrows: [],
        lastUpdated: null,
        isLoading: false,
        error: 'Network error',
      };

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: errorState,
        filteredEscrows: [],
        statusCounts: { All: 0, Active: 0, Released: 0, Cancelled: 0, Expired: 0 },
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      $escrow.set(errorState);

      render(<EscrowView />);

      expect(screen.getByText('Failed to load escrow data')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should call refresh when retry is clicked', async () => {
      const mockRefresh = vi.fn();
      const errorState = {
        escrows: [],
        lastUpdated: null,
        isLoading: false,
        error: 'Network error',
      };

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: errorState,
        filteredEscrows: [],
        statusCounts: { All: 0, Active: 0, Released: 0, Cancelled: 0, Expired: 0 },
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: mockRefresh,
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      $escrow.set(errorState);

      render(<EscrowView />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no escrows', () => {
      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: {
          escrows: [],
          lastUpdated: Date.now(),
          isLoading: false,
          error: null,
        },
        filteredEscrows: [],
        statusCounts: { All: 0, Active: 0, Released: 0, Cancelled: 0, Expired: 0 },
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      expect(screen.getByText('No escrows found')).toBeInTheDocument();
    });

    it('should show message when filter has no results', () => {
      const escrows = [createMockEscrow({ status: 'Active' })];
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: [], // Empty because filter doesn't match
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'Released' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      expect(screen.getByText('No escrows match the selected filter')).toBeInTheDocument();
    });
  });

  describe('Refresh button', () => {
    it('should render refresh button', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should call refresh when clicked', async () => {
      const mockRefresh = vi.fn();
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: mockRefresh,
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });

    it('should be disabled while refreshing', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: true,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      const refreshButton = screen.getByRole('button', { name: /refreshing/i });
      expect(refreshButton).toBeDisabled();
    });

    it('should show spinner while refreshing', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: true,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Milestone Progress (AC-3)', () => {
    it('should display milestone progress for escrows with milestones', () => {
      const escrowWithMilestones = createMockEscrow({
        id: BigInt(1),
        conditions: 'Multi-milestone project',
        milestones: [
          {
            name: 'Phase 1',
            description: 'Initial development',
            amount: BigInt(50000000000),
            deadline: BigInt((Date.now() + 7 * 24 * 60 * 60 * 1000) * 1_000_000),
            status: 'Released',
          },
          {
            name: 'Phase 2',
            description: 'Testing phase',
            amount: BigInt(50000000000),
            deadline: BigInt((Date.now() + 14 * 24 * 60 * 60 * 1000) * 1_000_000),
            status: 'Pending',
          },
        ],
      });

      const escrows = [escrowWithMilestones];
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      // Should show milestone progress
      expect(screen.getByText(/1 of 2 milestones/)).toBeInTheDocument();
      expect(screen.getByText('Milestones (2)')).toBeInTheDocument();
    });

    it('should show simple escrow message when no milestones', () => {
      const simpleEscrow = createMockEscrow({
        id: BigInt(1),
        conditions: 'Simple escrow',
        milestones: [],
      });

      const escrows = [simpleEscrow];
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      expect(screen.getByText(/Simple escrow \(no milestones\)/)).toBeInTheDocument();
    });
  });

  describe('FAQ Section', () => {
    it('should render FAQ section', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      expect(screen.getByText('What is escrow?')).toBeInTheDocument();
    });

    it('should expand FAQ when clicked', async () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      const faqButton = screen.getByRole('button', { name: /What is escrow/i });
      await userEvent.click(faqButton);

      // FAQ content should now be visible
      expect(screen.getByText(/is a financial arrangement/)).toBeInTheDocument();
    });

    it('should track analytics when FAQ is expanded', async () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      render(<EscrowView />);

      const faqButton = screen.getByRole('button', { name: /What is escrow/i });
      await userEvent.click(faqButton);

      expect(trackEvent).toHaveBeenCalledWith('escrow_faq_expanded', {});
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const escrows = createMockEscrows();
      setUserEscrows(escrows);

      vi.mocked(useEscrowView).mockImplementation(() => ({
        escrowState: $escrow.get(),
        filteredEscrows: escrows,
        statusCounts: calculateStatusCounts(escrows),
        statusFilter: 'All' as EscrowStatusFilter,
        selectedEscrow: null,
        isLoading: false,
        isRefreshing: false,
        refresh: vi.fn(),
        selectEscrow: vi.fn(),
        setFilter: vi.fn(),
        clear: vi.fn(),
      }));

      const { container } = render(<EscrowView className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
