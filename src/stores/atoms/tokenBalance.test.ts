/**
 * Token Balance State Tests
 *
 * Story: 9-2-1-token-balance-display
 * AC: 1, 2, 3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  $tokenBalance,
  $tokenMetadata,
  $tokenBalanceLoading,
  $tokenBalanceError,
  $formattedBalance,
  $hasBalance,
  formatTokenAmount,
  parseTokenAmount,
  setTokenBalanceLoading,
  setTokenBalance,
  setTokenBalanceError,
  clearTokenBalance,
  updateTokenMetadata,
  getTokenBalanceValue,
  isBalanceStale,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  TOKEN_NAME,
  DEFAULT_TOKEN_METADATA,
} from '@/stores';

describe('Token Balance State', () => {
  beforeEach(() => {
    // Reset state before each test
    clearTokenBalance();
    $tokenMetadata.set({ ...DEFAULT_TOKEN_METADATA });
    vi.clearAllMocks();
  });

  describe('Configuration constants', () => {
    it('should have correct default values', () => {
      expect(TOKEN_DECIMALS).toBe(8);
      expect(TOKEN_SYMBOL).toBe('DOM');
      expect(TOKEN_NAME).toBe('Decentralized Otter Money');
    });

    it('DEFAULT_TOKEN_METADATA should match constants', () => {
      expect(DEFAULT_TOKEN_METADATA.decimals).toBe(TOKEN_DECIMALS);
      expect(DEFAULT_TOKEN_METADATA.symbol).toBe(TOKEN_SYMBOL);
      expect(DEFAULT_TOKEN_METADATA.name).toBe(TOKEN_NAME);
    });
  });

  describe('Initial state', () => {
    it('should have zero balance initially', () => {
      expect($tokenBalance.get().balance).toBe(BigInt(0));
    });

    it('should not be loading initially', () => {
      expect($tokenBalanceLoading.get()).toBe(false);
    });

    it('should have no error initially', () => {
      expect($tokenBalanceError.get()).toBeNull();
    });

    it('should not have balance fetched initially', () => {
      expect($hasBalance.get()).toBe(false);
    });

    it('should format zero balance as 0.00', () => {
      expect($formattedBalance.get()).toBe('0.00');
    });
  });

  describe('setTokenBalanceLoading', () => {
    it('should set loading to true', () => {
      setTokenBalanceLoading(true);
      expect($tokenBalanceLoading.get()).toBe(true);
    });

    it('should set loading to false', () => {
      setTokenBalanceLoading(true);
      setTokenBalanceLoading(false);
      expect($tokenBalanceLoading.get()).toBe(false);
    });

    it('should clear error when starting new fetch', () => {
      setTokenBalanceError('Previous error');
      setTokenBalanceLoading(true);
      expect($tokenBalanceError.get()).toBeNull();
    });
  });

  describe('setTokenBalance', () => {
    it('should set balance and principal', () => {
      const testBalance = BigInt(123456789012);
      const testPrincipal = 'test-principal-123';

      setTokenBalance(testBalance, testPrincipal);

      const state = $tokenBalance.get();
      expect(state.balance).toBe(testBalance);
      expect(state.principal).toBe(testPrincipal);
    });

    it('should set lastUpdated timestamp', () => {
      const before = Date.now();
      setTokenBalance(BigInt(100), 'test');
      const after = Date.now();

      const state = $tokenBalance.get();
      expect(state.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(state.lastUpdated).toBeLessThanOrEqual(after);
    });

    it('should clear loading and error', () => {
      setTokenBalanceLoading(true);
      setTokenBalanceError('Some error');

      setTokenBalance(BigInt(100), 'test');

      expect($tokenBalanceLoading.get()).toBe(false);
      expect($tokenBalanceError.get()).toBeNull();
    });

    it('should mark hasBalance as true', () => {
      expect($hasBalance.get()).toBe(false);
      setTokenBalance(BigInt(100), 'test');
      expect($hasBalance.get()).toBe(true);
    });
  });

  describe('setTokenBalanceError', () => {
    it('should set error message', () => {
      setTokenBalanceError('Failed to fetch');
      expect($tokenBalanceError.get()).toBe('Failed to fetch');
    });

    it('should set loading to false', () => {
      setTokenBalanceLoading(true);
      setTokenBalanceError('Error');
      expect($tokenBalanceLoading.get()).toBe(false);
    });

    it('should preserve existing balance', () => {
      setTokenBalance(BigInt(100), 'test');
      setTokenBalanceError('Network error');

      const state = $tokenBalance.get();
      expect(state.balance).toBe(BigInt(100));
      expect(state.error).toBe('Network error');
    });
  });

  describe('clearTokenBalance', () => {
    it('should reset all state to initial values', () => {
      setTokenBalance(BigInt(12345), 'some-principal');
      setTokenBalanceError('Some error');

      clearTokenBalance();

      const state = $tokenBalance.get();
      expect(state.balance).toBe(BigInt(0));
      expect(state.principal).toBeNull();
      expect(state.lastUpdated).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('updateTokenMetadata', () => {
    it('should update partial metadata', () => {
      updateTokenMetadata({ symbol: 'XYZ' });

      const metadata = $tokenMetadata.get();
      expect(metadata.symbol).toBe('XYZ');
      expect(metadata.decimals).toBe(TOKEN_DECIMALS); // Unchanged
      expect(metadata.name).toBe(TOKEN_NAME); // Unchanged
    });

    it('should update multiple fields', () => {
      updateTokenMetadata({
        symbol: 'NEW',
        decimals: 6,
        name: 'New Token',
      });

      const metadata = $tokenMetadata.get();
      expect(metadata.symbol).toBe('NEW');
      expect(metadata.decimals).toBe(6);
      expect(metadata.name).toBe('New Token');
    });
  });

  describe('getTokenBalanceValue', () => {
    it('should return current balance', () => {
      setTokenBalance(BigInt(999), 'test');
      expect(getTokenBalanceValue()).toBe(BigInt(999));
    });
  });

  describe('isBalanceStale', () => {
    it('should return true when never fetched', () => {
      expect(isBalanceStale()).toBe(true);
    });

    it('should return false for recently fetched balance', () => {
      setTokenBalance(BigInt(100), 'test');
      expect(isBalanceStale()).toBe(false);
    });

    it('should return true when balance is older than threshold', () => {
      // Set balance with old timestamp
      const oldTimestamp = Date.now() - 3 * 60 * 1000; // 3 minutes ago
      $tokenBalance.set({
        balance: BigInt(100),
        lastUpdated: oldTimestamp,
        isLoading: false,
        error: null,
        principal: 'test',
      });

      expect(isBalanceStale(2 * 60 * 1000)).toBe(true); // 2 minute threshold
    });

    it('should accept custom threshold', () => {
      // Set balance with slightly old timestamp
      const slightlyOld = Date.now() - 100; // 100ms ago
      $tokenBalance.set({
        balance: BigInt(100),
        lastUpdated: slightlyOld,
        isLoading: false,
        error: null,
        principal: 'test',
      });

      // With a 50ms threshold, 100ms old balance should be stale
      expect(isBalanceStale(50)).toBe(true);
      // With a 200ms threshold, 100ms old balance should not be stale
      expect(isBalanceStale(200)).toBe(false);
    });
  });

  describe('formatTokenAmount', () => {
    it('should format zero as 0.00', () => {
      expect(formatTokenAmount(BigInt(0))).toBe('0.00');
    });

    it('should format small amounts correctly', () => {
      // 0.00000001 DOM = 1 e8s
      expect(formatTokenAmount(BigInt(1))).toBe('0.00');
    });

    it('should format fractional amounts with 2 decimals', () => {
      // 1.23456789 DOM = 123456789 e8s
      expect(formatTokenAmount(BigInt(123456789))).toBe('1.23');
    });

    it('should format whole numbers correctly', () => {
      // 100 DOM = 10000000000 e8s
      expect(formatTokenAmount(BigInt(10000000000))).toBe('100.00');
    });

    it('should add thousands separators', () => {
      // 1,234,567.89 DOM
      expect(formatTokenAmount(BigInt(123456789000000))).toBe('1,234,567.89');
    });

    it('should handle large whale amounts', () => {
      // 420,000,000 DOM
      expect(formatTokenAmount(BigInt(42000000000000000))).toBe('420,000,000.00');
    });

    it('should respect custom decimals', () => {
      // 100 with 6 decimals = 100000000
      expect(formatTokenAmount(BigInt(100000000), 6)).toBe('100.00');
    });
  });

  describe('parseTokenAmount', () => {
    it('should parse zero', () => {
      expect(parseTokenAmount('0')).toBe(BigInt(0));
    });

    it('should parse whole numbers', () => {
      // 100 DOM = 10000000000 e8s
      expect(parseTokenAmount('100')).toBe(BigInt(10000000000));
    });

    it('should parse decimal amounts', () => {
      // 1.5 DOM = 150000000 e8s
      expect(parseTokenAmount('1.5')).toBe(BigInt(150000000));
    });

    it('should handle amounts with commas', () => {
      expect(parseTokenAmount('1,000')).toBe(BigInt(100000000000));
    });

    it('should pad fractional part', () => {
      // 1.1 should be treated as 1.10000000
      expect(parseTokenAmount('1.1')).toBe(BigInt(110000000));
    });

    it('should truncate extra decimals', () => {
      // Only first 8 decimals should be used
      expect(parseTokenAmount('1.123456789999')).toBe(BigInt(112345678));
    });

    it('should respect custom decimals', () => {
      // 100 with 6 decimals = 100000000
      expect(parseTokenAmount('100', 6)).toBe(BigInt(100000000));
    });
  });

  describe('$formattedBalance computed', () => {
    it('should update when balance changes', () => {
      expect($formattedBalance.get()).toBe('0.00');

      setTokenBalance(BigInt(500000000000), 'test'); // 5,000 DOM
      expect($formattedBalance.get()).toBe('5,000.00');
    });

    it('should use current metadata decimals', () => {
      setTokenBalance(BigInt(100000000), 'test');
      expect($formattedBalance.get()).toBe('1.00');

      // Change decimals
      updateTokenMetadata({ decimals: 6 });
      expect($formattedBalance.get()).toBe('100.00');
    });
  });
});
