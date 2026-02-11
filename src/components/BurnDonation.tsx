/**
 * Burn Donation Component
 *
 * Allows verified DAO members to donate DOM tokens to the burn pool.
 * Standard burns only (1:1) - users cannot select ecological burn type.
 * Burn history stored in localStorage (on-chain history is global only).
 *
 * Story: 9-2-3-burn-donation
 * ACs: 1, 2, 3, 4, 5
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  RefreshCw,
  Flame,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  Clock,
} from 'lucide-react';
import {
  $tokenBalance,
  $formattedTotalBurned,
  $formattedUserTotalBurned,
  $burnCount,
  $burnHistory,
  $isBurnPending,
  $isBurnSuccess,
  $burnExecutionError,
  formatTokenAmount,
  parseTokenAmount,
  validateBurnAmount,
  getMaxBurnAmount,
  exportBurnHistoryCSV,
  resetBurnExecution,
  TOKEN_DECIMALS,
  MIN_BURN_AMOUNT,
  type LocalBurnRecord,
} from '@/stores';
import { useBurnDonation } from '../services/burnService';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Loading Skeleton
// ============================================================================

function BurnSkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-6">
      {/* Burn pool skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-10 w-48 bg-gray-200 rounded" />
      </div>

      {/* Input skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-12 w-full bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
      </div>

      {/* Button skeleton */}
      <div className="h-12 w-full bg-gray-200 rounded" />
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
      <p className="text-red-600 font-medium mb-2">Failed to load burn data</p>
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
          href="mailto:support@helloworlddao.com?subject=Burn%20Donation%20Issue"
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
// Success Modal
// ============================================================================

interface SuccessModalProps {
  txIndex: string | null;
  amount: string;
  onClose: () => void;
}

function SuccessModal({ txIndex, amount, onClose }: SuccessModalProps): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Burn Successful!</h3>
          <p className="text-gray-600 mb-4">
            You have successfully burned <strong>{amount} DOM</strong> tokens.
          </p>
          {txIndex && (
            <p className="text-sm text-gray-500 mb-4">
              Transaction Index: <code className="bg-gray-100 px-2 py-0.5 rounded">{txIndex}</code>
            </p>
          )}
          <p className="text-sm text-gray-500 mb-6">
            Thank you for contributing to the DAO's deflationary tokenomics!
          </p>
          <button
            onClick={onClose}
            className="
              w-full px-4 py-2.5
              text-sm font-medium text-white
              bg-teal-600 hover:bg-teal-700
              rounded-md
              focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
              transition-colors duration-150
            "
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Confirmation Modal
// ============================================================================

interface ConfirmationModalProps {
  amount: string;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

function ConfirmationModal({
  amount,
  onConfirm,
  onCancel,
  isExecuting,
}: ConfirmationModalProps): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Token Burn</h3>
            <p className="text-gray-600 mb-4">
              You are about to permanently burn <strong>{amount} DOM</strong> tokens. This action
              cannot be undone.
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-4">
              <p className="text-sm text-orange-800">
                <strong>Warning:</strong> Burned tokens are permanently destroyed and cannot be
                recovered.
              </p>
            </div>
            {isExecuting && (
              <div className="flex items-center gap-2 text-gray-500 mb-4">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Processing... (2-5 seconds)</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            disabled={isExecuting}
            className="
              flex-1 px-4 py-2.5
              text-sm font-medium text-gray-700
              bg-gray-100 hover:bg-gray-200
              rounded-md
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
              transition-colors duration-150
            "
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isExecuting}
            className="
              flex-1 px-4 py-2.5
              text-sm font-medium text-white
              bg-orange-600 hover:bg-orange-700
              rounded-md
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
              transition-colors duration-150
            "
          >
            {isExecuting ? 'Burning...' : 'Confirm Burn'}
          </button>
        </div>
      </div>
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
          <span>What is token burning?</span>
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
            <strong>Token burning</strong> is the process of permanently removing tokens from
            circulation. When you burn DOM tokens, they are destroyed and can never be used again.
          </p>
          <p>
            <strong>Why burn tokens?</strong> Burning creates deflationary pressure on the token
            supply. With fewer tokens in circulation, the remaining tokens may become more valuable
            over time (supply and demand).
          </p>
          <p>
            <strong>Standard vs Ecological Burns:</strong> Standard burns (what you can do here)
            destroy tokens 1:1. Ecological burns are special 5:1 boosted burns only available
            through ecosystem activities like Otter Camp quests and Marketplace purchases.
          </p>
          <p>
            <strong>Is burning reversible?</strong> No. Once tokens are burned, they are gone
            forever. Please be certain before confirming any burn transaction.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Burn History Item
// ============================================================================

interface BurnHistoryItemProps {
  record: LocalBurnRecord;
}

function BurnHistoryItem({ record }: BurnHistoryItemProps): React.ReactElement {
  const formattedAmount = formatTokenAmount(record.amount, TOKEN_DECIMALS);
  const formattedDate = new Date(record.timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const statusColors: Record<LocalBurnRecord['status'], string> = {
    pending: 'text-yellow-600 bg-yellow-100',
    confirmed: 'text-green-600 bg-green-100',
    failed: 'text-red-600 bg-red-100',
  };

  const statusLabels: Record<LocalBurnRecord['status'], string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    failed: 'Failed',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
          <Flame className="h-4 w-4 text-orange-600" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{formattedAmount} DOM</p>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {formattedDate}
          </div>
        </div>
      </div>
      <div className="text-right">
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[record.status]}`}
        >
          {statusLabels[record.status]}
        </span>
        {record.txIndex && <p className="text-xs text-gray-400 mt-1">TX: {record.txIndex}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// Burn History
// ============================================================================

interface BurnHistoryProps {
  records: LocalBurnRecord[];
  onExport: () => void;
}

function BurnHistory({ records, onExport }: BurnHistoryProps): React.ReactElement {
  if (records.length === 0) {
    return (
      <div className="py-6 text-center">
        <Flame className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No burns yet - be the first!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700">Your Burn History</h4>
        <button
          onClick={onExport}
          className="
            inline-flex items-center gap-1.5
            text-sm text-teal-600 hover:text-teal-800
            font-medium
            focus:outline-none focus:underline
            transition-colors duration-150
          "
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>
      <div className="text-xs text-gray-400 mb-3">Note: History stored locally in your browser</div>
      <div className="max-h-64 overflow-y-auto">
        {records.slice(0, 20).map((record) => (
          <BurnHistoryItem key={record.id} record={record} />
        ))}
      </div>
      {records.length > 20 && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          Showing 20 of {records.length} burns
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface BurnDonationProps {
  /** Optional className for container */
  className?: string;
}

export function BurnDonation({ className = '' }: BurnDonationProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [lastBurnAmount, setLastBurnAmount] = useState<string>('');

  // Store values
  const tokenBalance = useStore($tokenBalance);
  const formattedTotalBurned = useStore($formattedTotalBurned);
  const formattedUserTotalBurned = useStore($formattedUserTotalBurned);
  const burnCount = useStore($burnCount);
  const burnHistory = useStore($burnHistory);
  const isBurnPending = useStore($isBurnPending);
  const isBurnSuccess = useStore($isBurnSuccess);
  const burnExecutionError = useStore($burnExecutionError);

  // Service hook
  const {
    poolState,
    executionState,
    isLoading,
    isRefreshing,
    executeBurn,
    refresh,
    resetExecution,
  } = useBurnDonation({
    autoFetch: true,
    refetchIfStale: true,
  });

  // User balance
  const userBalance = tokenBalance.balance;
  const formattedUserBalance = formatTokenAmount(userBalance, TOKEN_DECIMALS);
  const maxBurnAmount = getMaxBurnAmount(userBalance);
  const formattedMaxBurn = formatTokenAmount(maxBurnAmount, TOKEN_DECIMALS);

  // Parse input amount
  const parsedAmount = useMemo(() => {
    if (!inputValue || inputValue.trim() === '') return BigInt(0);
    try {
      return parseTokenAmount(inputValue, TOKEN_DECIMALS);
    } catch {
      return BigInt(0);
    }
  }, [inputValue]);

  // Validate input on change
  useEffect(() => {
    if (!inputValue || inputValue.trim() === '') {
      setInputError(null);
      return;
    }

    // Check for valid number format
    const numericValue = inputValue.replace(/,/g, '');
    if (!/^\d*\.?\d{0,8}$/.test(numericValue)) {
      setInputError('Invalid number format (max 8 decimal places)');
      return;
    }

    // Validate amount
    const error = validateBurnAmount(parsedAmount, userBalance);
    setInputError(error);
  }, [inputValue, parsedAmount, userBalance]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty, digits, single decimal, and up to 8 decimal places
    if (value === '' || /^\d*\.?\d{0,8}$/.test(value)) {
      setInputValue(value);
    }
  };

  // Handle max button
  const handleMaxClick = () => {
    if (maxBurnAmount > BigInt(0)) {
      setInputValue(formatTokenAmount(maxBurnAmount, TOKEN_DECIMALS).replace(/,/g, ''));
    }
  };

  // Handle burn submit
  const handleBurnSubmit = () => {
    if (inputError || parsedAmount <= BigInt(0)) return;
    setLastBurnAmount(formatTokenAmount(parsedAmount, TOKEN_DECIMALS));
    setShowConfirmModal(true);
  };

  // Handle confirm burn
  const handleConfirmBurn = async () => {
    setShowConfirmModal(false);
    const result = await executeBurn(parsedAmount);
    if (result.success) {
      setInputValue('');
    }
  };

  // Handle cancel confirmation
  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
  };

  // Handle success modal close
  const handleSuccessClose = () => {
    resetExecution();
  };

  // Handle history export
  const handleExportHistory = () => {
    const csv = exportBurnHistoryCSV();
    if (!csv) return;

    // Track analytics
    trackEvent('burn_history_exported', { count: burnHistory.length });

    // Download file
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `burn-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle FAQ expand
  const handleFaqExpand = () => {
    trackEvent('burn_faq_expanded', {});
  };

  // Can submit
  const canSubmit = !inputError && parsedAmount > BigInt(0) && !isBurnPending;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-600" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-gray-900">Burn Donation</h3>
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
        {isLoading && !poolState.lastUpdated && <BurnSkeleton />}

        {/* Error state */}
        {poolState.error && !isLoading && (
          <ErrorState error={poolState.error} onRetry={refresh} isRetrying={isRefreshing} />
        )}

        {/* Main content */}
        {!isLoading && !poolState.error && (
          <div className="space-y-6">
            {/* Permanent warning banner */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <strong>Warning:</strong> Burns are permanent and cannot be undone. Burned tokens
                are destroyed forever.
              </div>
            </div>

            {/* Burn Pool Display (AC-2) */}
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Total Tokens Burned</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900 tabular-nums">
                  {formattedTotalBurned}
                </span>
                <span className="text-lg font-medium text-gray-500">DOM</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Community contributions to deflationary tokenomics
              </p>
            </div>

            {/* Your Total Burns (AC-5 power user UX) */}
            {burnCount > 0 && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Your Total Burns</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-semibold text-gray-900">{formattedUserTotalBurned}</span>
                    <span className="text-sm text-gray-500">DOM</span>
                    <span className="text-xs text-gray-400 ml-2">({burnCount} burns)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Input Section (AC-1) */}
            <div>
              <label htmlFor="burn-amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount to Burn
              </label>
              <div className="relative">
                <input
                  id="burn-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={inputValue}
                  onChange={handleInputChange}
                  disabled={isBurnPending}
                  className={`
                    w-full px-4 py-3 pr-20
                    text-lg font-medium text-gray-900
                    border rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors duration-150
                    ${
                      inputError
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-teal-500'
                    }
                  `}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-sm text-gray-500">DOM</span>
                  <button
                    onClick={handleMaxClick}
                    disabled={isBurnPending || maxBurnAmount <= BigInt(0)}
                    className="
                      text-xs font-medium text-teal-600 hover:text-teal-800
                      disabled:opacity-50 disabled:cursor-not-allowed
                      focus:outline-none focus:underline
                    "
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Balance display */}
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-gray-500">
                  Your balance: <span className="font-medium">{formattedUserBalance} DOM</span>
                </span>
                {maxBurnAmount > BigInt(0) && (
                  <span className="text-gray-400">Max: {formattedMaxBurn} DOM</span>
                )}
              </div>

              {/* Input error */}
              {inputError && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {inputError}
                </p>
              )}

              {/* Min amount hint */}
              {!inputError && parsedAmount > BigInt(0) && parsedAmount < MIN_BURN_AMOUNT && (
                <p className="mt-2 text-sm text-yellow-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Minimum burn is {formatTokenAmount(MIN_BURN_AMOUNT, TOKEN_DECIMALS)} DOM
                </p>
              )}
            </div>

            {/* Execution error display */}
            {burnExecutionError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800">{burnExecutionError}</p>
                  <button
                    onClick={() => resetBurnExecution()}
                    className="text-sm text-red-600 hover:text-red-800 underline mt-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleBurnSubmit}
              disabled={!canSubmit}
              className="
                w-full flex items-center justify-center gap-2
                px-4 py-3
                text-base font-medium text-white
                bg-orange-600 hover:bg-orange-700
                rounded-lg
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
                transition-colors duration-150
              "
            >
              {isBurnPending ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Burning...
                </>
              ) : (
                <>
                  <Flame className="h-5 w-5" />
                  Burn Tokens
                </>
              )}
            </button>

            {/* Info about standard burns (AC-3) */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-900 mb-1">About Standard Burns</h4>
              <p className="text-sm text-blue-800">
                Standard burns destroy tokens 1:1. Ecological burns (5:1 boost) are only available
                through ecosystem activities like Otter Camp quests and Marketplace purchases.
              </p>
              <a
                href="/otter-camp"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
              >
                <ExternalLink className="h-3 w-3" />
                Explore Otter Camp
              </a>
            </div>

            {/* Why Burn section */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Why Burn Tokens?
              </h4>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li>
                  • <strong>Deflationary pressure:</strong> Reduces total supply
                </li>
                <li>
                  • <strong>Support the DAO:</strong> Demonstrates long-term commitment
                </li>
                <li>
                  • <strong>Potential value:</strong> Fewer tokens may mean increased value
                </li>
                <li>
                  • <strong>Governance signal:</strong> Shows dedication to ecosystem health
                </li>
              </ul>
            </div>

            {/* FAQ Section */}
            <FAQSection onExpand={handleFaqExpand} />

            {/* Burn History (AC-5) */}
            <BurnHistory records={burnHistory} onExport={handleExportHistory} />
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmationModal
          amount={lastBurnAmount}
          onConfirm={handleConfirmBurn}
          onCancel={handleCancelConfirm}
          isExecuting={isBurnPending}
        />
      )}

      {/* Success Modal (AC-4) */}
      {isBurnSuccess && (
        <SuccessModal
          txIndex={executionState.lastTxIndex}
          amount={lastBurnAmount}
          onClose={handleSuccessClose}
        />
      )}
    </div>
  );
}

export default BurnDonation;
