/**
 * MemberProfilePage Tests
 *
 * Story: BL-023.2
 * ACs: 1, 8, 9, 10, 13, 15
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MemberProfilePage from './MemberProfilePage';

// Mock analytics
vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

// Mock useMembership
vi.mock('@/hooks/useMembership', () => ({
  useMembership: vi.fn(() => ({
    icPrincipal: null,
    membershipStatus: 'Active',
    isActiveMember: true,
    isRegistered: false,
    isLoading: false,
  })),
}));

// Mock memberProfileService
vi.mock('@/services/memberProfileService', () => ({
  fetchExtendedProfile: vi.fn(),
  fetchGovernanceStats: vi.fn(),
}));

// Mock stores (needed by MemberProfile child component)
vi.mock('@/stores', () => ({
  formatMemberSince: vi.fn((date: string) => {
    const d = new Date(date);
    return `Member since ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
  }),
  getArchetypeColor: vi.fn(() => 'text-orange-600 bg-orange-100'),
  getInitials: vi.fn((name: string) => {
    if (!name) return '??';
    const parts = name.split(' ');
    return parts.map((p: string) => p[0]).join('').substring(0, 2).toUpperCase();
  }),
}));

import { fetchExtendedProfile, fetchGovernanceStats } from '@/services/memberProfileService';
import { useMembership } from '@/hooks/useMembership';

// A valid IC principal for testing (anonymous principal)
const VALID_PRINCIPAL = '2vxsx-fae';
const INVALID_PRINCIPAL = 'not-a-valid-principal-!!!';

const mockProfile = {
  principal: VALID_PRINCIPAL,
  displayName: 'Alice Builder',
  avatar: null,
  archetype: 'Builder',
  bio: 'Full-stack developer',
  joinDate: '2025-06-15T00:00:00Z',
  isActive: true,
  membershipStatus: 'Active' as const,
  expirationDate: null,
  blogPosts: [],
  blogPostCount: 0,
};

function renderWithRoute(principal: string) {
  return render(
    <MemoryRouter initialEntries={[`/members/${principal}`]}>
      <Routes>
        <Route path="/members/:principal" element={<MemberProfilePage />} />
        <Route path="/members" element={<div>Directory Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MemberProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_MARKETING_URL', 'https://www.helloworlddao.com');
  });

  it('renders profile skeleton while loading', () => {
    vi.mocked(fetchExtendedProfile).mockReturnValue(new Promise(() => {})); // never resolves

    renderWithRoute(VALID_PRINCIPAL);

    expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument();
  });

  it('renders profile after successful fetch', async () => {
    vi.mocked(fetchExtendedProfile).mockResolvedValue({
      success: true,
      profile: mockProfile,
    });
    vi.mocked(fetchGovernanceStats).mockResolvedValue({
      success: true,
      stats: { proposalsCreated: 3, votesCast: 10 },
    });

    renderWithRoute(VALID_PRINCIPAL);

    await waitFor(() => {
      expect(screen.getByText('Alice Builder')).toBeInTheDocument();
    });

    // Governance stats should also appear
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('renders "profile is private or does not exist" page on 404', async () => {
    vi.mocked(fetchExtendedProfile).mockResolvedValue({
      success: false,
      notFound: true,
    });

    renderWithRoute(VALID_PRINCIPAL);

    await waitFor(() => {
      expect(
        screen.getByText(/profile is private or does not exist/i)
      ).toBeInTheDocument();
    });

    // "Back to Directory" link should be present
    expect(screen.getByText('Back to Directory')).toBeInTheDocument();
  });

  it('renders "Invalid profile URL" page for malformed principal', async () => {
    renderWithRoute(INVALID_PRINCIPAL);

    await waitFor(() => {
      expect(screen.getByText('Invalid profile URL.')).toBeInTheDocument();
    });

    expect(screen.getByText('Back to Directory')).toBeInTheDocument();
    // Should NOT call fetch for invalid principal
    expect(fetchExtendedProfile).not.toHaveBeenCalled();
  });

  it('governance section shows skeleton while loading then resolves', async () => {
    let resolveGov: (value: unknown) => void;
    const govPromise = new Promise((resolve) => {
      resolveGov = resolve;
    });

    vi.mocked(fetchExtendedProfile).mockResolvedValue({
      success: true,
      profile: mockProfile,
    });
    vi.mocked(fetchGovernanceStats).mockReturnValue(govPromise as ReturnType<typeof fetchGovernanceStats>);

    renderWithRoute(VALID_PRINCIPAL);

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Alice Builder')).toBeInTheDocument();
    });

    // Governance skeleton should be visible
    expect(screen.getByTestId('governance-skeleton')).toBeInTheDocument();

    // Resolve governance
    resolveGov!({ success: true, stats: { proposalsCreated: 7, votesCast: 20 } });

    await waitFor(() => {
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
    });
  });

  it('passes isOwnProfile=true when icPrincipal matches route :principal', async () => {
    vi.mocked(useMembership).mockReturnValue({
      icPrincipal: VALID_PRINCIPAL,
      membershipStatus: 'Active',
      isActiveMember: true,
      isRegistered: false,
      isLoading: false,
    });

    vi.mocked(fetchExtendedProfile).mockResolvedValue({
      success: true,
      profile: mockProfile,
    });
    vi.mocked(fetchGovernanceStats).mockResolvedValue({
      success: true,
      stats: { proposalsCreated: 0, votesCast: 0 },
    });

    renderWithRoute(VALID_PRINCIPAL);

    await waitFor(() => {
      expect(screen.getByText('Alice Builder')).toBeInTheDocument();
    });

    // isOwnProfile=true → "Edit Profile Settings" link should appear
    expect(screen.getByText('Edit Profile Settings')).toBeInTheDocument();
  });

  it('passes isOwnProfile=false when icPrincipal does not match', async () => {
    vi.mocked(useMembership).mockReturnValue({
      icPrincipal: 'different-principal-xyz',
      membershipStatus: 'Active',
      isActiveMember: true,
      isRegistered: false,
      isLoading: false,
    });

    vi.mocked(fetchExtendedProfile).mockResolvedValue({
      success: true,
      profile: mockProfile,
    });
    vi.mocked(fetchGovernanceStats).mockResolvedValue({
      success: true,
      stats: { proposalsCreated: 0, votesCast: 0 },
    });

    renderWithRoute(VALID_PRINCIPAL);

    await waitFor(() => {
      expect(screen.getByText('Alice Builder')).toBeInTheDocument();
    });

    // isOwnProfile=false → "Edit Profile Settings" should NOT appear
    expect(screen.queryByText('Edit Profile Settings')).not.toBeInTheDocument();
  });

  it('renders error banner with retry button on fetch failure', async () => {
    vi.mocked(fetchExtendedProfile).mockResolvedValue({
      success: false,
      error: 'Server error: 500 Internal Server Error',
    });

    renderWithRoute(VALID_PRINCIPAL);

    await waitFor(() => {
      expect(screen.getByText('Failed to load profile')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
