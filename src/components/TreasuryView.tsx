/**
 * Treasury View Component
 *
 * Displays DAO treasury balance with breakdown by fund type and recent transactions.
 * Read-only view for verified DAO members to monitor treasury activity.
 *
 * Story: 9-2-2-treasury-view
 * ACs: 1, 2, 3, 4
 */

import React from 'react';
import { useStore } from '@nanostores/react';
import {
  RefreshCw,
  Wallet,
  AlertCircle,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Flame,
  Send,
  Unlock,
} from 'lucide-react';
import {
  $treasuryTransactions,
  $formattedDomBalance,
  $formattedIcpBalance,
  $domFundAllocations,
  $icpFundAllocations,
  $hasTreasuryData,
  formatTimestamp,
  getTransactionTypeLabel,
  getTransactionTypeColor,
  formatTokenAmount,
  TOKEN_DECIMALS,
  type Transaction,
  type FundAllocation,
} from '@/stores';
import { useTreasuryBalance } from '../services/treasuryService';

// ============================================================================
// Loading Skeleton
// ============================================================================

function TreasurySkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-4">
      {/* Total balance skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-8 w-48 bg-gray-200 rounded" />
      </div>

      {/* Fund breakdown skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-200 rounded-full" />
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Transactions skeleton */}
      <div className="space-y-2 pt-4">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center py-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-gray-200 rounded-full" />
              <div className="space-y-1">
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-3 w-16 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
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

function ErrorState({ error, onRetry, isRetrying }: ErrorStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-10 w-10 text-red-500 mb-3" aria-hidden="true" />
      <p className="text-red-600 font-medium mb-2">Failed to load treasury data</p>
      <p className="text-gray-500 text-sm mb-4">{error}</p>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="
          inline-flex items-center gap-2 px-4 py-2
          text-sm font-medium text-white
          bg-teal-600 hover:bg-teal-700
          rounded-md
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
          transition-colors duration-150
        "
      >
        <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
        {isRetrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  );
}

// ============================================================================
// Fund Allocation Bar
// ============================================================================

interface FundAllocationBarProps {
  allocations: FundAllocation[];
  tokenSymbol: string;
}

function FundAllocationBar({
  allocations,
  tokenSymbol,
}: FundAllocationBarProps): React.ReactElement {
  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex">
        {allocations.map((allocation, index) => (
          <div
            key={allocation.name}
            className={`h-full ${allocation.color} ${index > 0 ? 'border-l border-white' : ''}`}
            style={{ width: `${allocation.percentage}%` }}
            title={`${allocation.name}: ${allocation.percentage.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {allocations.map((allocation) => (
          <div key={allocation.name} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${allocation.color}`} />
            <span className="text-gray-600">
              {allocation.name}: {formatTokenAmount(allocation.amount, TOKEN_DECIMALS)}{' '}
              {tokenSymbol}
            </span>
            <span className="text-gray-400">({allocation.percentage.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Transaction Icon
// ============================================================================

interface TransactionIconProps {
  type: Transaction['type'];
}

function TransactionIcon({ type }: TransactionIconProps): React.ReactElement {
  const colorClass = getTransactionTypeColor(type);

  const icons: Record<Transaction['type'], React.ReactElement> = {
    deposit: <ArrowDownRight className={`h-4 w-4 ${colorClass}`} />,
    withdrawal: <ArrowUpRight className={`h-4 w-4 ${colorClass}`} />,
    transfer: <Send className={`h-4 w-4 ${colorClass}`} />,
    burn: <Flame className={`h-4 w-4 ${colorClass}`} />,
    payout: <TrendingUp className={`h-4 w-4 ${colorClass}`} />,
    escrow_release: <Unlock className={`h-4 w-4 ${colorClass}`} />,
  };

  return (
    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
      {icons[type]}
    </div>
  );
}

// ============================================================================
// Transaction List Item
// ============================================================================

interface TransactionItemProps {
  transaction: Transaction;
}

function TransactionItem({ transaction }: TransactionItemProps): React.ReactElement {
  const formattedAmount = formatTokenAmount(transaction.amount, TOKEN_DECIMALS);
  const formattedTime = formatTimestamp(transaction.timestamp);
  const typeLabel = getTransactionTypeLabel(transaction.type);
  const colorClass = getTransactionTypeColor(transaction.type);

  // Determine if this is an inflow or outflow for display
  const isInflow = transaction.type === 'deposit';
  const amountPrefix = isInflow ? '+' : '-';

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-3">
        <TransactionIcon type={transaction.type} />
        <div>
          <p className="font-medium text-gray-900">{typeLabel}</p>
          {transaction.description && (
            <p
              className="text-sm text-gray-500 truncate max-w-[200px]"
              title={transaction.description}
            >
              {transaction.description}
            </p>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {formattedTime}
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-semibold tabular-nums ${colorClass}`}>
          {amountPrefix}
          {formattedAmount} {transaction.tokenType}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Transaction List
// ============================================================================

interface TransactionListProps {
  transactions: Transaction[];
}

function TransactionList({ transactions }: TransactionListProps): React.ReactElement {
  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center">
        <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No recent transactions</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {transactions.map((tx) => (
        <TransactionItem key={tx.id} transaction={tx} />
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface TreasuryViewProps {
  /** Optional className for container */
  className?: string;
  /** Show DOM breakdown (default: true) */
  showDomBreakdown?: boolean;
  /** Show ICP breakdown (default: true) */
  showIcpBreakdown?: boolean;
  /** Show transactions (default: true) */
  showTransactions?: boolean;
  /** Compact mode for smaller display */
  compact?: boolean;
}

export function TreasuryView({
  className = '',
  showDomBreakdown = true,
  showIcpBreakdown = true,
  showTransactions = true,
  compact = false,
}: TreasuryViewProps): React.ReactElement {
  const transactions = useStore($treasuryTransactions);
  const formattedDomBalance = useStore($formattedDomBalance);
  const formattedIcpBalance = useStore($formattedIcpBalance);
  const domAllocations = useStore($domFundAllocations);
  const icpAllocations = useStore($icpFundAllocations);
  const hasTreasuryData = useStore($hasTreasuryData);

  const { isLoading, isRefreshing, refresh, state } = useTreasuryBalance({
    autoFetch: true,
    refetchIfStale: true,
  });

  // Container classes
  const containerClasses = compact
    ? `${className}`
    : `bg-white rounded-lg border border-gray-200 ${className}`;

  return (
    <div className={containerClasses}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-teal-600" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-gray-900">DAO Treasury</h3>
          </div>
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="
              p-1.5 rounded-full
              text-gray-400 hover:text-gray-600 hover:bg-gray-100
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
              transition-colors duration-150
            "
            aria-label={isRefreshing ? 'Refreshing treasury' : 'Refresh treasury'}
            title="Refresh treasury data"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      {/* Content */}
      <div className={compact ? '' : 'p-4'}>
        {/* Loading state */}
        {isLoading && !hasTreasuryData && <TreasurySkeleton />}

        {/* Error state */}
        {state.error && !isLoading && (
          <ErrorState error={state.error} onRetry={refresh} isRetrying={isRefreshing} />
        )}

        {/* Treasury data display */}
        {!isLoading && !state.error && hasTreasuryData && (
          <div className="space-y-6">
            {/* Total Balances */}
            <div className="grid grid-cols-2 gap-4">
              {/* DOM Balance */}
              <div>
                <p className="text-sm text-gray-500 mb-1">DOM Balance</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-gray-900 tabular-nums">
                    {formattedDomBalance}
                  </span>
                  <span className="text-sm font-medium text-gray-500">DOM</span>
                </div>
              </div>

              {/* ICP Balance */}
              <div>
                <p className="text-sm text-gray-500 mb-1">ICP Balance</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-gray-900 tabular-nums">
                    {formattedIcpBalance}
                  </span>
                  <span className="text-sm font-medium text-gray-500">ICP</span>
                </div>
              </div>
            </div>

            {/* DOM Fund Breakdown */}
            {showDomBreakdown && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">DOM Allocation</h4>
                <FundAllocationBar allocations={domAllocations} tokenSymbol="DOM" />
              </div>
            )}

            {/* ICP Fund Breakdown */}
            {showIcpBreakdown && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">ICP Allocation</h4>
                <FundAllocationBar allocations={icpAllocations} tokenSymbol="ICP" />
              </div>
            )}

            {/* Recent Transactions */}
            {showTransactions && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Transactions</h4>
                <TransactionList transactions={transactions} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TreasuryView;
