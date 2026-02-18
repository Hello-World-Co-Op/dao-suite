/**
 * Member Profile Page
 *
 * Page wrapper for the public member profile feature.
 * Resolves principal from URL param, fetches extended profile and
 * governance stats from oracle-bridge, and handles error states.
 *
 * Story: BL-023.2
 * ACs: 1, 8, 9, 10, 12, 13
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Principal } from '@dfinity/principal';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { MemberProfile } from '@/components/MemberProfile';
import {
  fetchExtendedProfile,
  fetchGovernanceStats,
  type ExtendedMemberProfile,
  type GovernanceStats,
} from '@/services/memberProfileService';
import { useMembership } from '@/hooks/useMembership';
import { trackEvent } from '@/utils/analytics';

// ============================================================================
// Skeleton
// ============================================================================

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-4" data-testid="profile-skeleton">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="h-4 w-full bg-gray-200 rounded" />
      <div className="h-4 w-3/4 bg-gray-200 rounded" />
    </div>
  );
}

// ============================================================================
// Error / Not Found Pages
// ============================================================================

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-gray-600 mb-4">
        This member&apos;s profile is private or does not exist.
      </p>
      <Link
        to="/members"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors duration-150"
      >
        Back to Directory
      </Link>
    </div>
  );
}

function InvalidPrincipalPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-gray-600 mb-4">Invalid profile URL.</p>
      <Link
        to="/members"
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-md transition-colors duration-150"
      >
        Back to Directory
      </Link>
    </div>
  );
}

interface ErrorBannerProps {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}

function ErrorBanner({ error, onRetry, isRetrying }: ErrorBannerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="h-10 w-10 text-red-500 mb-3" aria-hidden="true" />
      <p className="text-red-600 font-medium mb-2">Failed to load profile</p>
      <p className="text-gray-500 text-sm mb-4">{error}</p>
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
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function MemberProfilePage() {
  const { principal: principalParam } = useParams<{ principal: string }>();
  const { icPrincipal } = useMembership();

  // Validate principal format
  let validatedPrincipal: string | null = null;
  let isInvalidPrincipal = false;

  if (principalParam) {
    try {
      validatedPrincipal = Principal.fromText(principalParam).toText();
    } catch {
      isInvalidPrincipal = true;
    }
  } else {
    isInvalidPrincipal = true;
  }

  // State
  const [profile, setProfile] = useState<ExtendedMemberProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  const [governanceStats, setGovernanceStats] = useState<GovernanceStats | null>(null);
  const [isGovernanceLoading, setIsGovernanceLoading] = useState(true);

  const [isRetrying, setIsRetrying] = useState(false);

  const hasTrackedView = useRef(false);

  // Determine isOwnProfile (AC3)
  const isOwnProfile = !!(icPrincipal && validatedPrincipal && icPrincipal === validatedPrincipal);

  // Marketing base URL for blog links (AC5)
  const marketingBaseUrl = import.meta.env.VITE_MARKETING_URL || 'https://www.helloworlddao.com';

  // Fetch profile data
  const loadProfile = async (principal: string) => {
    setIsProfileLoading(true);
    setProfileError(null);
    setIsNotFound(false);

    const result = await fetchExtendedProfile(principal);

    if (result.success && result.profile) {
      setProfile(result.profile);
      setIsProfileLoading(false);

      // Track profile view on successful load
      if (!hasTrackedView.current) {
        hasTrackedView.current = true;
        trackEvent('member_profile_viewed', {
          member_principal: principal,
          is_own_profile: isOwnProfile,
        });
      }

      // Fetch governance stats after profile resolves (AC8)
      setIsGovernanceLoading(true);
      const govResult = await fetchGovernanceStats(principal);
      if (govResult.success && govResult.stats) {
        setGovernanceStats(govResult.stats);
      } else {
        // Graceful degradation: show zero-state on governance failure
        setGovernanceStats({ proposalsCreated: 0, votesCast: 0 });
      }
      setIsGovernanceLoading(false);
    } else if (result.notFound) {
      setIsNotFound(true);
      setIsProfileLoading(false);
      setIsGovernanceLoading(false);
    } else {
      setProfileError(result.error || 'Failed to load profile');
      setIsProfileLoading(false);
      setIsGovernanceLoading(false);
    }
  };

  // Load profile on mount
  useEffect(() => {
    if (validatedPrincipal && !isInvalidPrincipal) {
      loadProfile(validatedPrincipal);
    } else {
      setIsProfileLoading(false);
      setIsGovernanceLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validatedPrincipal]);

  // Retry handler
  const handleRetry = async () => {
    if (!validatedPrincipal) return;
    setIsRetrying(true);
    await loadProfile(validatedPrincipal);
    setIsRetrying(false);
  };

  // Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Invalid principal (AC10) */}
        {isInvalidPrincipal && <InvalidPrincipalPage />}

        {/* Loading skeleton (AC13) */}
        {!isInvalidPrincipal && isProfileLoading && <ProfileSkeleton />}

        {/* Not found (AC9) */}
        {!isInvalidPrincipal && !isProfileLoading && isNotFound && <NotFoundPage />}

        {/* Error with retry */}
        {!isInvalidPrincipal && !isProfileLoading && profileError && !isNotFound && (
          <ErrorBanner error={profileError} onRetry={handleRetry} isRetrying={isRetrying} />
        )}

        {/* Success: render profile */}
        {!isInvalidPrincipal && !isProfileLoading && profile && !isNotFound && !profileError && (
          <MemberProfile
            profile={profile}
            governanceStats={governanceStats}
            isGovernanceLoading={isGovernanceLoading}
            isOwnProfile={isOwnProfile}
            marketingBaseUrl={marketingBaseUrl}
          />
        )}
      </div>
    </div>
  );
}
