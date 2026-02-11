import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Principal } from '@dfinity/principal';
import MembershipRenewal from './MembershipRenewal';

// Mock localStorage globally for this test file
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Create mock service functions
const mockCanRenew = vi.fn();
const mockVerifyMembership = vi.fn();
const mockIsFirstYearMember = vi.fn();
const mockGetProratedDividend = vi.fn();

// Mock the hooks
vi.mock('../hooks/useMembershipService', () => ({
  useMembershipService: () => ({
    canRenew: mockCanRenew,
    verifyMembership: mockVerifyMembership,
    isFirstYearMember: mockIsFirstYearMember,
    getProratedDividend: mockGetProratedDividend,
  }),
}));

// Mock analytics
vi.mock('../utils/analytics', () => ({
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

// Mock router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to render component with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('MembershipRenewal Component', () => {
  const mockPrincipal = Principal.fromText('rrkah-fqaaa-aaaaa-aaaaq-cai');

  const mockMembershipRecord = {
    token_id: BigInt(1),
    owner: {
      owner: mockPrincipal,
      subaccount: [],
    },
    metadata: {
      join_date: BigInt(Date.now() * 1000000),
      status: { Active: null },
      tos_accepted_at: BigInt(Date.now() * 1000000),
      expiration_date: BigInt(new Date(2025, 11, 31).getTime() * 1000000),
      is_active: true,
    },
  };

  // Helper to mock date to be in renewal window (December 15, 2025)
  // Uses fake timers with loopLimit to prevent infinite loops while allowing async operations
  const mockRenewalWindow = () => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      advanceTimeDelta: 20, // Advance 20ms for each real ms - speeds up setTimeout resolution
    });
    vi.setSystemTime(new Date(2025, 11, 15)); // December 15, 2025
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up localStorage with user_data (consistent with Login/Dashboard/KYC/PaymentHistory)
    const userData = {
      userId: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    };
    localStorage.setItem('user_data', JSON.stringify(userData));
    // Mock date to be in renewal window for all tests
    mockRenewalWindow();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC #1: should render renewal page with active membership', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([mockMembershipRecord]);
    mockIsFirstYearMember.mockResolvedValue({ Ok: false });

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      expect(screen.getByText('Renew Your Membership')).toBeInTheDocument();
    });

    // Should display current status
    await waitFor(() => {
      expect(screen.getByText('Current Membership Status')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('AC #2: should display correct expiration date', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([mockMembershipRecord]);
    mockIsFirstYearMember.mockResolvedValue({ Ok: false });

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      // Should display expiration date formatted as "December 31, 2025"
      expect(screen.getByText(/December 31, 2025/i)).toBeInTheDocument();
    });
  });

  it('AC #2: should display renewal deadline messaging (Jan 31)', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([mockMembershipRecord]);
    mockIsFirstYearMember.mockResolvedValue({ Ok: false });

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      expect(screen.getByText(/December 1 - January 31/i)).toBeInTheDocument();
      // January 31 appears multiple times (in window and deadline), so use getAllByText
      expect(screen.getAllByText(/January 31/i).length).toBeGreaterThan(0);
    });
  });

  it('AC #3: should calculate and display prorated amount for first-year member', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([mockMembershipRecord]);
    mockIsFirstYearMember.mockResolvedValue({ Ok: true });
    mockGetProratedDividend.mockResolvedValue({ Ok: BigInt(1250) }); // $12.50

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      // Should display prorated amount (appears twice: in fee row and total row)
      expect(screen.getAllByText('$12.50').length).toBeGreaterThan(0);
      expect(screen.getByText(/First-year member discount applied/i)).toBeInTheDocument();
    });
  });

  it('AC #3: should display standard $25 for full-year member', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([mockMembershipRecord]);
    mockIsFirstYearMember.mockResolvedValue({ Ok: false });

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      // Should display standard $25.00 (appears twice: in fee row and total row)
      expect(screen.getAllByText('$25.00').length).toBeGreaterThan(0);
    });
  });

  it('AC #4: should call oracle-bridge /create-renewal-checkout endpoint with correct user_id and amount', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([mockMembershipRecord]);
    mockIsFirstYearMember.mockResolvedValue({ Ok: false });

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: 'https://stripe.com/checkout/test' }),
    });
    global.fetch = mockFetch;

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      expect(screen.getByText('Renew Membership')).toBeInTheDocument();
    });

    // Click renewal button
    const renewButton = screen.getByText('Renew Membership');
    fireEvent.click(renewButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/create-renewal-checkout',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Component uses Principal.anonymous() for email/password auth
            user_id: Principal.anonymous().toText(),
            amount: 2500,
          }),
        })
      );
    });
  });

  it('AC #5: should redirect to Stripe checkout on success', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([mockMembershipRecord]);
    mockIsFirstYearMember.mockResolvedValue({ Ok: false });

    const checkoutUrl = 'https://stripe.com/checkout/test123';

    // Mock fetch to return checkout URL
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ checkout_url: checkoutUrl }),
    });
    global.fetch = mockFetch;

    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: '' },
    });

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      expect(screen.getByText('Renew Membership')).toBeInTheDocument();
    });

    // Click renewal button
    const renewButton = screen.getByText('Renew Membership');
    fireEvent.click(renewButton);

    await waitFor(() => {
      expect(window.location.href).toBe(checkoutUrl);
    });
  });

  it('AC #7: should display error message on API failure', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([mockMembershipRecord]);
    mockIsFirstYearMember.mockResolvedValue({ Ok: false });

    // Mock fetch to fail
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to create checkout session' }),
    });
    global.fetch = mockFetch;

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Renew membership/i })).toBeInTheDocument();
    });

    // Click renewal button
    const renewButton = screen.getByRole('button', { name: /Renew membership/i });
    fireEvent.click(renewButton);

    // Should display error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to create checkout session/i);
    });
  });

  it('AC #8: should show loading state prevents button double-submission during payment processing', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([mockMembershipRecord]);
    mockIsFirstYearMember.mockResolvedValue({ Ok: false });

    // Mock fetch with delay - use definite assignment assertion since resolve is always called
    let resolveFetch!: (value: {
      ok: boolean;
      json: () => Promise<{ checkout_url: string }>;
    }) => void;
    const mockFetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    global.fetch = mockFetch;

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Renew membership/i })).toBeInTheDocument();
    });

    // Click renewal button
    const renewButton = screen.getByRole('button', { name: /Renew membership/i });
    fireEvent.click(renewButton);

    // Should show loading state and button disabled
    await waitFor(() => {
      const processingButton = screen.getByRole('button', { name: /Processing payment/i });
      expect(processingButton).toBeDisabled();
      expect(processingButton).toHaveTextContent('Processing...');
    });

    // Resolve the fetch to clean up
    resolveFetch({
      ok: true,
      json: async () => ({ checkout_url: 'https://stripe.com/test' }),
    });
  });

  it('should redirect to login if not authenticated', async () => {
    // Clear localStorage to simulate unauthenticated user
    localStorage.clear();

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('should handle canister query failure gracefully', async () => {
    mockCanRenew.mockResolvedValue({ Err: 'Canister unreachable' });

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      expect(screen.getByText(/Canister unreachable/i)).toBeInTheDocument();
    });
  });

  it('should handle missing membership gracefully', async () => {
    mockCanRenew.mockResolvedValue({ Ok: true });
    mockVerifyMembership.mockResolvedValue([]); // No membership

    renderWithRouter(<MembershipRenewal />);

    await waitFor(() => {
      expect(screen.getByText(/No membership found/i)).toBeInTheDocument();
    });
  });
});
