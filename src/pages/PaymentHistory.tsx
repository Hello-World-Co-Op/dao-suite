import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Principal } from '@dfinity/principal';
import {
  useTreasuryService,
  type PaymentRecord,
  type PaymentType,
  type PaymentStatus,
} from '../hooks/useTreasuryService';
import { trackEvent, trackPageView } from '../utils/analytics';

const ITEMS_PER_PAGE = 10;

type DateRangeType = 'all' | 'last30' | 'lastYear' | 'custom';

// Helper to format payment type
function getPaymentTypeName(type: PaymentType): string {
  if ('Initial' in type) return 'Initial';
  if ('Renewal' in type) return 'Renewal';
  return 'Unknown';
}

// Helper to format payment status
function getPaymentStatusName(status: PaymentStatus): string {
  if ('Succeeded' in status) return 'Succeeded';
  if ('Failed' in status) return 'Failed';
  if ('Pending' in status) return 'Pending';
  return 'Unknown';
}

// Helper to format amount (cents to dollars)
function formatAmount(cents: bigint): string {
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

// Helper to format timestamp (nanoseconds to readable date)
function formatDate(nanoseconds: bigint): string {
  const milliseconds = Number(nanoseconds / 1000000n);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(milliseconds));
}

export default function PaymentHistory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const treasuryService = useTreasuryService();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [totalCount, setTotalCount] = useState<bigint>(0n);
  const [currentPage, setCurrentPage] = useState(1);
  const [userPrincipal, setUserPrincipal] = useState<Principal | null>(null);

  // Filter state
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'initial' | 'renewal'>(
    (searchParams.get('type') as 'all' | 'initial' | 'renewal') || 'all'
  );
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>(
    (searchParams.get('dateRange') as DateRangeType) || 'all'
  );
  const [customStartDate, setCustomStartDate] = useState<string>(
    searchParams.get('startDate') || ''
  );
  const [customEndDate, setCustomEndDate] = useState<string>(searchParams.get('endDate') || '');

  // Export state
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    // Track page view
    trackPageView('Payment History');
    trackEvent('payment_history_page_view', {
      timestamp: new Date().toISOString(),
    });

    // Load payment history (auth gating is handled by ProtectedRoute in App.tsx)
    const init = async () => {
      try {
        // For email/password authentication, we use the anonymous principal
        // The backend will identify the user by their session
        // TODO: Once we integrate II or other IC auth, use the authenticated principal
        const principal = Principal.anonymous();
        setUserPrincipal(principal);

        // Load payment data
        await loadPayments(principal, currentPage);
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to load payment history. Please try again.');
        setLoading(false);

        trackEvent('payment_history_init_error', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPayments/currentPage intentionally excluded; runs once on mount with initial page
  }, []);

  const loadPayments = async (principal: Principal, page: number) => {
    try {
      setLoading(true);
      setError(null);

      const offset = (page - 1) * ITEMS_PER_PAGE;

      // Prepare payment type filter
      let paymentTypeParam: PaymentType | undefined;
      if (paymentTypeFilter === 'initial') {
        paymentTypeParam = { Initial: null };
      } else if (paymentTypeFilter === 'renewal') {
        paymentTypeParam = { Renewal: null };
      }

      // Calculate date range in nanoseconds
      let startDate: bigint | undefined;
      let endDate: bigint | undefined;

      const now = new Date();
      if (dateRangeType === 'last30') {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        startDate = BigInt(thirtyDaysAgo.getTime()) * 1000000n;
        endDate = BigInt(now.getTime()) * 1000000n;
      } else if (dateRangeType === 'lastYear') {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        startDate = BigInt(oneYearAgo.getTime()) * 1000000n;
        endDate = BigInt(now.getTime()) * 1000000n;
      } else if (dateRangeType === 'custom' && customStartDate && customEndDate) {
        startDate = BigInt(new Date(customStartDate).getTime()) * 1000000n;
        endDate = BigInt(new Date(customEndDate).getTime()) * 1000000n;
      }

      // Fetch payment history and total count in parallel
      const [paymentRecords, count] = await Promise.all([
        treasuryService.getPaymentHistory(
          principal,
          ITEMS_PER_PAGE,
          offset,
          paymentTypeParam,
          startDate,
          endDate
        ),
        treasuryService.getPaymentCount(principal, paymentTypeParam, startDate, endDate),
      ]);

      setPayments(paymentRecords);
      setTotalCount(count);
      setLoading(false);

      // Track successful load
      trackEvent('payment_history_loaded', {
        count: paymentRecords.length,
        total_count: Number(count),
        page,
        payment_type_filter: paymentTypeFilter,
        date_range_type: dateRangeType,
      });
    } catch (err) {
      console.error('Failed to load payment history:', err);
      setError('Failed to load payment history. Please try again later.');
      setLoading(false);

      trackEvent('payment_history_load_error', {
        error: err instanceof Error ? err.message : 'Unknown error',
        page,
      });
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (!userPrincipal) return;

    setCurrentPage(newPage);
    await loadPayments(userPrincipal, newPage);

    // Track pagination
    trackEvent('payment_history_pagination', {
      page: newPage,
    });
  };

  const handleExportCSV = async () => {
    if (!userPrincipal) return;

    // Warn for large exports
    if (totalCount > 100) {
      const confirmExport = window.confirm(
        `You are about to export ${totalCount} payment records. This may take a moment. Continue?`
      );
      if (!confirmExport) {
        return;
      }
    }

    try {
      setExporting(true);

      // Prepare payment type filter
      let paymentTypeParam: PaymentType | undefined;
      if (paymentTypeFilter === 'initial') {
        paymentTypeParam = { Initial: null };
      } else if (paymentTypeFilter === 'renewal') {
        paymentTypeParam = { Renewal: null };
      }

      // Calculate date range in nanoseconds
      let startDate: bigint | undefined;
      let endDate: bigint | undefined;

      const now = new Date();
      if (dateRangeType === 'last30') {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        startDate = BigInt(thirtyDaysAgo.getTime()) * 1000000n;
        endDate = BigInt(now.getTime()) * 1000000n;
      } else if (dateRangeType === 'lastYear') {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        startDate = BigInt(oneYearAgo.getTime()) * 1000000n;
        endDate = BigInt(now.getTime()) * 1000000n;
      } else if (dateRangeType === 'custom' && customStartDate && customEndDate) {
        startDate = BigInt(new Date(customStartDate).getTime()) * 1000000n;
        endDate = BigInt(new Date(customEndDate).getTime()) * 1000000n;
      }

      // Fetch ALL payments (no pagination) with filters
      const allPayments = await treasuryService.getPaymentHistory(
        userPrincipal,
        10000, // Large limit to get all payments
        0,
        paymentTypeParam,
        startDate,
        endDate
      );

      // Generate CSV
      const csvHeader = 'Date,Amount,Type,Status,Payment ID,Receipt Number\n';
      const csvRows = allPayments
        .map((payment) => {
          const date = formatDate(payment.timestamp);
          const amount = formatAmount(payment.amount);
          const type = getPaymentTypeName(payment.payment_type);
          const status = getPaymentStatusName(payment.status);
          const paymentId = payment.stripe_payment_intent_id;
          const receiptNumber =
            payment.receipt_number && payment.receipt_number.length > 0
              ? payment.receipt_number[0]
              : 'N/A';

          // Escape fields that might contain commas
          return `"${date}","${amount}","${type}","${status}","${paymentId}","${receiptNumber}"`;
        })
        .join('\n');

      const csvContent = csvHeader + csvRows;

      // Create blob and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const filename = `payment-history-${new Date().toISOString().split('T')[0]}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExporting(false);

      // Track export
      trackEvent('payment_history_exported', {
        count: allPayments.length,
        payment_type_filter: paymentTypeFilter,
        date_range_type: dateRangeType,
      });
    } catch (err) {
      console.error('Failed to export CSV:', err);
      setError('Failed to export payment history. Please try again.');
      setExporting(false);

      trackEvent('payment_history_export_error', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleRetryPayment = (payment: PaymentRecord) => {
    // Track retry attempt
    trackEvent('payment_retry_clicked', {
      payment_id: payment.stripe_payment_intent_id,
      payment_type: getPaymentTypeName(payment.payment_type),
      amount: Number(payment.amount),
    });

    // Redirect to renewal page
    navigate('/membership/renewal');
  };

  const totalPages = Math.ceil(Number(totalCount) / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Payment History</h1>
              <p className="mt-2 text-sm text-gray-600">
                View your complete membership payment history and download receipts.
              </p>
            </div>
            {!loading && payments.length > 0 && (
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg
                      className="-ml-1 mr-2 h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Export CSV
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {!loading && !error && payments.length > 0 && (
          <div className="mb-6 bg-white shadow sm:rounded-lg p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Payment Type Filter */}
              <div>
                <label
                  htmlFor="payment-type-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Payment Type
                </label>
                <select
                  id="payment-type-filter"
                  value={paymentTypeFilter}
                  onChange={(e) => {
                    setPaymentTypeFilter(e.target.value as 'all' | 'initial' | 'renewal');
                    setCurrentPage(1); // Reset to first page when filter changes

                    // Update URL params
                    const newParams = new URLSearchParams(searchParams);
                    if (e.target.value === 'all') {
                      newParams.delete('type');
                    } else {
                      newParams.set('type', e.target.value);
                    }
                    setSearchParams(newParams);
                  }}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="all">All Types</option>
                  <option value="initial">Initial</option>
                  <option value="renewal">Renewal</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label
                  htmlFor="date-range-filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Date Range
                </label>
                <select
                  id="date-range-filter"
                  value={dateRangeType}
                  onChange={(e) => {
                    setDateRangeType(e.target.value as DateRangeType);
                    setCurrentPage(1); // Reset to first page when filter changes

                    // Update URL params
                    const newParams = new URLSearchParams(searchParams);
                    newParams.set('dateRange', e.target.value);
                    if (e.target.value !== 'custom') {
                      newParams.delete('startDate');
                      newParams.delete('endDate');
                    }
                    setSearchParams(newParams);
                  }}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value="all">All Time</option>
                  <option value="last30">Last 30 Days</option>
                  <option value="lastYear">Last Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Custom Date Range Inputs */}
              {dateRangeType === 'custom' && (
                <>
                  <div>
                    <label
                      htmlFor="start-date"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="start-date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setCurrentPage(1);

                        // Update URL params
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('startDate', e.target.value);
                        setSearchParams(newParams);
                      }}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="end-date"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      End Date
                    </label>
                    <input
                      type="date"
                      id="end-date"
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        setCurrentPage(1);

                        // Update URL params
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('endDate', e.target.value);
                        setSearchParams(newParams);
                      }}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading payment history...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && payments.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No payment history yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your payment history will appear here after you make your first payment.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => navigate('/membership')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Go to Membership
              </button>
            </div>
          </div>
        )}

        {/* Payment History Table */}
        {!loading && !error && payments.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Amount
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Receipt
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id.toString()}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {formatAmount(payment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getPaymentTypeName(payment.payment_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            'Succeeded' in payment.status
                              ? 'bg-green-100 text-green-800'
                              : 'Failed' in payment.status
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {getPaymentStatusName(payment.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600">
                        {payment.receipt_number && payment.receipt_number.length > 0 ? (
                          <a
                            href={payment.receipt_number[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-indigo-900"
                          >
                            View Receipt
                          </a>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {'Failed' in payment.status && 'Renewal' in payment.payment_type ? (
                          <button
                            onClick={() => handleRetryPayment(payment)}
                            className="text-indigo-600 hover:text-indigo-900 font-medium"
                          >
                            Retry Payment
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden">
              <ul className="divide-y divide-gray-200">
                {payments.map((payment) => (
                  <li key={payment.id.toString()} className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {formatAmount(payment.amount)}
                          </p>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              'Succeeded' in payment.status
                                ? 'bg-green-100 text-green-800'
                                : 'Failed' in payment.status
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {getPaymentStatusName(payment.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-sm text-gray-500">{formatDate(payment.timestamp)}</p>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getPaymentTypeName(payment.payment_type)}
                          </span>
                        </div>
                        {payment.receipt_number && payment.receipt_number.length > 0 && (
                          <div className="mt-2">
                            <a
                              href={payment.receipt_number[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-indigo-600 hover:text-indigo-900"
                            >
                              View Receipt
                            </a>
                          </div>
                        )}
                        {'Failed' in payment.status && 'Renewal' in payment.payment_type && (
                          <div className="mt-2">
                            <button
                              onClick={() => handleRetryPayment(payment)}
                              className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
                            >
                              Retry Payment
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>{' '}
                      to{' '}
                      <span className="font-medium">
                        {Math.min(currentPage * ITEMS_PER_PAGE, Number(totalCount))}
                      </span>{' '}
                      of <span className="font-medium">{Number(totalCount)}</span> results
                    </p>
                  </div>
                  <div>
                    <nav
                      className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                      aria-label="Pagination"
                    >
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <svg
                          className="h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>

                      {/* Page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === currentPage
                              ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <svg
                          className="h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
