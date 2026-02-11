/**
 * Token Balance Component
 *
 * Displays DOM token balance with refresh capability and burn donation link.
 * Integrates with token balance state management and service.
 *
 * Story: 9-2-1-token-balance-display
 * ACs: 1, 3, 4
 */

import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { RefreshCw, Flame, Wallet, AlertCircle } from 'lucide-react';
import { $formattedBalance, $tokenBalance, $tokenMetadata } from '@/stores';
import { useTokenBalance } from '../services/tokenService';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Loading Skeleton
// ============================================================================

function BalanceSkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse flex items-center gap-2">
      <div className="h-7 w-32 bg-gray-200 rounded" />
      <div className="h-5 w-12 bg-gray-200 rounded" />
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}

function ErrorState({ error: _error, onRetry, isRetrying }: ErrorStateProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="h-5 w-5" aria-hidden="true" />
        <span className="text-sm">Failed to load balance</span>
      </div>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="
          text-sm text-teal-600 hover:text-teal-800
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:underline
        "
        aria-label="Retry loading balance"
      >
        {isRetrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  );
}

// ============================================================================
// Balance Display
// ============================================================================

interface BalanceDisplayProps {
  formattedBalance: string;
  symbol: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function BalanceDisplay({
  formattedBalance,
  symbol,
  isRefreshing,
  onRefresh,
}: BalanceDisplayProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      {/* Balance value */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-gray-900 tabular-nums">
          {formattedBalance}
        </span>
        <span className="text-sm font-medium text-gray-500">{symbol}</span>
      </div>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="
          p-1.5 rounded-full
          text-gray-400 hover:text-gray-600 hover:bg-gray-100
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
          transition-colors duration-150
        "
        aria-label={isRefreshing ? 'Refreshing balance' : 'Refresh balance'}
        title="Refresh balance"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}

// ============================================================================
// Zero Balance State
// ============================================================================

interface ZeroBalanceProps {
  symbol: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function ZeroBalance({ symbol, isRefreshing, onRefresh }: ZeroBalanceProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-gray-400 tabular-nums">0.00</span>
        <span className="text-sm font-medium text-gray-400">{symbol}</span>
      </div>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="
          p-1.5 rounded-full
          text-gray-400 hover:text-gray-600 hover:bg-gray-100
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
          transition-colors duration-150
        "
        aria-label={isRefreshing ? 'Refreshing balance' : 'Refresh balance'}
        title="Refresh balance"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface TokenBalanceProps {
  /** Principal to fetch balance for (required when authenticated) */
  principal: string | null;
  /** Optional className for container */
  className?: string;
  /** Whether to show the burn donation link */
  showBurnLink?: boolean;
  /** Compact mode for smaller display */
  compact?: boolean;
}

export function TokenBalance({
  principal,
  className = '',
  showBurnLink = true,
  compact = false,
}: TokenBalanceProps): React.ReactElement | null {
  const formattedBalance = useStore($formattedBalance);
  const balanceState = useStore($tokenBalance);
  const metadata = useStore($tokenMetadata);

  const { isLoading, isRefreshing, refresh } = useTokenBalance({
    principal,
    autoFetch: true,
    refetchIfStale: true,
  });

  // Track burn link click
  const handleBurnLinkClick = useCallback(() => {
    trackEvent('burn_donation_link_clicked', {
      balance: balanceState.balance.toString(),
    });
  }, [balanceState.balance]);

  // Don't render if no principal
  if (!principal) {
    return null;
  }

  // Determine if balance is zero
  const isZeroBalance = balanceState.balance === BigInt(0);

  // Card/compact mode styling
  const containerClasses = compact
    ? `flex items-center gap-4 ${className}`
    : `bg-white rounded-lg border border-gray-200 p-4 ${className}`;

  return (
    <div className={containerClasses}>
      {/* Icon and label (only in non-compact mode) */}
      {!compact && (
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-5 w-5 text-teal-600" aria-hidden="true" />
          <h3 className="text-sm font-medium text-gray-600">Token Balance</h3>
        </div>
      )}

      {/* Balance content */}
      <div className={compact ? '' : ''}>
        {/* Loading state */}
        {isLoading && !balanceState.lastUpdated && <BalanceSkeleton />}

        {/* Error state */}
        {balanceState.error && !isLoading && (
          <ErrorState error={balanceState.error} onRetry={refresh} isRetrying={isRefreshing} />
        )}

        {/* Balance display */}
        {!isLoading && !balanceState.error && balanceState.lastUpdated && (
          <>
            {isZeroBalance ? (
              <ZeroBalance
                symbol={metadata.symbol}
                isRefreshing={isRefreshing}
                onRefresh={refresh}
              />
            ) : (
              <BalanceDisplay
                formattedBalance={formattedBalance}
                symbol={metadata.symbol}
                isRefreshing={isRefreshing}
                onRefresh={refresh}
              />
            )}
          </>
        )}
      </div>

      {/* Burn Donation Link */}
      {showBurnLink && !compact && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <Link
            to="/burn-donation"
            onClick={handleBurnLinkClick}
            className="
              inline-flex items-center gap-1.5
              text-sm text-orange-600 hover:text-orange-800
              font-medium
              focus:outline-none focus:underline
              transition-colors duration-150
            "
          >
            <Flame className="h-4 w-4" aria-hidden="true" />
            Burn Donation
          </Link>
        </div>
      )}

      {/* Compact burn link */}
      {showBurnLink && compact && (
        <Link
          to="/burn-donation"
          onClick={handleBurnLinkClick}
          className="
            inline-flex items-center gap-1
            text-sm text-orange-600 hover:text-orange-800
            font-medium
            focus:outline-none focus:underline
            transition-colors duration-150
          "
          title="Donate tokens to burn pool"
        >
          <Flame className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Burn Donation</span>
        </Link>
      )}
    </div>
  );
}

export default TokenBalance;
