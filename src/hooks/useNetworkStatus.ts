/**
 * useNetworkStatus Hook
 *
 * Monitors browser network connectivity and provides status updates.
 * Supports callbacks for online/offline events.
 *
 * Story: 9-1-5-error-handling-recovery
 * AC: 7
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface NetworkStatusCallbacks {
  /** Called when network comes online */
  onOnline?: () => void;
  /** Called when network goes offline */
  onOffline?: () => void;
}

export interface UseNetworkStatusResult {
  /** Whether the browser is online */
  isOnline: boolean;
  /** Whether we were recently offline (for showing recovery message) */
  wasOffline: boolean;
  /** Clear the wasOffline flag */
  clearWasOffline: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for monitoring network status
 *
 * @param callbacks - Optional callbacks for online/offline events
 * @returns Network status information
 *
 * @example
 * ```tsx
 * const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus({
 *   onOnline: () => refetch(),
 *   onOffline: () => showOfflineMessage(),
 * });
 * ```
 */
export function useNetworkStatus(callbacks?: NetworkStatusCallbacks): UseNetworkStatusResult {
  // Get initial online status
  const getInitialOnlineStatus = () => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Assume online for SSR
  };

  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);
  const [wasOffline, setWasOffline] = useState(false);

  // Store callbacks in ref to avoid re-subscribing on callback changes
  const callbacksRef = useRef(callbacks);
  // Update ref in effect to avoid React Compiler warning about refs during render
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  // Clear wasOffline flag
  const clearWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      callbacksRef.current?.onOnline?.();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      callbacksRef.current?.onOffline?.();
    };

    // Subscribe to events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state (in case it changed between render and effect)
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    wasOffline,
    clearWasOffline,
  };
}

export default useNetworkStatus;
