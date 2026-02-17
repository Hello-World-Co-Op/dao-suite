/**
 * Unit tests for PaymentHistory component
 * Tests loading, display, filtering, pagination, CSV export, and error handling
 *
 * Story: BL-030.1 — Migrate to useAuth() context
 * AC: 2, 8
 *
 * Auth gating is handled by ProtectedRoute in App.tsx.
 * This component no longer reads from localStorage for auth state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PaymentHistory from './PaymentHistory';
import { Principal } from '@dfinity/principal';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock useAuth from @hello-world-co-op/auth (BL-030.1)
vi.mock('@hello-world-co-op/auth', () => ({
  useAuth: () => ({
    user: { userId: 'test-user-id', email: 'test@example.com', providers: ['EmailPassword'] },
    isAuthenticated: true,
    isLoading: false,
    displayName: 'Test User',
    icPrincipal: null,
    membershipStatus: null,
    refresh: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    roles: [],
    hasRole: vi.fn(() => false),
    isAdmin: false,
    error: null,
    isBypassed: false,
  }),
}));

// Mock analytics
vi.mock('../utils/analytics', () => ({
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

// Mock payment records
const mockPaymentRecords = [
  {
    id: 1n,
    user_id: Principal.fromText('aaaaa-aa'),
    amount: 2500n,
    currency: 'USD',
    payment_type: { Initial: null },
    status: { Succeeded: null },
    stripe_payment_intent_id: 'pi_test_1',
    receipt_number: ['https://stripe.com/receipt1'],
    payment_method_last4: '4242',
    timestamp: BigInt(Date.now()) * 1000000n,
  },
  {
    id: 2n,
    user_id: Principal.fromText('aaaaa-aa'),
    amount: 2500n,
    currency: 'USD',
    payment_type: { Renewal: null },
    status: { Succeeded: null },
    stripe_payment_intent_id: 'pi_test_2',
    receipt_number: ['https://stripe.com/receipt2'],
    payment_method_last4: '4242',
    timestamp: BigInt(Date.now() - 86400000) * 1000000n, // 1 day ago
  },
  {
    id: 3n,
    user_id: Principal.fromText('aaaaa-aa'),
    amount: 2500n,
    currency: 'USD',
    payment_type: { Renewal: null },
    status: { Failed: null },
    stripe_payment_intent_id: 'pi_test_3',
    receipt_number: [],
    payment_method_last4: '4242',
    timestamp: BigInt(Date.now() - 172800000) * 1000000n, // 2 days ago
  },
];

// Mock treasury service
const mockGetPaymentHistory = vi.fn();
const mockGetPaymentCount = vi.fn();

vi.mock('../hooks/useTreasuryService', () => ({
  useTreasuryService: () => ({
    getPaymentHistory: mockGetPaymentHistory,
    getPaymentCount: mockGetPaymentCount,
  }),
}));

describe('PaymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Auth gating is handled by ProtectedRoute — no localStorage setup needed (BL-030.1)

    // Default mock implementations
    mockGetPaymentHistory.mockResolvedValue(mockPaymentRecords);
    mockGetPaymentCount.mockResolvedValue(3n);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderPaymentHistory = () => {
    return render(
      <BrowserRouter>
        <PaymentHistory />
      </BrowserRouter>
    );
  };

  // Auth redirect test removed — auth gating is handled by ProtectedRoute in App.tsx (BL-030.1)

  describe('Data Loading', () => {
    it('should load payment history on mount', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        expect(mockGetPaymentHistory).toHaveBeenCalled();
        expect(mockGetPaymentCount).toHaveBeenCalled();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      renderPaymentHistory();

      expect(screen.getByText(/Loading payment history.../i)).toBeInTheDocument();
    });

    it('should hide loading spinner after data loads', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        expect(screen.queryByText(/Loading payment history.../i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Payment Display', () => {
    it('should display payment records in table', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        // Check that payment data is displayed (amounts are always present)
        const amounts = screen.getAllByText('$25.00');
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('should display payment amounts correctly', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        const amounts = screen.getAllByText('$25.00');
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('should display payment types correctly', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        const initialElements = screen.getAllByText('Initial');
        expect(initialElements.length).toBeGreaterThanOrEqual(1);
        const renewalElements = screen.getAllByText('Renewal');
        expect(renewalElements.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should display payment status with correct styling', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        const succeededElements = screen.getAllByText('Succeeded');
        expect(succeededElements.length).toBeGreaterThan(0);

        const failedElements = screen.getAllByText('Failed');
        expect(failedElements.length).toBeGreaterThan(0);
        expect(failedElements[0].className).toContain('red');
      });
    });

    it('should show retry button for failed renewal payments', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        const retryButtons = screen.getAllByText('Retry Payment');
        // 2 buttons: one for desktop, one for mobile
        expect(retryButtons.length).toBe(2);
      });
    });

    it('should navigate to renewal page when retry button clicked', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        const retryButtons = screen.getAllByText('Retry Payment');
        fireEvent.click(retryButtons[0]);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/membership/renewal');
    });
  });

  describe('Receipt Links', () => {
    it('should show receipt links for payments with receipts', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        const receiptLinks = screen.getAllByText('View Receipt');
        // 4 links: 2 payments × 2 views (desktop + mobile)
        expect(receiptLinks.length).toBe(4);
      });
    });

    it('should show N/A for payments without receipts', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        const naElements = screen.getAllByText('N/A');
        expect(naElements.length).toBeGreaterThan(0);
      });
    });

    it('should open receipt links in new tab', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        const receiptLink = screen.getAllByText('View Receipt')[0];
        const anchor = receiptLink.closest('a');

        expect(anchor).toHaveAttribute('target', '_blank');
        expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
        expect(anchor).toHaveAttribute('href', 'https://stripe.com/receipt1');
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no payments exist', async () => {
      mockGetPaymentHistory.mockResolvedValue([]);
      mockGetPaymentCount.mockResolvedValue(0n);

      renderPaymentHistory();

      await waitFor(() => {
        expect(screen.getByText(/No payment history yet/i)).toBeInTheDocument();
        expect(
          screen.getByText(
            /Your payment history will appear here after you make your first payment/i
          )
        ).toBeInTheDocument();
      });
    });

    it('should show go to membership button in empty state', async () => {
      mockGetPaymentHistory.mockResolvedValue([]);
      mockGetPaymentCount.mockResolvedValue(0n);

      renderPaymentHistory();

      await waitFor(() => {
        const button = screen.getByText('Go to Membership');
        expect(button).toBeInTheDocument();

        fireEvent.click(button);
        expect(mockNavigate).toHaveBeenCalledWith('/membership');
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when load fails', async () => {
      mockGetPaymentHistory.mockRejectedValue(new Error('Network error'));

      renderPaymentHistory();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load payment history/i)).toBeInTheDocument();
      });
    });

    it('should not show table when error occurs', async () => {
      mockGetPaymentHistory.mockRejectedValue(new Error('Network error'));

      renderPaymentHistory();

      await waitFor(() => {
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      });
    });
  });

  describe('CSV Export', () => {
    it('should show export button when payments exist', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });
    });

    it('should not show export button when no payments exist', async () => {
      mockGetPaymentHistory.mockResolvedValue([]);
      mockGetPaymentCount.mockResolvedValue(0n);

      renderPaymentHistory();

      await waitFor(() => {
        expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
      });
    });

    it('should show loading state during export', async () => {
      // Mock a slow export
      mockGetPaymentHistory.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockPaymentRecords), 100))
      );

      renderPaymentHistory();

      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export CSV');
      fireEvent.click(exportButton);

      // Button should show "Exporting..." during the operation
      await waitFor(() => {
        expect(screen.getByText('Exporting...')).toBeInTheDocument();
      });
    });

    it('should create download link when export button clicked', async () => {
      // Mock URL.createObjectURL
      const mockObjectURL = 'blob:mock-url';
      global.URL.createObjectURL = vi.fn(() => mockObjectURL);

      // Mock document.createElement to intercept link creation
      const mockClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      document.createElement = vi.fn(
        <K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K] => {
          const element = originalCreateElement(tagName);
          if (tagName === 'a') {
            (element as HTMLAnchorElement).click = mockClick;
          }
          return element;
        }
      ) as Document['createElement'];

      renderPaymentHistory();

      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export CSV');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockGetPaymentHistory).toHaveBeenCalledWith(
          expect.anything(),
          10000, // Large limit to get all payments
          0,
          undefined,
          undefined,
          undefined
        );
      });

      // Cleanup
      document.createElement = originalCreateElement;
    });
  });

  describe('Pagination', () => {
    it('should show pagination when multiple pages exist', async () => {
      mockGetPaymentCount.mockResolvedValue(25n); // More than 10 items per page

      renderPaymentHistory();

      await waitFor(() => {
        const prevButtons = screen.getAllByText('Previous');
        expect(prevButtons.length).toBeGreaterThan(0);
        const nextButtons = screen.getAllByText('Next');
        expect(nextButtons.length).toBeGreaterThan(0);
      });
    });

    it('should disable previous button on first page', async () => {
      mockGetPaymentCount.mockResolvedValue(25n);

      renderPaymentHistory();

      await waitFor(() => {
        const prevButtons = screen.getAllByText('Previous');
        expect(prevButtons[0]).toBeDisabled();
      });
    });

    it('should call getPaymentHistory with correct offset when page changes', async () => {
      mockGetPaymentCount.mockResolvedValue(25n);

      renderPaymentHistory();

      await waitFor(() => {
        const nextButtons = screen.getAllByText('Next');
        expect(nextButtons.length).toBeGreaterThan(0);
      });

      const nextButtons = screen.getAllByText('Next');
      fireEvent.click(nextButtons[0]);

      await waitFor(() => {
        expect(mockGetPaymentHistory).toHaveBeenCalledWith(
          expect.anything(),
          10, // limit
          10, // offset for page 2
          undefined,
          undefined,
          undefined
        );
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render both desktop and mobile views', async () => {
      renderPaymentHistory();

      await waitFor(() => {
        // Desktop table (hidden on mobile)
        const desktopTable = document.querySelector('.hidden.sm\\:block');
        expect(desktopTable).toBeInTheDocument();

        // Mobile cards (hidden on desktop)
        const mobileCards = document.querySelector('.sm\\:hidden');
        expect(mobileCards).toBeInTheDocument();
      });
    });
  });
});
