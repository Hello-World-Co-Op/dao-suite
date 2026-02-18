/**
 * Member Profile Service Tests
 *
 * Story: BL-023.2
 * ACs: 1, 5, 7, 15
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchExtendedProfile, fetchGovernanceStats } from './memberProfileService';

// Mock oracleBridge utility
vi.mock('@/utils/oracleBridge', () => ({
  getOracleBridgeUrl: vi.fn(() => 'http://localhost:3000'),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('memberProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchExtendedProfile', () => {
    const mockResponse = {
      principal: 'abc-def-principal',
      display_name: 'Alice Builder',
      avatar: 'https://example.com/avatar.png',
      archetype: 'Builder',
      bio: 'Full-stack developer',
      join_date: '2025-06-15T00:00:00Z',
      is_active: true,
      membership_status: 'Active',
      expiration_date: '2026-06-15T00:00:00Z',
      blog_posts: [
        {
          id: 1,
          title: 'My First Post',
          slug: 'my-first-post',
          excerpt: 'This is a short excerpt',
          published_at: '2025-07-01T12:00:00Z',
          categories: ['tech', 'web3'],
        },
      ],
      blog_post_count: 1,
    };

    it('maps response to ExtendedMemberProfile on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchExtendedProfile('abc-def-principal');

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile!.principal).toBe('abc-def-principal');
      expect(result.profile!.displayName).toBe('Alice Builder');
      expect(result.profile!.avatar).toBe('https://example.com/avatar.png');
      expect(result.profile!.archetype).toBe('Builder');
      expect(result.profile!.bio).toBe('Full-stack developer');
      expect(result.profile!.joinDate).toBe('2025-06-15T00:00:00Z');
      expect(result.profile!.isActive).toBe(true);
      expect(result.profile!.membershipStatus).toBe('Active');
      expect(result.profile!.expirationDate).toBe('2026-06-15T00:00:00Z');
      expect(result.profile!.blogPosts).toHaveLength(1);
      expect(result.profile!.blogPosts[0]).toEqual({
        id: 1,
        title: 'My First Post',
        slug: 'my-first-post',
        excerpt: 'This is a short excerpt',
        publishedAt: '2025-07-01T12:00:00Z',
        categories: ['tech', 'web3'],
      });
      expect(result.profile!.blogPostCount).toBe(1);

      // Verify fetch was called with correct URL and credentials
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/members/profile/abc-def-principal/extended',
        { credentials: 'include' }
      );
    });

    it('falls back to "Expired" when membership_status is an unrecognized value', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...mockResponse, membership_status: 'Unknown' }),
      });

      const result = await fetchExtendedProfile('abc-def-principal');

      expect(result.success).toBe(true);
      expect(result.profile!.membershipStatus).toBe('Expired');
    });

    it('returns notFound: true on 404', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchExtendedProfile('nonexistent-principal');

      expect(result.success).toBe(false);
      expect(result.notFound).toBe(true);
      expect(result.profile).toBeUndefined();
    });

    it('returns error on 401 (authentication required)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await fetchExtendedProfile('abc-def-principal');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required');
    });

    it('returns error on other non-OK responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await fetchExtendedProfile('abc-def-principal');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Server error: 500');
    });

    it('returns error on network failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await fetchExtendedProfile('abc-def-principal');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('handles non-Error thrown values', async () => {
      fetchMock.mockRejectedValueOnce('string error');

      const result = await fetchExtendedProfile('abc-def-principal');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  describe('fetchGovernanceStats', () => {
    it('returns stats on success', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ proposals_created: 5, votes_cast: 12 }),
      });

      const result = await fetchGovernanceStats('abc-def-principal');

      expect(result.success).toBe(true);
      expect(result.stats).toEqual({
        proposalsCreated: 5,
        votesCast: 12,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/members/profile/abc-def-principal/governance',
        { credentials: 'include' }
      );
    });

    it('returns notFound on 404', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchGovernanceStats('nonexistent-principal');

      expect(result.success).toBe(false);
      expect(result.notFound).toBe(true);
      expect(result.error).toBe('Not found');
    });

    it('returns error on network failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await fetchGovernanceStats('abc-def-principal');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('returns error on 401 (authentication required)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await fetchGovernanceStats('abc-def-principal');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required');
    });
  });
});
