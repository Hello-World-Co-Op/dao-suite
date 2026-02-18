/**
 * Member Profile Component
 *
 * Displays a full member profile with header, bio, blog posts,
 * contribution badges placeholder, and governance stats.
 *
 * Story: BL-023.2
 * ACs: 2, 3, 4, 5, 6, 7, 8, 13, 14
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Shield, Settings, ArrowLeft, FileText, Vote } from 'lucide-react';
import {
  formatMemberSince,
  getArchetypeColor,
} from '@/stores';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import type { ExtendedMemberProfile, GovernanceStats } from '@/services/memberProfileService';

// ============================================================================
// Sub-components
// ============================================================================

function MembershipStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    Active: 'bg-teal-100 text-teal-800',
    Registered: 'bg-yellow-100 text-yellow-800',
    Expired: 'bg-red-100 text-red-700',
    Revoked: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    Active: 'Active Member',
    Registered: 'Registered Member',
    Expired: 'Membership Expired',
    Revoked: 'Membership Revoked',
  };
  const cls = classes[status] ?? 'bg-gray-100 text-gray-700';
  const label = labels[status] ?? status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function GovernanceSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 animate-pulse" data-testid="governance-skeleton">
      <div className="h-20 bg-gray-200 rounded-lg" />
      <div className="h-20 bg-gray-200 rounded-lg" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface MemberProfileProps {
  profile: ExtendedMemberProfile;
  governanceStats: GovernanceStats | null;
  isGovernanceLoading: boolean;
  isOwnProfile: boolean;
  marketingBaseUrl: string;
}

export function MemberProfile({
  profile,
  governanceStats,
  isGovernanceLoading,
  isOwnProfile,
  marketingBaseUrl,
}: MemberProfileProps): React.ReactElement {
  const archetypeColorClass = profile.archetype ? getArchetypeColor(profile.archetype) : '';

  return (
    <div className="space-y-6">
      {/* Back to Directory breadcrumb (AC14) */}
      <Link
        to="/members"
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors duration-150"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Directory
      </Link>

      {/* Profile Header Card (AC2) */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <MemberAvatar
            displayName={profile.displayName}
            avatar={profile.avatar}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.displayName || 'Anonymous Member'}
              </h1>
              <MembershipStatusBadge status={profile.membershipStatus} />
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {/* Archetype badge */}
              {profile.archetype && (
                <span
                  className={`
                    inline-flex items-center gap-1 px-2 py-1
                    text-xs font-medium rounded-full
                    ${archetypeColorClass}
                  `}
                >
                  <Shield className="h-3 w-3" />
                  {profile.archetype}
                </span>
              )}

              {/* Join date */}
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatMemberSince(profile.joinDate)}
              </p>
            </div>

            {/* Edit Profile Settings link (AC3) */}
            {isOwnProfile && (
              <Link
                to="/settings?tab=privacy"
                className="
                  mt-3 inline-flex items-center gap-1.5
                  text-sm font-medium text-teal-600 hover:text-teal-700
                  transition-colors duration-150
                "
              >
                <Settings className="h-4 w-4" />
                Edit Profile Settings
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Bio + Blog Posts */}
        <div className="lg:col-span-2 space-y-6">
          {/* About section (AC4) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
            <p className="text-gray-600">{profile.bio || 'No bio provided.'}</p>
          </div>

          {/* Blog Posts section (AC5) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Blog Posts</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {profile.blogPostCount}
              </span>
            </div>

            {profile.blogPosts.length > 0 ? (
              <ul className="space-y-4">
                {profile.blogPosts.slice(0, 5).map((post) => (
                  <li key={post.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <a
                      href={`${marketingBaseUrl}/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:text-teal-700 font-medium hover:underline"
                    >
                      {post.title}
                    </a>
                    {post.excerpt && (
                      <p className="text-sm text-gray-500 mt-1">
                        {post.excerpt.length > 120 ? post.excerpt.substring(0, 120) + '...' : post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {post.publishedAt && (
                        <span className="text-xs text-gray-400">
                          {new Date(post.publishedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                      {post.categories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No published blog posts yet.</p>
            )}

            {/* Contribution badges placeholder (AC6) */}
            <div className="mt-4 opacity-50 cursor-not-allowed" aria-disabled="true">
              <h4 className="text-sm font-medium text-gray-400 mb-1">Contribution Badges</h4>
              <p className="text-xs text-gray-400">Coming soon</p>
            </div>
          </div>
        </div>

        {/* Right column: Governance Stats */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Vote className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Governance</h2>
            </div>

            {/* Governance section (AC7, AC8) */}
            {isGovernanceLoading ? (
              <GovernanceSkeleton />
            ) : governanceStats && (governanceStats.proposalsCreated > 0 || governanceStats.votesCast > 0) ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-teal-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-teal-700">{governanceStats.proposalsCreated}</p>
                  <p className="text-xs text-teal-600 mt-1">Proposals Created</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{governanceStats.votesCast}</p>
                  <p className="text-xs text-blue-600 mt-1">Votes Cast</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No governance activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberProfile;
