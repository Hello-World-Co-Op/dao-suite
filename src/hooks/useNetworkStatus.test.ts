/**
 * useNetworkStatus Hook Tests
 *
 * Tests for network status monitoring and callbacks.
 *
 * Story: 9-1-5-error-handling-recovery
 * AC: 7
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNetworkStatus } from './useNetworkStatus';

describe('useNetworkStatus', () => {
  // Store original navigator.onLine
  let originalOnLine: boolean;
  let onlineListeners: Array<() => void> = [];
  let offlineListeners: Array<() => void> = [];

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    onlineListeners = [];
    offlineListeners = [];

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: vi.fn(() => true),
    });

    // Mock addEventListener and removeEventListener for online/offline events
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'online') {
        onlineListeners.push(handler as () => void);
      } else if (event === 'offline') {
        offlineListeners.push(handler as () => void);
      }
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation((event, handler) => {
      if (event === 'online') {
        onlineListeners = onlineListeners.filter((l) => l !== handler);
      } else if (event === 'offline') {
        offlineListeners = offlineListeners.filter((l) => l !== handler);
      }
    });
  });

  afterEach(() => {
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => originalOnLine,
    });
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('should return true when navigator.onLine is true', () => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => true,
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);
    });

    it('should return false when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(false);
    });
  });

  describe('Network events', () => {
    it('should update isOnline when going offline', () => {
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(true);

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      act(() => {
        offlineListeners.forEach((listener) => listener());
      });

      expect(result.current.isOnline).toBe(false);
    });

    it('should update isOnline when going online', () => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.isOnline).toBe(false);

      // Simulate going online
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => true,
      });

      act(() => {
        onlineListeners.forEach((listener) => listener());
      });

      expect(result.current.isOnline).toBe(true);
    });
  });

  describe('Callbacks', () => {
    it('should call onOffline callback when going offline', () => {
      const onOffline = vi.fn();
      renderHook(() => useNetworkStatus({ onOffline }));

      act(() => {
        offlineListeners.forEach((listener) => listener());
      });

      expect(onOffline).toHaveBeenCalled();
    });

    it('should call onOnline callback when going online', () => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });

      const onOnline = vi.fn();
      renderHook(() => useNetworkStatus({ onOnline }));

      // Go online
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => true,
      });

      act(() => {
        onlineListeners.forEach((listener) => listener());
      });

      expect(onOnline).toHaveBeenCalled();
    });
  });

  describe('wasOffline tracking', () => {
    it('should track wasOffline state', () => {
      const { result } = renderHook(() => useNetworkStatus());

      expect(result.current.wasOffline).toBe(false);

      // Go offline
      act(() => {
        offlineListeners.forEach((listener) => listener());
      });

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: () => true,
      });

      act(() => {
        onlineListeners.forEach((listener) => listener());
      });

      expect(result.current.wasOffline).toBe(true);
    });

    it('should clear wasOffline when clearWasOffline is called', () => {
      const { result } = renderHook(() => useNetworkStatus());

      // Go offline and back online
      act(() => {
        offlineListeners.forEach((listener) => listener());
      });
      act(() => {
        onlineListeners.forEach((listener) => listener());
      });

      expect(result.current.wasOffline).toBe(true);

      act(() => {
        result.current.clearWasOffline();
      });

      expect(result.current.wasOffline).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useNetworkStatus());

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });
});
