/**
 * Escrow View Component
 *
 * Displays user's escrows with status, milestones, and progress.
 * Read-only view for verified DAO members to track their escrow allocations.
 *
 * Story: 9-2-4-escrow-view
 * ACs: 1, 2, 3, 4
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  RefreshCw,
  Briefcase,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Target,
  Filter,
} from 'lucide-react';
import {
  formatTokenAmount,
  getMilestoneProgress,
  getRemainingAmount,
  formatEscrowAmount,
  formatEscrowDate,
  isExpiringSoon,
  getEscrowStatusColor,
  getMilestoneStatusColor,
  TOKEN_DECIMALS,
  type Escrow,
  type Milestone,
  type EscrowStatusFilter,
} from '@/stores';
import { useEscrowView } from '../services/escrowService';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Loading Skeleton
// ============================================================================

function EscrowSkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-6">
      {/* Summary skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-20 bg-gray-200 rounded-lg" />
        <div className="h-20 bg-gray-200 rounded-lg" />
      </div>

      {/* Filter skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-20 bg-gray-200 rounded-full" />
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg" />
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
      <p className="text-red-600 font-medium mb-2">Failed to load escrow data</p>
      <p className="text-gray-500 text-sm mb-4">{error}</p>
      <div className="flex gap-3">
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
        <a
          href="mailto:support@helloworlddao.com?subject=Escrow%20View%20Issue"
          className="
            inline-flex items-center gap-2 px-4 py-2
            text-sm font-medium text-gray-700
            bg-gray-100 hover:bg-gray-200
            rounded-md
            focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
            transition-colors duration-150
          "
        >
          <HelpCircle className="h-4 w-4" />
          Get Help
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Briefcase className="h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No escrows found</h3>
      <p className="text-gray-500 text-sm max-w-md">
        You don't have any escrows where you are the recipient. Escrows are created when the DAO
        allocates funds for projects, bounties, or other conditional payments.
      </p>
    </div>
  );
}

// ============================================================================
// Status Filter
// ============================================================================

interface StatusFilterProps {
  currentFilter: EscrowStatusFilter;
  counts: Record<EscrowStatusFilter, number>;
  onFilterChange: (filter: EscrowStatusFilter) => void;
}

function StatusFilter({
  currentFilter,
  counts,
  onFilterChange,
}: StatusFilterProps): React.ReactElement {
  const filters: EscrowStatusFilter[] = ['All', 'Active', 'Released', 'Cancelled', 'Expired'];

  const getFilterColor = (filter: EscrowStatusFilter, isActive: boolean): string => {
    if (isActive) {
      switch (filter) {
        case 'Active':
          return 'bg-green-600 text-white';
        case 'Released':
          return 'bg-blue-600 text-white';
        case 'Cancelled':
          return 'bg-gray-600 text-white';
        case 'Expired':
          return 'bg-red-600 text-white';
        default:
          return 'bg-teal-600 text-white';
      }
    }
    return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Filter className="h-5 w-5 text-gray-400 self-center" aria-hidden="true" />
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={() => onFilterChange(filter)}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5
            text-sm font-medium rounded-full
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500
            ${getFilterColor(filter, currentFilter === filter)}
          `}
        >
          {filter}
          {counts[filter] > 0 && (
            <span
              className={`
              text-xs px-1.5 py-0.5 rounded-full
              ${currentFilter === filter ? 'bg-white/20' : 'bg-gray-200'}
            `}
            >
              {counts[filter]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Milestone Progress Bar
// ============================================================================

interface MilestoneProgressBarProps {
  released: number;
  total: number;
  percentage: number;
}

function MilestoneProgressBar({
  released,
  total,
  percentage,
}: MilestoneProgressBarProps): React.ReactElement {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {released} of {total} milestones
        </span>
        <span>{percentage}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Milestone Item
// ============================================================================

interface MilestoneItemProps {
  milestone: Milestone;
  tokenType: 'ICP' | 'DOM';
}

function MilestoneItem({ milestone, tokenType }: MilestoneItemProps): React.ReactElement {
  const statusColor = getMilestoneStatusColor(milestone.status);
  const formattedAmount = formatEscrowAmount(milestone.amount, tokenType);

  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 truncate">{milestone.name}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
            {milestone.status}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5 truncate">{milestone.description}</p>
        {milestone.dispute_reason && (
          <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {milestone.dispute_reason}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Due: {formatEscrowDate(milestone.deadline)}
          </span>
          {milestone.released_at !== undefined && milestone.released_at > BigInt(0) && (
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-3 w-3" />
              Released: {formatEscrowDate(milestone.released_at)}
            </span>
          )}
        </div>
      </div>
      <div className="ml-4 text-right">
        <p className="font-medium text-gray-900">{formattedAmount}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Milestone List
// ============================================================================

interface MilestoneListProps {
  milestones: Milestone[];
  tokenType: 'ICP' | 'DOM';
}

function MilestoneList({ milestones, tokenType }: MilestoneListProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(true);

  if (milestones.length === 0) {
    return <div className="py-3 text-sm text-gray-500 italic">Simple escrow (no milestones)</div>;
  }

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="
          w-full flex items-center justify-between py-2
          text-sm font-medium text-gray-700
          hover:text-gray-900
          focus:outline-none
        "
      >
        <span className="flex items-center gap-2">
          <Target className="h-4 w-4" />
          Milestones ({milestones.length})
        </span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isExpanded && (
        <div className="mt-2 bg-gray-50 rounded-lg px-4 py-2">
          {milestones.map((milestone, index) => (
            <MilestoneItem key={index} milestone={milestone} tokenType={tokenType} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Escrow Card
// ============================================================================

interface EscrowCardProps {
  escrow: Escrow;
  onSelect?: (escrow: Escrow) => void;
}

function EscrowCard({ escrow, onSelect }: EscrowCardProps): React.ReactElement {
  const statusColor = getEscrowStatusColor(escrow.status);
  const progress = getMilestoneProgress(escrow);
  const remaining = getRemainingAmount(escrow);
  const expiringSoon = isExpiringSoon(escrow);

  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 p-4
        hover:border-teal-300 hover:shadow-sm
        transition-all duration-150
        ${onSelect ? 'cursor-pointer' : ''}
      `}
      onClick={onSelect ? () => onSelect(escrow) : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">#{escrow.id.toString()}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
              {escrow.status}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              {escrow.token_type}
            </span>
            {expiringSoon && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Expiring soon
              </span>
            )}
          </div>
          <p className="mt-1 font-medium text-gray-900">{escrow.conditions}</p>
        </div>
      </div>

      {/* Amount Summary (AC-4) */}
      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div>
          <p className="text-xs text-gray-500">Total Amount</p>
          <p className="font-semibold text-gray-900">
            {formatEscrowAmount(escrow.amount, escrow.token_type)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Released</p>
          <p className="font-semibold text-green-600">
            {formatEscrowAmount(escrow.released_amount, escrow.token_type)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Remaining</p>
          <p className="font-semibold text-gray-900">
            {formatEscrowAmount(remaining, escrow.token_type)}
          </p>
        </div>
      </div>

      {/* Milestone Progress (AC-3) */}
      <MilestoneProgressBar
        released={progress.released}
        total={progress.total}
        percentage={progress.percentage}
      />

      {/* Dates */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Created: {formatEscrowDate(escrow.created_at)}
        </span>
        {escrow.status === 'Active' && (
          <span
            className={`flex items-center gap-1 ${expiringSoon ? 'text-orange-600 font-medium' : ''}`}
          >
            <Clock className="h-3 w-3" />
            Expires: {formatEscrowDate(escrow.expiry)}
          </span>
        )}
      </div>

      {/* Milestones */}
      <MilestoneList milestones={escrow.milestones} tokenType={escrow.token_type} />
    </div>
  );
}

// ============================================================================
// FAQ Section
// ============================================================================

interface FAQSectionProps {
  onExpand: () => void;
}

function FAQSection({ onExpand }: FAQSectionProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (newState) {
      onExpand();
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={handleToggle}
        className="
          w-full flex items-center justify-between p-4
          text-left text-gray-900 font-medium
          hover:bg-gray-50
          focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500
          transition-colors duration-150
        "
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-gray-400" />
          <span>What is escrow?</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 text-sm text-gray-600">
          <p>
            <strong>Escrow</strong> is a financial arrangement where funds are held by the DAO
            treasury until specific conditions are met. This protects both parties in a transaction.
          </p>
          <p>
            <strong>How does it work?</strong> When you're assigned as a recipient for project work,
            bounties, or other payments, the DAO creates an escrow with conditions. Funds are
            released as you complete milestones or meet the specified conditions.
          </p>
          <p>
            <strong>Milestone escrows</strong> break the total payment into smaller chunks, released
            as you complete each phase. This provides regular payments while protecting the DAO.
          </p>
          <p>
            <strong>Escrow statuses:</strong>
          </p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>
              <span className="text-green-600 font-medium">Active</span> - Funds are held and
              awaiting release
            </li>
            <li>
              <span className="text-blue-600 font-medium">Released</span> - All funds have been
              transferred to you
            </li>
            <li>
              <span className="text-gray-600 font-medium">Cancelled</span> - Escrow was cancelled,
              funds returned to treasury
            </li>
            <li>
              <span className="text-red-600 font-medium">Expired</span> - Deadline passed without
              release, funds returned
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Summary Stats
// ============================================================================

interface SummaryStatsProps {
  activeCount: number;
  totalEscrowed: string;
  totalReleased: string;
}

function SummaryStats({
  activeCount,
  totalEscrowed,
  totalReleased,
}: SummaryStatsProps): React.ReactElement {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div className="bg-gradient-to-br from-teal-50 to-green-50 rounded-lg p-4">
        <p className="text-sm text-gray-600 mb-1">Active Escrows</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900">{activeCount}</span>
        </div>
      </div>
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
        <p className="text-sm text-gray-600 mb-1">Total Escrowed</p>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-gray-900">{totalEscrowed}</span>
          <span className="text-sm text-gray-500">DOM</span>
        </div>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 col-span-2 md:col-span-1">
        <p className="text-sm text-gray-600 mb-1">Total Released</p>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-green-600">{totalReleased}</span>
          <span className="text-sm text-gray-500">DOM</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface EscrowViewProps {
  /** Optional className for container */
  className?: string;
  /** User's principal ID for filtering escrows */
  userPrincipal?: string;
}

export function EscrowView({ className = '', userPrincipal }: EscrowViewProps): React.ReactElement {
  const {
    escrowState,
    filteredEscrows,
    statusCounts,
    statusFilter,
    isLoading,
    isRefreshing,
    refresh,
    selectEscrow,
    setFilter,
  } = useEscrowView({
    userPrincipal,
    autoFetch: true,
    refetchIfStale: true,
  });

  // Track when component loads
  const hasTrackedLoad = useRef(false);
  useEffect(() => {
    if (!hasTrackedLoad.current && escrowState.lastUpdated) {
      hasTrackedLoad.current = true;
      trackEvent('escrow_view_loaded', {
        escrow_count: escrowState.escrows.length,
        active_count: statusCounts.Active || 0,
      });
    }
  }, [escrowState.lastUpdated, escrowState.escrows.length, statusCounts.Active]);

  // Track filter changes
  const handleFilterChange = useCallback(
    (filter: EscrowStatusFilter) => {
      trackEvent('escrow_filter_changed', {
        filter_value: filter,
        result_count: filter === 'All' ? escrowState.escrows.length : statusCounts[filter] || 0,
      });
      setFilter(filter);
    },
    [escrowState.escrows.length, statusCounts, setFilter]
  );

  // Track escrow detail views
  const handleEscrowSelect = useCallback(
    (escrow: Escrow) => {
      trackEvent('escrow_details_viewed', {
        escrow_id: escrow.id.toString(),
        escrow_status: escrow.status,
        token_type: escrow.token_type,
      });
      selectEscrow(escrow);
    },
    [selectEscrow]
  );

  const handleFaqExpand = useCallback(() => {
    trackEvent('escrow_faq_expanded', {});
  }, []);

  // Calculate summary stats
  const activeCount = statusCounts.Active || 0;

  // Format totals - in real implementation, get from computed atoms
  const formattedTotalEscrowed = escrowState.escrows
    .filter((e) => e.status === 'Active')
    .reduce((sum, e) => sum + e.amount, BigInt(0));
  const formattedTotalReleased = escrowState.escrows.reduce(
    (sum, e) => sum + e.released_amount,
    BigInt(0)
  );

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-teal-600" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-gray-900">Escrow View</h3>
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
          aria-label={isRefreshing ? 'Refreshing' : 'Refresh'}
          title="Refresh data"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Loading state */}
        {isLoading && !escrowState.lastUpdated && <EscrowSkeleton />}

        {/* Error state */}
        {escrowState.error && !isLoading && (
          <ErrorState error={escrowState.error} onRetry={refresh} isRetrying={isRefreshing} />
        )}

        {/* Main content */}
        {!isLoading && !escrowState.error && (
          <div className="space-y-6">
            {/* Empty state */}
            {escrowState.escrows.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Summary Stats */}
                <SummaryStats
                  activeCount={activeCount}
                  totalEscrowed={formatTokenAmount(formattedTotalEscrowed, TOKEN_DECIMALS)}
                  totalReleased={formatTokenAmount(formattedTotalReleased, TOKEN_DECIMALS)}
                />

                {/* Status Filter (AC-2) */}
                <StatusFilter
                  currentFilter={statusFilter}
                  counts={statusCounts}
                  onFilterChange={handleFilterChange}
                />

                {/* Escrow List (AC-1) */}
                <div className="space-y-4">
                  {filteredEscrows.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No escrows match the selected filter
                    </div>
                  ) : (
                    filteredEscrows.map((escrow) => (
                      <EscrowCard
                        key={escrow.id.toString()}
                        escrow={escrow}
                        onSelect={handleEscrowSelect}
                      />
                    ))
                  )}
                </div>
              </>
            )}

            {/* FAQ Section */}
            <FAQSection onExpand={handleFaqExpand} />
          </div>
        )}
      </div>
    </div>
  );
}

export default EscrowView;
