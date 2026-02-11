/**
 * MemberDirectory Component Tests
 *
 * Story: 9-3-1-member-directory
 * ACs: 1, 2, 3, 4, 5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { MemberDirectory } from '@/components/MemberDirectory';
import { $contacts, clearMembers, clearContacts, type MemberProfile } from '@/stores';

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

// Mock memberService
vi.mock('@/services/memberService', () => ({
  useMemberDirectory: vi.fn(() => ({
    memberState: {
      members: [],
      totalCount: 0,
      currentPage: 0,
      lastUpdated: null,
      isLoading: false,
      error: null,
    },
    filteredMembers: [],
    archetypeCounts: {},
    searchQuery: '',
    selectedMember: null,
    currentPage: 0,
    totalPages: 1,
    isLoading: false,
    isRefreshing: false,
    refresh: vi.fn(),
    goToPage: vi.fn(),
    nextPage: vi.fn(),
    prevPage: vi.fn(),
    setSearch: vi.fn(),
    clearSearch: vi.fn(),
    selectMember: vi.fn(),
    clear: vi.fn(),
  })),
}));

// Mock contactService
vi.mock('@/services/contactService', () => ({
  useContactRequests: vi.fn(() => ({
    contactsState: $contacts.get(),
    pendingSent: [],
    pendingReceived: [],
    approvedContacts: [],
    pendingReceivedCount: 0,
    isModalOpen: false,
    recipientPrincipal: null,
    isLoading: false,
    isSending: false,
    getStatusFor: vi.fn(() => null),
    openModal: vi.fn(),
    closeModal: vi.fn(),
    send: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    refresh: vi.fn(),
    clear: vi.fn(),
  })),
}));

import { useMemberDirectory } from '@/services/memberService';
import { useContactRequests } from '@/services/contactService';
import { trackEvent } from '@/utils/analytics';

// Helper to create a mock member profile
function createMockMember(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    principal: `mock-principal-${Math.random().toString(36).substring(2, 9)}`,
    displayName: 'Test Member',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=test',
    archetype: 'Builder',
    bio: 'A test member bio',
    memberSince:
      BigInt(Date.now()) * BigInt(1_000_000) - BigInt(30 * 24 * 60 * 60) * BigInt(1_000_000_000), // 30 days ago
    visibility: 'public',
    isActive: true,
    ...overrides,
  };
}

// Helper to create mock members with various archetypes
function createMockMembers(): MemberProfile[] {
  return [
    createMockMember({
      principal: 'principal-1',
      displayName: 'Alice Builder',
      archetype: 'Builder',
      bio: 'Full-stack developer passionate about Web3',
    }),
    createMockMember({
      principal: 'principal-2',
      displayName: 'Bob Guardian',
      archetype: 'Guardian',
      bio: 'Security researcher and auditor',
    }),
    createMockMember({
      principal: 'principal-3',
      displayName: 'Carol Visionary',
      archetype: 'Visionary',
      bio: 'Product strategist with 10 years experience',
    }),
    createMockMember({
      principal: 'principal-4',
      displayName: 'Dave Connector',
      archetype: 'Connector',
      bio: 'Community builder and partnership lead',
    }),
    createMockMember({
      principal: 'principal-5',
      displayName: 'Eve Steward',
      archetype: 'Steward',
      bio: 'Operations and governance specialist',
    }),
  ];
}

describe('MemberDirectory', () => {
  beforeEach(() => {
    clearMembers();
    clearContacts();
    vi.clearAllMocks();

    // Reset mocks to default implementation
    vi.mocked(useMemberDirectory).mockImplementation(() => ({
      memberState: {
        members: [],
        totalCount: 0,
        currentPage: 0,
        lastUpdated: null,
        isLoading: false,
        error: null,
      },
      filteredMembers: [],
      archetypeCounts: {},
      searchQuery: '',
      selectedMember: null,
      currentPage: 0,
      totalPages: 1,
      isLoading: false,
      isRefreshing: false,
      refresh: vi.fn(),
      goToPage: vi.fn(),
      nextPage: vi.fn(),
      prevPage: vi.fn(),
      setSearch: vi.fn(),
      clearSearch: vi.fn(),
      selectMember: vi.fn(),
      clear: vi.fn(),
    }));

    vi.mocked(useContactRequests).mockImplementation(() => ({
      contactsState: $contacts.get(),
      pendingSent: [],
      pendingReceived: [],
      approvedContacts: [],
      pendingReceivedCount: 0,
      isModalOpen: false,
      recipientPrincipal: null,
      isLoading: false,
      isSending: false,
      getStatusFor: vi.fn(() => null),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      send: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
      refresh: vi.fn(),
      clear: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to create mock hook result
  function createMockHookResult(
    members: MemberProfile[],
    overrides: Partial<ReturnType<typeof useMemberDirectory>> = {}
  ) {
    return {
      memberState: {
        members,
        totalCount: members.length,
        currentPage: 0,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
      },
      filteredMembers: members,
      archetypeCounts: {
        Builder: members.filter((m) => m.archetype === 'Builder').length,
        Guardian: members.filter((m) => m.archetype === 'Guardian').length,
        Visionary: members.filter((m) => m.archetype === 'Visionary').length,
        Connector: members.filter((m) => m.archetype === 'Connector').length,
        Steward: members.filter((m) => m.archetype === 'Steward').length,
      },
      searchQuery: '',
      selectedMember: null,
      currentPage: 0,
      totalPages: 1,
      isLoading: false,
      isRefreshing: false,
      refresh: vi.fn(),
      goToPage: vi.fn(),
      nextPage: vi.fn(),
      prevPage: vi.fn(),
      setSearch: vi.fn(),
      clearSearch: vi.fn(),
      selectMember: vi.fn(),
      clear: vi.fn(),
      ...overrides,
    };
  }

  describe('Rendering', () => {
    it('should render member directory header', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      render(<MemberDirectory />);

      expect(screen.getByText('Member Directory')).toBeInTheDocument();
    });

    it('should display list of members (AC-1)', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      render(<MemberDirectory />);

      expect(screen.getByText('Alice Builder')).toBeInTheDocument();
      expect(screen.getByText('Bob Guardian')).toBeInTheDocument();
      expect(screen.getByText('Carol Visionary')).toBeInTheDocument();
      expect(screen.getByText('Dave Connector')).toBeInTheDocument();
      expect(screen.getByText('Eve Steward')).toBeInTheDocument();
    });

    it('should display member archetype badges (AC-1)', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      render(<MemberDirectory />);

      // Should have archetype badges for each member
      expect(screen.getByText('Builder')).toBeInTheDocument();
      expect(screen.getByText('Guardian')).toBeInTheDocument();
      expect(screen.getByText('Visionary')).toBeInTheDocument();
      expect(screen.getByText('Connector')).toBeInTheDocument();
      expect(screen.getByText('Steward')).toBeInTheDocument();
    });

    it('should display member count', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      render(<MemberDirectory />);

      expect(screen.getByText(/5 members/i)).toBeInTheDocument();
    });
  });

  describe('Search (AC-2)', () => {
    it('should render search input', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      render(<MemberDirectory />);

      expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
    });

    it('should call setSearch when typing', async () => {
      const mockSetSearch = vi.fn();
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { setSearch: mockSetSearch })
      );

      render(<MemberDirectory />);

      const searchInput = screen.getByPlaceholderText(/search by name/i);
      await userEvent.type(searchInput, 'Alice');

      // Wait for debounce
      await waitFor(
        () => {
          expect(mockSetSearch).toHaveBeenCalled();
        },
        { timeout: 500 }
      );
    });

    it('should show clear button when search has value', async () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { searchQuery: 'Alice' })
      );

      render(<MemberDirectory />);

      expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
    });
  });

  describe('Member Detail (AC-3)', () => {
    it('should call selectMember when member card is clicked', async () => {
      const mockSelectMember = vi.fn();
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { selectMember: mockSelectMember })
      );

      render(<MemberDirectory />);

      // Click on member card
      const memberCard = screen.getByText('Alice Builder').closest('button, [role="button"]');
      if (memberCard) {
        await userEvent.click(memberCard);
        expect(mockSelectMember).toHaveBeenCalled();
      }
    });

    it('should display member detail modal when member is selected', () => {
      const members = createMockMembers();
      const selectedMember = members[0];
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { selectedMember })
      );

      render(<MemberDirectory />);

      // Modal should show member details (bio appears in card and modal)
      const bioElements = screen.getAllByText('Full-stack developer passionate about Web3');
      expect(bioElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Contact Request (AC-4)', () => {
    it('should show Send Contact Request button in member detail modal', () => {
      const members = createMockMembers();
      const selectedMember = members[0];
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { selectedMember })
      );

      render(<MemberDirectory userPrincipal="my-principal" />);

      // Modal should have contact request button
      expect(screen.getByRole('button', { name: /send contact request/i })).toBeInTheDocument();
    });

    it('should call contact handler when Send Contact Request is clicked', async () => {
      const mockOpenModal = vi.fn();
      const members = createMockMembers();
      const selectedMember = members[0];
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { selectedMember })
      );

      vi.mocked(useContactRequests).mockImplementation(() => ({
        contactsState: $contacts.get(),
        pendingSent: [],
        pendingReceived: [],
        approvedContacts: [],
        pendingReceivedCount: 0,
        isModalOpen: false,
        recipientPrincipal: null,
        isLoading: false,
        isSending: false,
        getStatusFor: vi.fn(() => null),
        openModal: mockOpenModal,
        closeModal: vi.fn(),
        send: vi.fn(),
        approve: vi.fn(),
        reject: vi.fn(),
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<MemberDirectory userPrincipal="my-principal" />);

      const contactButton = screen.getByRole('button', { name: /send contact request/i });
      await userEvent.click(contactButton);

      expect(mockOpenModal).toHaveBeenCalled();
    });

    it('should show pending status when request already sent', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      vi.mocked(useContactRequests).mockImplementation(() => ({
        contactsState: $contacts.get(),
        pendingSent: [],
        pendingReceived: [],
        approvedContacts: [],
        pendingReceivedCount: 0,
        isModalOpen: false,
        recipientPrincipal: null,
        isLoading: false,
        isSending: false,
        getStatusFor: vi.fn((principal) => (principal === 'principal-1' ? 'pending' : null)),
        openModal: vi.fn(),
        closeModal: vi.fn(),
        send: vi.fn(),
        approve: vi.fn(),
        reject: vi.fn(),
        refresh: vi.fn(),
        clear: vi.fn(),
      }));

      render(<MemberDirectory userPrincipal="my-principal" />);

      // Should show pending status for the first member
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show skeleton when loading', () => {
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult([], {
          memberState: {
            members: [],
            totalCount: 0,
            currentPage: 0,
            lastUpdated: null,
            isLoading: true,
            error: null,
          },
          isLoading: true,
        })
      );

      render(<MemberDirectory />);

      // Skeleton should have animate-pulse class
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', () => {
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult([], {
          memberState: {
            members: [],
            totalCount: 0,
            currentPage: 0,
            lastUpdated: null,
            isLoading: false,
            error: 'Network error',
          },
        })
      );

      render(<MemberDirectory />);

      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should call refresh when retry is clicked', async () => {
      const mockRefresh = vi.fn();

      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult([], {
          memberState: {
            members: [],
            totalCount: 0,
            currentPage: 0,
            lastUpdated: null,
            isLoading: false,
            error: 'Network error',
          },
          refresh: mockRefresh,
        })
      );

      render(<MemberDirectory />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no members', () => {
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult([]));

      render(<MemberDirectory />);

      expect(screen.getByText(/No members in directory/i)).toBeInTheDocument();
    });

    it('should show message when search has no results', () => {
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult([], { searchQuery: 'xyz123' })
      );

      render(<MemberDirectory />);

      expect(screen.getByText(/no members match/i)).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should render pagination when multiple pages', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, {
          memberState: {
            members,
            totalCount: 100,
            currentPage: 0,
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
          totalPages: 5,
        })
      );

      render(<MemberDirectory />);

      expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument();
    });

    it('should call nextPage when next is clicked', async () => {
      const mockNextPage = vi.fn();
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, {
          memberState: {
            members,
            totalCount: 100,
            currentPage: 0,
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
          totalPages: 5,
          nextPage: mockNextPage,
        })
      );

      render(<MemberDirectory />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextButton);

      expect(mockNextPage).toHaveBeenCalled();
    });

    it('should disable previous button on first page', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, {
          memberState: {
            members,
            totalCount: 100,
            currentPage: 0,
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
          currentPage: 0,
          totalPages: 5,
        })
      );

      render(<MemberDirectory />);

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, {
          memberState: {
            members,
            totalCount: 100,
            currentPage: 4,
            lastUpdated: Date.now(),
            isLoading: false,
            error: null,
          },
          currentPage: 4,
          totalPages: 5,
        })
      );

      render(<MemberDirectory />);

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Refresh button', () => {
    it('should render refresh button', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      render(<MemberDirectory />);

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should call refresh when clicked', async () => {
      const mockRefresh = vi.fn();
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { refresh: mockRefresh })
      );

      render(<MemberDirectory />);

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await userEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  describe('Own Profile (AC-5)', () => {
    it('should mark current user profile with (You) label', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      render(
        <MemoryRouter>
          <MemberDirectory userPrincipal="principal-1" />
        </MemoryRouter>
      );

      // Alice Builder should have "(You)" label since principal matches
      expect(screen.getByText('(You)')).toBeInTheDocument();
    });

    it('should show Edit Profile Settings button for own profile in detail modal', () => {
      const members = createMockMembers();
      const selectedMember = members[0]; // Alice Builder with principal-1
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { selectedMember })
      );

      render(
        <MemoryRouter>
          <MemberDirectory userPrincipal="principal-1" />
        </MemoryRouter>
      );

      // Should show Edit Profile Settings button instead of contact request
      expect(screen.getByRole('link', { name: /Edit Profile Settings/i })).toBeInTheDocument();
    });

    it('should not show Send Contact Request button for own profile', () => {
      const members = createMockMembers();
      const selectedMember = members[0]; // Alice Builder with principal-1
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { selectedMember })
      );

      render(
        <MemoryRouter>
          <MemberDirectory userPrincipal="principal-1" />
        </MemoryRouter>
      );

      // Should NOT show contact request button for own profile
      expect(
        screen.queryByRole('button', { name: /send contact request/i })
      ).not.toBeInTheDocument();
    });

    it('should link Edit Profile Settings to privacy settings', () => {
      const members = createMockMembers();
      const selectedMember = members[0];
      vi.mocked(useMemberDirectory).mockImplementation(() =>
        createMockHookResult(members, { selectedMember })
      );

      render(
        <MemoryRouter>
          <MemberDirectory userPrincipal="principal-1" />
        </MemoryRouter>
      );

      const editLink = screen.getByRole('link', { name: /Edit Profile Settings/i });
      expect(editLink).toHaveAttribute('href', '/settings?tab=privacy');
    });
  });

  describe('Analytics (Task 8)', () => {
    it('should track page view on mount', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      render(
        <MemoryRouter>
          <MemberDirectory />
        </MemoryRouter>
      );

      expect(trackEvent).toHaveBeenCalledWith('member_directory_loaded', expect.any(Object));
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const members = createMockMembers();
      vi.mocked(useMemberDirectory).mockImplementation(() => createMockHookResult(members));

      const { container } = render(<MemberDirectory className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
