/**
 * Canister Unavailable Banner
 *
 * Displays a banner when a canister service is unavailable,
 * with a retry option. Can be used for any canister (governance, membership, etc.)
 *
 * Story: 9-1-5-error-handling-recovery
 * AC: 3
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// ============================================================================
// Props
// ============================================================================

export interface CanisterUnavailableProps {
  /** Name of the canister/service that is unavailable (e.g., "Governance", "Membership") */
  canisterName?: string;
  /** Custom message (overrides default if provided) */
  message?: string;
  /** Retry handler */
  onRetry?: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Whether to show the banner (for conditional rendering) */
  show?: boolean;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CanisterUnavailable({
  canisterName,
  message,
  onRetry,
  isRetrying = false,
  show = true,
  className = '',
}: CanisterUnavailableProps): React.ReactElement | null {
  if (!show) {
    return null;
  }

  // Generate default message based on canister name, or use custom message
  const displayMessage =
    message ??
    (canisterName
      ? `The ${canisterName} service is temporarily unavailable. Your actions are safe and data has been saved.`
      : 'The service is temporarily unavailable. Your actions are safe and data has been saved.');

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        rounded-lg border border-yellow-300 bg-yellow-50 p-4
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Warning Icon */}
        <div className="flex-shrink-0">
          <div className="rounded-full bg-yellow-100 p-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" aria-hidden="true" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-yellow-800">Service Temporarily Unavailable</h3>
          <p className="mt-1 text-sm text-yellow-700">{displayMessage}</p>

          {/* Retry button */}
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="
                mt-3 inline-flex items-center gap-2
                px-3 py-1.5 text-sm font-medium
                text-yellow-800 bg-yellow-100
                rounded-md border border-yellow-300
                hover:bg-yellow-200
                focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150
              "
              aria-busy={isRetrying}
            >
              <RefreshCw
                className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {isRetrying ? 'Trying...' : 'Try Again'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CanisterUnavailable;
