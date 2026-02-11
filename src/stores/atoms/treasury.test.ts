/**
 * Treasury State Tests
 *
 * Story: 9-2-2-treasury-view
 * AC: 1, 2, 3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  $treasury,
  $treasuryLoading,
  $treasuryError,
  $hasTreasuryData,
  $treasuryBalance,
  $treasuryTransactions,
  $totalDomBalance,
  $totalIcpBalance,
  $formattedDomBalance,
  $formattedIcpBalance,
  $domFundAllocations,
  $icpFundAllocations,
  formatTimestamp,
  getTransactionTypeLabel,
  getTransactionTypeColor,
  setTreasuryLoading,
  setTreasuryData,
  setTreasuryError,
  clearTreasury,
  isTreasuryStale,
  getTreasuryBalance,
  TREASURY_STALE_THRESHOLD_MS,
  type TreasuryBalance,
  type Transaction,
} from '@/stores';

// Helper to create a mock balance
function createMockBalance(overrides: Partial<TreasuryBalance> = {}): TreasuryBalance {
  return {
    icpBalance: BigInt(0),
    domBalance: BigInt(0),
    pendingPayoutsIcp: BigInt(0),
    pendingPayoutsDom: BigInt(0),
    activeEscrowsIcp: BigInt(0),
    activeEscrowsDom: BigInt(0),
    ...overrides,
  };
}

// Helper to create a mock transaction
function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-001',
    type: 'deposit',
    amount: BigInt(100000000),
    timestamp: BigInt(Date.now() * 1_000_000),
    tokenType: 'DOM',
    ...overrides,
  };
}

describe('Treasury State', () => {
  beforeEach(() => {
    clearTreasury();
    vi.clearAllMocks();
  });

  describe('Configuration constants', () => {
    it('should have correct stale threshold', () => {
      expect(TREASURY_STALE_THRESHOLD_MS).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('Initial state', () => {
    it('should have null balance initially', () => {
      expect($treasury.get().balance).toBeNull();
    });

    it('should not be loading initially', () => {
      expect($treasuryLoading.get()).toBe(false);
    });

    it('should have no error initially', () => {
      expect($treasuryError.get()).toBeNull();
    });

    it('should not have treasury data initially', () => {
      expect($hasTreasuryData.get()).toBe(false);
    });

    it('should have empty transactions initially', () => {
      expect($treasuryTransactions.get()).toEqual([]);
    });
  });

  describe('setTreasuryLoading', () => {
    it('should set loading to true', () => {
      setTreasuryLoading(true);
      expect($treasuryLoading.get()).toBe(true);
    });

    it('should set loading to false', () => {
      setTreasuryLoading(true);
      setTreasuryLoading(false);
      expect($treasuryLoading.get()).toBe(false);
    });

    it('should clear error when starting new fetch', () => {
      setTreasuryError('Previous error');
      setTreasuryLoading(true);
      expect($treasuryError.get()).toBeNull();
    });
  });

  describe('setTreasuryData', () => {
    it('should set balance and transactions', () => {
      const balance = createMockBalance({
        domBalance: BigInt(100000000000), // 1,000 DOM
        icpBalance: BigInt(50000000000), // 500 ICP
      });
      const transactions = [createMockTransaction()];

      setTreasuryData(balance, transactions);

      const state = $treasury.get();
      expect(state.balance).toEqual(balance);
      expect(state.transactions).toEqual(transactions);
    });

    it('should set lastUpdated timestamp', () => {
      const before = Date.now();
      setTreasuryData(createMockBalance(), []);
      const after = Date.now();

      const state = $treasury.get();
      expect(state.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(state.lastUpdated).toBeLessThanOrEqual(after);
    });

    it('should clear loading and error', () => {
      setTreasuryLoading(true);
      setTreasuryError('Some error');

      setTreasuryData(createMockBalance(), []);

      expect($treasuryLoading.get()).toBe(false);
      expect($treasuryError.get()).toBeNull();
    });

    it('should mark hasTreasuryData as true', () => {
      expect($hasTreasuryData.get()).toBe(false);
      setTreasuryData(createMockBalance(), []);
      expect($hasTreasuryData.get()).toBe(true);
    });
  });

  describe('setTreasuryError', () => {
    it('should set error message', () => {
      setTreasuryError('Failed to fetch');
      expect($treasuryError.get()).toBe('Failed to fetch');
    });

    it('should set loading to false', () => {
      setTreasuryLoading(true);
      setTreasuryError('Error');
      expect($treasuryLoading.get()).toBe(false);
    });

    it('should preserve existing balance', () => {
      const balance = createMockBalance({ domBalance: BigInt(100) });
      setTreasuryData(balance, []);
      setTreasuryError('Network error');

      const state = $treasury.get();
      expect(state.balance).toEqual(balance);
      expect(state.error).toBe('Network error');
    });
  });

  describe('clearTreasury', () => {
    it('should reset all state to initial values', () => {
      setTreasuryData(createMockBalance({ domBalance: BigInt(12345) }), [createMockTransaction()]);
      setTreasuryError('Some error');

      clearTreasury();

      const state = $treasury.get();
      expect(state.balance).toBeNull();
      expect(state.transactions).toEqual([]);
      expect(state.lastUpdated).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('getTreasuryBalance', () => {
    it('should return null when not fetched', () => {
      expect(getTreasuryBalance()).toBeNull();
    });

    it('should return current balance', () => {
      const balance = createMockBalance({ domBalance: BigInt(999) });
      setTreasuryData(balance, []);
      expect(getTreasuryBalance()).toEqual(balance);
    });
  });

  describe('isTreasuryStale', () => {
    it('should return true when never fetched', () => {
      expect(isTreasuryStale()).toBe(true);
    });

    it('should return false for recently fetched data', () => {
      setTreasuryData(createMockBalance(), []);
      expect(isTreasuryStale()).toBe(false);
    });

    it('should return true when data is older than threshold', () => {
      const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      $treasury.set({
        balance: createMockBalance(),
        transactions: [],
        lastUpdated: oldTimestamp,
        isLoading: false,
        error: null,
      });

      expect(isTreasuryStale()).toBe(true);
    });

    it('should accept custom threshold', () => {
      const slightlyOld = Date.now() - 100; // 100ms ago
      $treasury.set({
        balance: createMockBalance(),
        transactions: [],
        lastUpdated: slightlyOld,
        isLoading: false,
        error: null,
      });

      expect(isTreasuryStale(50)).toBe(true);
      expect(isTreasuryStale(200)).toBe(false);
    });
  });

  describe('Computed atoms', () => {
    describe('$treasuryBalance', () => {
      it('should return default balance when not fetched', () => {
        const balance = $treasuryBalance.get();
        expect(balance.domBalance).toBe(BigInt(0));
        expect(balance.icpBalance).toBe(BigInt(0));
      });

      it('should return actual balance when fetched', () => {
        setTreasuryData(
          createMockBalance({
            domBalance: BigInt(100),
            icpBalance: BigInt(200),
          }),
          []
        );

        const balance = $treasuryBalance.get();
        expect(balance.domBalance).toBe(BigInt(100));
        expect(balance.icpBalance).toBe(BigInt(200));
      });
    });

    describe('$totalDomBalance', () => {
      it('should sum operational + pending + escrow', () => {
        setTreasuryData(
          createMockBalance({
            domBalance: BigInt(100),
            pendingPayoutsDom: BigInt(50),
            activeEscrowsDom: BigInt(25),
          }),
          []
        );

        expect($totalDomBalance.get()).toBe(BigInt(175));
      });
    });

    describe('$totalIcpBalance', () => {
      it('should sum operational + pending + escrow', () => {
        setTreasuryData(
          createMockBalance({
            icpBalance: BigInt(100),
            pendingPayoutsIcp: BigInt(50),
            activeEscrowsIcp: BigInt(25),
          }),
          []
        );

        expect($totalIcpBalance.get()).toBe(BigInt(175));
      });
    });

    describe('$formattedDomBalance', () => {
      it('should format balance with thousands separators', () => {
        setTreasuryData(
          createMockBalance({
            domBalance: BigInt(123456789000000), // 1,234,567.89 DOM
          }),
          []
        );

        expect($formattedDomBalance.get()).toBe('1,234,567.89');
      });
    });

    describe('$formattedIcpBalance', () => {
      it('should format balance with thousands separators', () => {
        setTreasuryData(
          createMockBalance({
            icpBalance: BigInt(50000000000), // 500 ICP
          }),
          []
        );

        expect($formattedIcpBalance.get()).toBe('500.00');
      });
    });

    describe('$domFundAllocations', () => {
      it('should return zero percentages for zero total', () => {
        const allocations = $domFundAllocations.get();
        expect(allocations).toHaveLength(3);
        expect(allocations.every((a) => a.percentage === 0)).toBe(true);
      });

      it('should calculate correct percentages', () => {
        setTreasuryData(
          createMockBalance({
            domBalance: BigInt(50), // 50%
            pendingPayoutsDom: BigInt(30), // 30%
            activeEscrowsDom: BigInt(20), // 20%
          }),
          []
        );

        const allocations = $domFundAllocations.get();
        expect(allocations[0].name).toBe('Operational');
        expect(allocations[0].percentage).toBe(50);
        expect(allocations[1].name).toBe('Pending Payouts');
        expect(allocations[1].percentage).toBe(30);
        expect(allocations[2].name).toBe('Escrow');
        expect(allocations[2].percentage).toBe(20);
      });
    });

    describe('$icpFundAllocations', () => {
      it('should return zero percentages for zero total', () => {
        const allocations = $icpFundAllocations.get();
        expect(allocations).toHaveLength(3);
        expect(allocations.every((a) => a.percentage === 0)).toBe(true);
      });

      it('should calculate correct percentages', () => {
        setTreasuryData(
          createMockBalance({
            icpBalance: BigInt(60), // 60%
            pendingPayoutsIcp: BigInt(25), // 25%
            activeEscrowsIcp: BigInt(15), // 15%
          }),
          []
        );

        const allocations = $icpFundAllocations.get();
        expect(allocations[0].name).toBe('Operational');
        expect(allocations[0].percentage).toBe(60);
        expect(allocations[1].name).toBe('Pending Payouts');
        expect(allocations[1].percentage).toBe(25);
        expect(allocations[2].name).toBe('Escrow');
        expect(allocations[2].percentage).toBe(15);
      });
    });
  });

  describe('Formatting utilities', () => {
    describe('formatTimestamp', () => {
      it('should format recent timestamp as "Just now"', () => {
        const now = BigInt(Date.now() * 1_000_000);
        expect(formatTimestamp(now)).toBe('Just now');
      });

      it('should format minutes ago', () => {
        const fiveMinutesAgo = BigInt((Date.now() - 5 * 60 * 1000) * 1_000_000);
        expect(formatTimestamp(fiveMinutesAgo)).toBe('5m ago');
      });

      it('should format hours ago', () => {
        const threeHoursAgo = BigInt((Date.now() - 3 * 60 * 60 * 1000) * 1_000_000);
        expect(formatTimestamp(threeHoursAgo)).toBe('3h ago');
      });

      it('should format days ago', () => {
        const twoDaysAgo = BigInt((Date.now() - 2 * 24 * 60 * 60 * 1000) * 1_000_000);
        expect(formatTimestamp(twoDaysAgo)).toBe('2d ago');
      });
    });

    describe('getTransactionTypeLabel', () => {
      it('should return correct labels', () => {
        expect(getTransactionTypeLabel('deposit')).toBe('Deposit');
        expect(getTransactionTypeLabel('withdrawal')).toBe('Withdrawal');
        expect(getTransactionTypeLabel('transfer')).toBe('Transfer');
        expect(getTransactionTypeLabel('burn')).toBe('Burn');
        expect(getTransactionTypeLabel('payout')).toBe('Payout');
        expect(getTransactionTypeLabel('escrow_release')).toBe('Escrow Release');
      });
    });

    describe('getTransactionTypeColor', () => {
      it('should return correct colors', () => {
        expect(getTransactionTypeColor('deposit')).toBe('text-green-600');
        expect(getTransactionTypeColor('withdrawal')).toBe('text-red-600');
        expect(getTransactionTypeColor('transfer')).toBe('text-blue-600');
        expect(getTransactionTypeColor('burn')).toBe('text-orange-600');
        expect(getTransactionTypeColor('payout')).toBe('text-purple-600');
        expect(getTransactionTypeColor('escrow_release')).toBe('text-teal-600');
      });
    });
  });
});
