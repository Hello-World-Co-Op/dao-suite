/**
 * Burn State Tests
 *
 * Story: 9-2-3-burn-donation
 * AC: 1, 2, 5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  $burnPool,
  $burnExecution,
  $burnPoolLoading,
  $burnPoolError,
  $hasBurnPoolData,
  $formattedTotalBurned,
  $isBurnPending,
  $isBurnSuccess,
  $burnHistory,
  $confirmedBurns,
  $userTotalBurned,
  $formattedUserTotalBurned,
  $burnCount,
  setBurnPoolLoading,
  setBurnPoolData,
  setBurnPoolError,
  clearBurnPool,
  isBurnPoolStale,
  setBurnPending,
  setBurnSuccess,
  setBurnExecutionError,
  resetBurnExecution,
  addBurnRecord,
  updateBurnRecordStatus,
  removeBurnRecord,
  clearBurnHistory,
  getPendingBurnRecord,
  exportBurnHistoryCSV,
  validateBurnAmount,
  getMaxBurnAmount,
  generateBurnId,
  BURN_POOL_STALE_THRESHOLD_MS,
  MIN_BURN_AMOUNT,
  BURN_TX_FEE_RESERVE,
  type LocalBurnRecord,
} from '@/stores';

// Helper to create a mock burn record
function createMockBurnRecord(overrides: Partial<LocalBurnRecord> = {}): LocalBurnRecord {
  return {
    id: `burn-${Date.now()}-test`,
    amount: BigInt(100_000_000), // 1 DOM
    timestamp: Date.now(),
    status: 'confirmed',
    ...overrides,
  };
}

describe('Burn State', () => {
  beforeEach(() => {
    clearBurnPool();
    resetBurnExecution();
    clearBurnHistory();
    vi.clearAllMocks();
  });

  describe('Configuration constants', () => {
    it('should have correct stale threshold', () => {
      expect(BURN_POOL_STALE_THRESHOLD_MS).toBe(2 * 60 * 1000); // 2 minutes
    });

    it('should have correct minimum burn amount', () => {
      expect(MIN_BURN_AMOUNT).toBe(BigInt(100_000_000)); // 1 DOM
    });

    it('should have correct fee reserve', () => {
      expect(BURN_TX_FEE_RESERVE).toBe(BigInt(0)); // Burns are fee-free per ICRC-1
    });
  });

  describe('Initial state', () => {
    it('should have null pool initially', () => {
      expect($burnPool.get().pool).toBeNull();
    });

    it('should not be loading initially', () => {
      expect($burnPoolLoading.get()).toBe(false);
    });

    it('should have no error initially', () => {
      expect($burnPoolError.get()).toBeNull();
    });

    it('should not have burn pool data initially', () => {
      expect($hasBurnPoolData.get()).toBe(false);
    });

    it('should not have pending burn initially', () => {
      expect($isBurnPending.get()).toBe(false);
    });

    it('should not have success state initially', () => {
      expect($isBurnSuccess.get()).toBe(false);
    });
  });

  describe('setBurnPoolLoading', () => {
    it('should set loading to true', () => {
      setBurnPoolLoading(true);
      expect($burnPoolLoading.get()).toBe(true);
    });

    it('should set loading to false', () => {
      setBurnPoolLoading(true);
      setBurnPoolLoading(false);
      expect($burnPoolLoading.get()).toBe(false);
    });

    it('should clear error when starting new fetch', () => {
      setBurnPoolError('Previous error');
      setBurnPoolLoading(true);
      expect($burnPoolError.get()).toBeNull();
    });
  });

  describe('setBurnPoolData', () => {
    it('should set total burned', () => {
      setBurnPoolData(BigInt(250_000_000_000_000)); // 2,500,000 DOM

      const state = $burnPool.get();
      expect(state.pool?.totalBurned).toBe(BigInt(250_000_000_000_000));
    });

    it('should set lastUpdated timestamp', () => {
      const before = Date.now();
      setBurnPoolData(BigInt(100));
      const after = Date.now();

      const state = $burnPool.get();
      expect(state.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(state.lastUpdated).toBeLessThanOrEqual(after);
    });

    it('should clear loading and error', () => {
      setBurnPoolLoading(true);
      setBurnPoolError('Some error');

      setBurnPoolData(BigInt(100));

      expect($burnPoolLoading.get()).toBe(false);
      expect($burnPoolError.get()).toBeNull();
    });

    it('should mark hasBurnPoolData as true', () => {
      expect($hasBurnPoolData.get()).toBe(false);
      setBurnPoolData(BigInt(100));
      expect($hasBurnPoolData.get()).toBe(true);
    });
  });

  describe('setBurnPoolError', () => {
    it('should set error message', () => {
      setBurnPoolError('Failed to fetch');
      expect($burnPoolError.get()).toBe('Failed to fetch');
    });

    it('should set loading to false', () => {
      setBurnPoolLoading(true);
      setBurnPoolError('Error');
      expect($burnPoolLoading.get()).toBe(false);
    });
  });

  describe('clearBurnPool', () => {
    it('should reset pool state to initial values', () => {
      setBurnPoolData(BigInt(12345));
      setBurnPoolError('Some error');

      clearBurnPool();

      const state = $burnPool.get();
      expect(state.pool).toBeNull();
      expect(state.lastUpdated).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('isBurnPoolStale', () => {
    it('should return true when never fetched', () => {
      expect(isBurnPoolStale()).toBe(true);
    });

    it('should return false for recently fetched data', () => {
      setBurnPoolData(BigInt(100));
      expect(isBurnPoolStale()).toBe(false);
    });

    it('should return true when data is older than threshold', () => {
      const oldTimestamp = Date.now() - 3 * 60 * 1000; // 3 minutes ago
      $burnPool.set({
        pool: { totalBurned: BigInt(100) },
        lastUpdated: oldTimestamp,
        isLoading: false,
        error: null,
      });

      expect(isBurnPoolStale()).toBe(true);
    });

    it('should accept custom threshold', () => {
      const slightlyOld = Date.now() - 100; // 100ms ago
      $burnPool.set({
        pool: { totalBurned: BigInt(100) },
        lastUpdated: slightlyOld,
        isLoading: false,
        error: null,
      });

      expect(isBurnPoolStale(50)).toBe(true);
      expect(isBurnPoolStale(200)).toBe(false);
    });
  });

  describe('Burn Execution State', () => {
    describe('setBurnPending', () => {
      it('should set pending state with amount', () => {
        setBurnPending(BigInt(500_000_000)); // 5 DOM

        const state = $burnExecution.get();
        expect(state.isPending).toBe(true);
        expect(state.pendingAmount).toBe(BigInt(500_000_000));
        expect(state.isSuccess).toBe(false);
        expect(state.error).toBeNull();
      });
    });

    describe('setBurnSuccess', () => {
      it('should set success state with tx index', () => {
        setBurnPending(BigInt(100));
        setBurnSuccess('1001');

        const state = $burnExecution.get();
        expect(state.isPending).toBe(false);
        expect(state.isSuccess).toBe(true);
        expect(state.lastTxIndex).toBe('1001');
        expect(state.error).toBeNull();
      });
    });

    describe('setBurnExecutionError', () => {
      it('should set error and clear pending', () => {
        setBurnPending(BigInt(100));
        setBurnExecutionError('Transaction failed');

        const state = $burnExecution.get();
        expect(state.isPending).toBe(false);
        expect(state.isSuccess).toBe(false);
        expect(state.error).toBe('Transaction failed');
      });
    });

    describe('resetBurnExecution', () => {
      it('should reset all execution state', () => {
        setBurnSuccess('1001');

        resetBurnExecution();

        const state = $burnExecution.get();
        expect(state.isPending).toBe(false);
        expect(state.pendingAmount).toBeNull();
        expect(state.isSuccess).toBe(false);
        expect(state.lastTxIndex).toBeNull();
        expect(state.error).toBeNull();
      });
    });
  });

  describe('Burn History (localStorage)', () => {
    describe('addBurnRecord', () => {
      it('should add record to history', () => {
        const record = createMockBurnRecord({ id: 'burn-test-1' });
        addBurnRecord(record);

        const history = $burnHistory.get();
        expect(history).toHaveLength(1);
        expect(history[0].id).toBe('burn-test-1');
      });

      it('should add new records at the beginning', () => {
        const record1 = createMockBurnRecord({ id: 'burn-1' });
        const record2 = createMockBurnRecord({ id: 'burn-2' });

        addBurnRecord(record1);
        addBurnRecord(record2);

        const history = $burnHistory.get();
        expect(history[0].id).toBe('burn-2');
        expect(history[1].id).toBe('burn-1');
      });
    });

    describe('updateBurnRecordStatus', () => {
      it('should update record status', () => {
        const record = createMockBurnRecord({ id: 'burn-update', status: 'pending' });
        addBurnRecord(record);

        updateBurnRecordStatus('burn-update', 'confirmed', '1001');

        const history = $burnHistory.get();
        expect(history[0].status).toBe('confirmed');
        expect(history[0].txIndex).toBe('1001');
      });
    });

    describe('removeBurnRecord', () => {
      it('should remove record from history', () => {
        const record = createMockBurnRecord({ id: 'burn-remove' });
        addBurnRecord(record);

        removeBurnRecord('burn-remove');

        const history = $burnHistory.get();
        expect(history).toHaveLength(0);
      });
    });

    describe('clearBurnHistory', () => {
      it('should remove all records', () => {
        addBurnRecord(createMockBurnRecord({ id: 'burn-1' }));
        addBurnRecord(createMockBurnRecord({ id: 'burn-2' }));

        clearBurnHistory();

        const history = $burnHistory.get();
        expect(history).toHaveLength(0);
      });
    });

    describe('getPendingBurnRecord', () => {
      it('should return null when no pending records', () => {
        addBurnRecord(createMockBurnRecord({ status: 'confirmed' }));

        expect(getPendingBurnRecord()).toBeNull();
      });

      it('should return pending record', () => {
        addBurnRecord(createMockBurnRecord({ id: 'pending-burn', status: 'pending' }));

        const pending = getPendingBurnRecord();
        expect(pending?.id).toBe('pending-burn');
        expect(pending?.status).toBe('pending');
      });
    });
  });

  describe('Computed atoms', () => {
    describe('$formattedTotalBurned', () => {
      it('should return 0.00 when no pool data', () => {
        expect($formattedTotalBurned.get()).toBe('0.00');
      });

      it('should format total burned correctly', () => {
        setBurnPoolData(BigInt(250_000_000_000_000)); // 2,500,000 DOM
        expect($formattedTotalBurned.get()).toBe('2,500,000.00');
      });
    });

    describe('$confirmedBurns', () => {
      it('should filter only confirmed burns', () => {
        addBurnRecord(createMockBurnRecord({ id: '1', status: 'confirmed' }));
        addBurnRecord(createMockBurnRecord({ id: '2', status: 'pending' }));
        addBurnRecord(createMockBurnRecord({ id: '3', status: 'confirmed' }));
        addBurnRecord(createMockBurnRecord({ id: '4', status: 'failed' }));

        const confirmed = $confirmedBurns.get();
        expect(confirmed).toHaveLength(2);
        expect(confirmed.every((r) => r.status === 'confirmed')).toBe(true);
      });
    });

    describe('$userTotalBurned', () => {
      it('should sum confirmed burn amounts', () => {
        addBurnRecord(createMockBurnRecord({ amount: BigInt(100_000_000), status: 'confirmed' }));
        addBurnRecord(createMockBurnRecord({ amount: BigInt(200_000_000), status: 'confirmed' }));
        addBurnRecord(createMockBurnRecord({ amount: BigInt(50_000_000), status: 'pending' })); // Should not count

        expect($userTotalBurned.get()).toBe(BigInt(300_000_000));
      });
    });

    describe('$formattedUserTotalBurned', () => {
      it('should format user total correctly', () => {
        // 1,234,567,890 e8s = 12.34567890 DOM -> formatted as "12.34"
        addBurnRecord(createMockBurnRecord({ amount: BigInt(1_234_567_890), status: 'confirmed' }));

        expect($formattedUserTotalBurned.get()).toBe('12.34');
      });
    });

    describe('$burnCount', () => {
      it('should count confirmed burns', () => {
        addBurnRecord(createMockBurnRecord({ status: 'confirmed' }));
        addBurnRecord(createMockBurnRecord({ status: 'confirmed' }));
        addBurnRecord(createMockBurnRecord({ status: 'pending' }));

        expect($burnCount.get()).toBe(2);
      });
    });
  });

  describe('Validation utilities', () => {
    describe('validateBurnAmount', () => {
      it('should reject zero amount', () => {
        const error = validateBurnAmount(BigInt(0), BigInt(100_000_000));
        expect(error).toBe('Amount must be greater than 0');
      });

      it('should reject negative amount', () => {
        const error = validateBurnAmount(BigInt(-100), BigInt(100_000_000));
        expect(error).toBe('Amount must be greater than 0');
      });

      it('should reject amount below minimum', () => {
        const error = validateBurnAmount(BigInt(50_000_000), BigInt(1_000_000_000)); // 0.5 DOM
        expect(error).toContain('Minimum burn is');
      });

      it('should allow burning exact balance when fee is 0', () => {
        const balance = BigInt(100_000_000); // 1 DOM
        const amount = BigInt(100_000_000); // 1 DOM (full balance)

        const error = validateBurnAmount(amount, balance);
        // With BURN_TX_FEE_RESERVE = 0, burning exact balance is valid
        expect(error).toBeNull();
      });

      it('should reject amount exceeding balance', () => {
        const balance = BigInt(100_000_000); // 1 DOM
        const amount = BigInt(200_000_000); // 2 DOM (more than balance)

        const error = validateBurnAmount(amount, balance);
        expect(error).toContain('Maximum burn is');
      });

      it('should return null for valid amount', () => {
        const balance = BigInt(500_000_000); // 5 DOM
        const amount = BigInt(200_000_000); // 2 DOM

        const error = validateBurnAmount(amount, balance);
        expect(error).toBeNull();
      });
    });

    describe('getMaxBurnAmount', () => {
      it('should return balance minus fee reserve', () => {
        const balance = BigInt(100_000_000); // 1 DOM
        const max = getMaxBurnAmount(balance);

        expect(max).toBe(balance - BURN_TX_FEE_RESERVE);
      });

      it('should return full balance when fee is 0', () => {
        const balance = BigInt(5_000); // Very small balance
        const max = getMaxBurnAmount(balance);

        // With BURN_TX_FEE_RESERVE = 0, max equals balance
        expect(max).toBe(balance);
      });
    });

    describe('generateBurnId', () => {
      it('should generate unique IDs', () => {
        const id1 = generateBurnId();
        const id2 = generateBurnId();

        expect(id1).not.toBe(id2);
        expect(id1.startsWith('burn-')).toBe(true);
        expect(id2.startsWith('burn-')).toBe(true);
      });
    });
  });

  describe('exportBurnHistoryCSV', () => {
    it('should return empty string for no records', () => {
      expect(exportBurnHistoryCSV()).toBe('');
    });

    it('should return CSV with headers and data', () => {
      addBurnRecord(
        createMockBurnRecord({
          id: 'test-burn',
          amount: BigInt(100_000_000),
          status: 'confirmed',
          txIndex: '1001',
        })
      );

      const csv = exportBurnHistoryCSV();

      expect(csv).toContain('Date,Amount (DOM),Transaction Index,Status');
      expect(csv).toContain('1.00');
      expect(csv).toContain('1001');
      expect(csv).toContain('confirmed');
    });
  });
});
