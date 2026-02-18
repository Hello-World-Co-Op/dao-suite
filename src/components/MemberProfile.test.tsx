/**
 * MemberProfile Component Tests
 *
 * Story: BL-023.2
 * ACs: 2, 3, 4, 5, 6, 7, 8, 13, 14, 15
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemberProfile, type MemberProfileProps } from './MemberProfile';
import type { ExtendedMemberProfile, GovernanceStats } from '@/services/memberProfileService';

// Mock stores
vi.mock('@/stores', () => ({
  formatMemberSince: vi.fn((date: string) => {
    const d = new Date(date);
    return `Member since ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
  }),
  getArchetypeColor: vi.fn(() => 'text-orange-600 bg-orange-100'),
  getInitials: vi.fn((name: string) => {
    const parts = name.split(' ');
    return parts.map((p: string) => p[0]).join('').substring(0, 2).toUpperCase();
  }),
}));

function createMockProfile(overrides: Partial<ExtendedMemberProfile> = {}): ExtendedMemberProfile {
  return {
    principal: 'abc-def-principal',
    displayName: 'Alice Builder',
    avatar: null,
    archetype: 'Builder',
    bio: 'Full-stack developer passionate about Web3',
    joinDate: '2025-06-15T00:00:00Z',
    isActive: true,
    membershipStatus: 'Active',
    expirationDate: null,
    blogPosts: [],
    blogPostCount: 0,
    ...overrides,
  };
}

function createMockStats(overrides: Partial<GovernanceStats> = {}): GovernanceStats {
  return {
    proposalsCreated: 3,
    votesCast: 10,
    ...overrides,
  };
}

function renderProfile(overrides: Partial<MemberProfileProps> = {}) {
  const defaultProps: MemberProfileProps = {
    profile: createMockProfile(),
    governanceStats: createMockStats(),
    isGovernanceLoading: false,
    isOwnProfile: false,
    marketingBaseUrl: 'https://www.helloworlddao.com',
    ...overrides,
  };

  return render(
    <MemoryRouter>
      <MemberProfile {...defaultProps} />
    </MemoryRouter>
  );
}

describe('MemberProfile', () => {
  describe('Profile Header (AC2)', () => {
    it('renders display name in profile header', () => {
      renderProfile();
      expect(screen.getByText('Alice Builder')).toBeInTheDocument();
    });

    it('renders "Anonymous Member" when displayName is null', () => {
      renderProfile({ profile: createMockProfile({ displayName: null }) });
      expect(screen.getByText('Anonymous Member')).toBeInTheDocument();
    });

    it('renders archetype badge when archetype is set', () => {
      renderProfile();
      expect(screen.getByText('Builder')).toBeInTheDocument();
    });

    it('renders membership status badge', () => {
      renderProfile();
      expect(screen.getByText('Active Member')).toBeInTheDocument();
    });

    it('renders member since date', () => {
      renderProfile();
      expect(screen.getByText('Member since June 2025')).toBeInTheDocument();
    });
  });

  describe('About Section (AC4)', () => {
    it('renders bio text when bio is provided', () => {
      renderProfile();
      expect(screen.getByText('Full-stack developer passionate about Web3')).toBeInTheDocument();
    });

    it('renders "No bio provided." when bio is null', () => {
      renderProfile({ profile: createMockProfile({ bio: null }) });
      expect(screen.getByText('No bio provided.')).toBeInTheDocument();
    });
  });

  describe('Blog Posts Section (AC5)', () => {
    it('renders blog posts list when blogPosts.length > 0', () => {
      const profile = createMockProfile({
        blogPosts: [
          {
            id: 1,
            title: 'My First Post',
            slug: 'my-first-post',
            excerpt: 'A short excerpt about the post',
            publishedAt: '2025-07-01T12:00:00Z',
            categories: ['tech'],
          },
        ],
        blogPostCount: 1,
      });
      renderProfile({ profile });

      expect(screen.getByText('My First Post')).toBeInTheDocument();
      expect(screen.getByText('A short excerpt about the post')).toBeInTheDocument();
      expect(screen.getByText('tech')).toBeInTheDocument();

      // Blog link should point to marketing site
      const link = screen.getByText('My First Post');
      expect(link.closest('a')).toHaveAttribute('href', 'https://www.helloworlddao.com/blog/my-first-post');
      expect(link.closest('a')).toHaveAttribute('target', '_blank');
    });

    it('renders "No published blog posts yet." when blogPosts is empty array', () => {
      renderProfile({ profile: createMockProfile({ blogPosts: [], blogPostCount: 0 }) });
      expect(screen.getByText('No published blog posts yet.')).toBeInTheDocument();
    });

    it('truncates excerpt at 120 characters', () => {
      const longExcerpt = 'A'.repeat(150);
      const profile = createMockProfile({
        blogPosts: [{
          id: 1,
          title: 'Long Post',
          slug: 'long-post',
          excerpt: longExcerpt,
          publishedAt: null,
          categories: [],
        }],
        blogPostCount: 1,
      });
      renderProfile({ profile });

      expect(screen.getByText('A'.repeat(120) + '...')).toBeInTheDocument();
    });
  });

  describe('Contribution Badges Placeholder (AC6)', () => {
    it('renders "Contribution badges coming soon" placeholder', () => {
      renderProfile();
      expect(screen.getByText('Contribution Badges')).toBeInTheDocument();
      expect(screen.getByText('Coming soon')).toBeInTheDocument();
    });
  });

  describe('Governance Section (AC7, AC8)', () => {
    it('renders governance skeleton when isGovernanceLoading=true', () => {
      renderProfile({ isGovernanceLoading: true, governanceStats: null });
      expect(screen.getByTestId('governance-skeleton')).toBeInTheDocument();
    });

    it('renders "No governance activity yet." when both stats are 0', () => {
      renderProfile({
        governanceStats: createMockStats({ proposalsCreated: 0, votesCast: 0 }),
        isGovernanceLoading: false,
      });
      expect(screen.getByText('No governance activity yet.')).toBeInTheDocument();
    });

    it('renders proposals_created and votes_cast stat counts', () => {
      renderProfile({
        governanceStats: createMockStats({ proposalsCreated: 5, votesCast: 12 }),
        isGovernanceLoading: false,
      });
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('Proposals Created')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Votes Cast')).toBeInTheDocument();
    });

    it('renders "No governance activity yet." when governanceStats is null', () => {
      renderProfile({
        governanceStats: null,
        isGovernanceLoading: false,
      });
      expect(screen.getByText('No governance activity yet.')).toBeInTheDocument();
    });
  });

  describe('Edit Profile Settings (AC3)', () => {
    it('renders "Edit Profile Settings" link when isOwnProfile=true', () => {
      renderProfile({ isOwnProfile: true });
      const link = screen.getByText('Edit Profile Settings');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', '/settings?tab=privacy');
    });

    it('does NOT render "Edit Profile Settings" link when isOwnProfile=false', () => {
      renderProfile({ isOwnProfile: false });
      expect(screen.queryByText('Edit Profile Settings')).not.toBeInTheDocument();
    });
  });

  describe('Navigation (AC14)', () => {
    it('renders "Back to Directory" link to "/members"', () => {
      renderProfile();
      const link = screen.getByText('Back to Directory');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', '/members');
    });
  });
});
