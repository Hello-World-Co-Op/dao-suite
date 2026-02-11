/**
 * Offline Banner Component
 *
 * Reusable banner that displays when the user is offline.
 * Can be included in layouts or individual pages.
 *
 * Story: 9-1-5-error-handling-recovery
 * AC: 7
 */

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

// ============================================================================
// Props
// ============================================================================

export interface OfflineBannerProps {
  /** Custom message to display */
  message?: string;
  /** Optional callback when connection is restored */
  onReconnect?: () => void;
  /** Whether to show a retry button when back online */
  showRetryOnReconnect?: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function OfflineBanner({
  message = 'You appear to be offline. Some features may be unavailable.',
  onReconnect,
  showRetryOnReconnect = true,
  className = '',
}: OfflineBannerProps): React.ReactElement | null {
  const { isOnline, wasOffline, clearWasOffline } = useNetworkStatus({
    onOnline: onReconnect,
  });

  // Show nothing if online and wasn't recently offline
  if (isOnline && !wasOffline) {
    return null;
  }

  // Show reconnected banner with retry option
  if (isOnline && wasOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`
          flex items-center justify-between gap-3
          rounded-lg bg-green-50 border border-green-200 p-3
          ${className}
        `}
      >
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 rounded-full bg-green-100 p-1">
            <WifiOff className="h-4 w-4 text-green-600" aria-hidden="true" />
          </div>
          <span className="text-sm text-green-800">You're back online!</span>
        </div>

        {showRetryOnReconnect && (
          <button
            onClick={() => {
              clearWasOffline();
              onReconnect?.();
            }}
            className="
              inline-flex items-center gap-1.5
              px-3 py-1 text-sm font-medium
              text-green-700 bg-green-100
              rounded-md border border-green-300
              hover:bg-green-200
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
              transition-colors duration-150
            "
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        )}

        <button
          onClick={clearWasOffline}
          className="
            text-green-600 hover:text-green-800
            focus:outline-none focus:underline
            text-sm
          "
          aria-label="Dismiss notification"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // Show offline banner
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-center gap-2
        rounded-lg bg-yellow-50 border border-yellow-200 p-3
        ${className}
      `}
    >
      <div className="flex-shrink-0 rounded-full bg-yellow-100 p-1">
        <WifiOff className="h-4 w-4 text-yellow-600" aria-hidden="true" />
      </div>
      <span className="text-sm text-yellow-800">{message}</span>
    </div>
  );
}

/**
 * Standalone version that manages its own network status
 * Use this when you don't need callbacks
 */
export function OfflineBannerStandalone({
  message,
  className,
}: Pick<OfflineBannerProps, 'message' | 'className'>): React.ReactElement | null {
  const { isOnline } = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        flex items-center gap-2
        rounded-lg bg-yellow-50 border border-yellow-200 p-3
        ${className ?? ''}
      `}
    >
      <div className="flex-shrink-0 rounded-full bg-yellow-100 p-1">
        <WifiOff className="h-4 w-4 text-yellow-600" aria-hidden="true" />
      </div>
      <span className="text-sm text-yellow-800">
        {message ?? 'You appear to be offline. Some features may be unavailable.'}
      </span>
    </div>
  );
}

export default OfflineBanner;
