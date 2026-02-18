/**
 * Member Profile Service
 *
 * Service for fetching extended member profile data and governance stats
 * via oracle-bridge proxy. All canister calls go through oracle-bridge —
 * no direct IC agent usage.
 *
 * Story: BL-023.2
 * ACs: 1, 5, 7
 */

import { getOracleBridgeUrl } from '@/utils/oracleBridge';

// ============================================================================
// Types
// ============================================================================

export interface BlogPostSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  categories: string[];
}

export interface ExtendedMemberProfile {
  principal: string;
  displayName: string | null;
  avatar: string | null;
  archetype: string;
  bio: string | null;
  joinDate: string;
  isActive: boolean;
  membershipStatus: 'Active' | 'Registered' | 'Expired' | 'Revoked';
  expirationDate: string | null;
  blogPosts: BlogPostSummary[];
  blogPostCount: number;
}

export interface GovernanceStats {
  proposalsCreated: number;
  votesCast: number;
}

export interface FetchExtendedProfileResult {
  success: boolean;
  profile?: ExtendedMemberProfile;
  error?: string;
  notFound?: boolean;
}

export interface FetchGovernanceStatsResult {
  success: boolean;
  stats?: GovernanceStats;
  error?: string;
  notFound?: boolean;
}

// ============================================================================
// Internal Types (oracle-bridge snake_case response shapes)
// ============================================================================

interface BlogPostResponse {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
  categories: string[];
}

interface ExtendedProfileResponse {
  principal: string;
  display_name: string | null;
  avatar: string | null;
  archetype: string;
  bio: string | null;
  join_date: string;
  is_active: boolean;
  membership_status: string;
  expiration_date: string | null;
  blog_posts: BlogPostResponse[];
  blog_post_count: number;
}

interface GovernanceStatsResponse {
  proposals_created: number;
  votes_cast: number;
}

// ============================================================================
// Helpers
// ============================================================================

const VALID_MEMBERSHIP_STATUSES = ['Active', 'Registered', 'Expired', 'Revoked'] as const;

function toMembershipStatus(raw: string): ExtendedMemberProfile['membershipStatus'] {
  if ((VALID_MEMBERSHIP_STATUSES as readonly string[]).includes(raw)) {
    return raw as ExtendedMemberProfile['membershipStatus'];
  }
  // Fallback: treat unknown statuses as Expired to show the correct badge colour
  return 'Expired';
}

function mapBlogPost(post: BlogPostResponse): BlogPostSummary {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    publishedAt: post.published_at,
    categories: post.categories,
  };
}

function mapExtendedProfile(data: ExtendedProfileResponse): ExtendedMemberProfile {
  return {
    principal: data.principal,
    displayName: data.display_name,
    avatar: data.avatar,
    archetype: data.archetype,
    bio: data.bio,
    joinDate: data.join_date,
    isActive: data.is_active,
    membershipStatus: toMembershipStatus(data.membership_status),
    expirationDate: data.expiration_date,
    blogPosts: (data.blog_posts || []).map(mapBlogPost),
    blogPostCount: data.blog_post_count,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch extended member profile from oracle-bridge.
 * Returns full profile with blog posts and membership details.
 */
export async function fetchExtendedProfile(
  principal: string
): Promise<FetchExtendedProfileResult> {
  const baseUrl = getOracleBridgeUrl();
  const url = `${baseUrl}/api/members/profile/${encodeURIComponent(principal)}/extended`;

  try {
    const response = await fetch(url, { credentials: 'include' });

    if (response.status === 404) {
      return { success: false, notFound: true };
    }

    if (response.status === 401) {
      return { success: false, error: 'Authentication required' };
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Server error: ${response.status} ${text}` };
    }

    const data: ExtendedProfileResponse = await response.json();
    return { success: true, profile: mapExtendedProfile(data) };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch governance stats for a member from oracle-bridge.
 * Returns proposal count and vote count.
 */
export async function fetchGovernanceStats(
  principal: string
): Promise<FetchGovernanceStatsResult> {
  const baseUrl = getOracleBridgeUrl();
  const url = `${baseUrl}/api/members/profile/${encodeURIComponent(principal)}/governance`;

  try {
    const response = await fetch(url, { credentials: 'include' });

    if (response.status === 404) {
      return { success: false, notFound: true, error: 'Not found' };
    }

    if (response.status === 401) {
      return { success: false, error: 'Authentication required' };
    }

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Server error: ${response.status} ${text}` };
    }

    const data: GovernanceStatsResponse = await response.json();
    return {
      success: true,
      stats: {
        proposalsCreated: data.proposals_created,
        votesCast: data.votes_cast,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
