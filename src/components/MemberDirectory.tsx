/**
 * Member Directory Component
 *
 * Displays a directory of DAO members who have opted into visibility.
 * Includes search, pagination, member cards, and profile detail view.
 *
 * Story: 9-3-1-member-directory
 * ACs: 1, 2, 3
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw,
  Users,
  AlertCircle,
  HelpCircle,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Shield,
  Mail,
  MessageCircle,
  Eye,
  EyeOff,
  Check,
  Clock,
  XCircle,
  Settings,
} from 'lucide-react';
import {
  formatMemberSince,
  getArchetypeColor,
  getInitials,
  getContactStatusColor,
  type MemberProfile,
  type ContactStatus,
} from '@/stores';
import { useMemberDirectory } from '../services/memberService';
import { useContactRequests } from '../services/contactService';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Loading Skeleton
// ============================================================================

function MemberSkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-6">
      {/* Search skeleton */}
      <div className="h-10 bg-gray-200 rounded-lg w-full max-w-md" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-48 bg-gray-200 rounded-lg" />
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex justify-center gap-2">
        <div className="h-10 w-24 bg-gray-200 rounded-md" />
        <div className="h-10 w-20 bg-gray-200 rounded-md" />
        <div className="h-10 w-24 bg-gray-200 rounded-md" />
      </div>
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}

function ErrorState({ error, onRetry, isRetrying }: ErrorStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="h-10 w-10 text-red-500 mb-3" aria-hidden="true" />
      <p className="text-red-600 font-medium mb-2">Failed to load member directory</p>
      <p className="text-gray-500 text-sm mb-4">{error}</p>
      <div className="flex gap-3">
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
        <a
          href="mailto:support@helloworlddao.com?subject=Member%20Directory%20Issue"
          className="
            inline-flex items-center gap-2 px-4 py-2
            text-sm font-medium text-gray-700
            bg-gray-100 hover:bg-gray-200
            rounded-md
            focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
            transition-colors duration-150
          "
        >
          <HelpCircle className="h-4 w-4" />
          Get Help
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  isSearchEmpty?: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
}

function EmptyState({
  isSearchEmpty,
  searchQuery,
  onClearSearch,
}: EmptyStateProps): React.ReactElement {
  if (isSearchEmpty && searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No members found</h3>
        <p className="text-gray-500 text-sm mb-4">
          No members match your search for "{searchQuery}"
        </p>
        {onClearSearch && (
          <button
            onClick={onClearSearch}
            className="
              inline-flex items-center gap-2 px-4 py-2
              text-sm font-medium text-teal-600
              bg-teal-50 hover:bg-teal-100
              rounded-md
              focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
              transition-colors duration-150
            "
          >
            <X className="h-4 w-4" />
            Clear Search
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Users className="h-12 w-12 text-gray-300 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No members in directory</h3>
      <p className="text-gray-500 text-sm max-w-md">
        No members have opted into the member directory yet. Members can choose to make their
        profile visible in their settings.
      </p>
    </div>
  );
}

// ============================================================================
// Search Input
// ============================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search members...',
}: SearchInputProps): React.ReactElement {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value with prop
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleClear = () => {
    setLocalValue('');
    onClear();
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-md">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-10 py-2
          text-sm
          border border-gray-300 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500
          placeholder:text-gray-400
        "
        aria-label="Search members"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="
            absolute right-3 top-1/2 -translate-y-1/2
            p-1 rounded-full
            text-gray-400 hover:text-gray-600 hover:bg-gray-100
            focus:outline-none focus:ring-2 focus:ring-teal-500
          "
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Pagination Controls
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  isLoading?: boolean;
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange: _onPageChange,
  onPrevPage,
  onNextPage,
  isLoading,
}: PaginationProps): React.ReactElement {
  if (totalPages <= 1) return <></>;

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <button
        onClick={onPrevPage}
        disabled={currentPage === 0 || isLoading}
        className="
          inline-flex items-center gap-1 px-3 py-2
          text-sm font-medium
          text-gray-700 bg-white border border-gray-300
          rounded-md
          hover:bg-gray-50
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
        "
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </button>

      <span className="px-4 py-2 text-sm text-gray-600">
        Page {currentPage + 1} of {totalPages}
      </span>

      <button
        onClick={onNextPage}
        disabled={currentPage >= totalPages - 1 || isLoading}
        className="
          inline-flex items-center gap-1 px-3 py-2
          text-sm font-medium
          text-gray-700 bg-white border border-gray-300
          rounded-md
          hover:bg-gray-50
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
        "
        aria-label="Next page"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

// ============================================================================
// Member Avatar
// ============================================================================

interface MemberAvatarProps {
  member: MemberProfile;
  size?: 'sm' | 'md' | 'lg';
}

function MemberAvatar({ member, size = 'md' }: MemberAvatarProps): React.ReactElement {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-20 w-20 text-xl',
  };

  if (member.avatar) {
    return (
      <img
        src={member.avatar}
        alt={`${member.displayName}'s avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full
        bg-gradient-to-br from-teal-400 to-teal-600
        flex items-center justify-center
        text-white font-medium
      `}
      aria-label={`${member.displayName}'s initials`}
    >
      {getInitials(member.displayName)}
    </div>
  );
}

// ============================================================================
// Member Card
// ============================================================================

interface MemberCardProps {
  member: MemberProfile;
  onClick: () => void;
  contactStatus?: ContactStatus | null;
  isCurrentUser?: boolean;
}

function MemberCard({
  member,
  onClick,
  contactStatus,
  isCurrentUser,
}: MemberCardProps): React.ReactElement {
  const archetypeColorClass = member.archetype ? getArchetypeColor(member.archetype) : '';

  return (
    <button
      onClick={onClick}
      className="
        w-full p-4 text-left
        bg-white border border-gray-200 rounded-lg
        hover:border-teal-300 hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
        transition-all duration-150
      "
    >
      {/* Header with avatar and name */}
      <div className="flex items-start gap-3 mb-3">
        <MemberAvatar member={member} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            {member.displayName}
            {isCurrentUser && <span className="ml-2 text-xs text-teal-600">(You)</span>}
          </h3>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Member since {formatMemberSince(member.memberSince)}
          </p>
        </div>
      </div>

      {/* Archetype badge */}
      {member.archetype && (
        <span
          className={`
          inline-flex items-center gap-1 px-2 py-1 mb-2
          text-xs font-medium rounded-full
          ${archetypeColorClass}
        `}
        >
          <Shield className="h-3 w-3" />
          {member.archetype}
        </span>
      )}

      {/* Bio snippet */}
      {member.bio && <p className="text-sm text-gray-600 line-clamp-2 mb-2">{member.bio}</p>}

      {/* Contact status indicator */}
      {contactStatus && !isCurrentUser && (
        <div
          className={`
          inline-flex items-center gap-1 px-2 py-1
          text-xs font-medium rounded-full
          ${getContactStatusColor(contactStatus)}
        `}
        >
          {contactStatus === 'pending' && <Clock className="h-3 w-3" />}
          {contactStatus === 'approved' && <Check className="h-3 w-3" />}
          {contactStatus === 'rejected' && <XCircle className="h-3 w-3" />}
          {contactStatus.charAt(0).toUpperCase() + contactStatus.slice(1)}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Member Detail Modal
// ============================================================================

interface MemberDetailProps {
  member: MemberProfile;
  onClose: () => void;
  onContact?: () => void;
  contactStatus?: ContactStatus | null;
  isCurrentUser?: boolean;
}

function MemberDetail({
  member,
  onClose,
  onContact,
  contactStatus,
  isCurrentUser,
}: MemberDetailProps): React.ReactElement {
  const archetypeColorClass = member.archetype ? getArchetypeColor(member.archetype) : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-detail-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-4">
            <MemberAvatar member={member} size="lg" />
            <div className="flex-1">
              <h2 id="member-detail-title" className="text-xl font-semibold text-gray-900">
                {member.displayName}
                {isCurrentUser && (
                  <span className="ml-2 text-sm text-teal-600 font-normal">(You)</span>
                )}
              </h2>
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <Calendar className="h-4 w-4" />
                Member since {formatMemberSince(member.memberSince)}
              </p>
              {member.archetype && (
                <span
                  className={`
                  inline-flex items-center gap-1 px-2 py-1 mt-2
                  text-xs font-medium rounded-full
                  ${archetypeColorClass}
                `}
                >
                  <Shield className="h-3 w-3" />
                  {member.archetype}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="
                p-2 text-gray-400 hover:text-gray-600
                rounded-full hover:bg-gray-100
                focus:outline-none focus:ring-2 focus:ring-teal-500
              "
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Bio */}
          {member.bio && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">About</h3>
              <p className="text-gray-600">{member.bio}</p>
            </div>
          )}

          {/* Visibility */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {member.visibility === 'public' ? (
              <>
                <Eye className="h-4 w-4" />
                Public profile
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                Members only
              </>
            )}
          </div>

          {/* Edit Profile for own profile */}
          {isCurrentUser && (
            <div className="pt-4 border-t border-gray-100">
              <Link
                to="/settings?tab=privacy"
                className="
                  w-full inline-flex items-center justify-center gap-2 px-4 py-2
                  text-sm font-medium text-white
                  bg-teal-600 hover:bg-teal-700
                  rounded-md
                  focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
                  transition-colors duration-150
                "
              >
                <Settings className="h-4 w-4" />
                Edit Profile Settings
              </Link>
            </div>
          )}

          {/* Contact status or action */}
          {!isCurrentUser && (
            <div className="pt-4 border-t border-gray-100">
              {contactStatus === 'approved' ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Connected</span>
                </div>
              ) : contactStatus === 'pending' ? (
                <div className="flex items-center gap-2 text-yellow-600">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">Contact request pending</span>
                </div>
              ) : contactStatus === 'rejected' ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">Contact request declined</span>
                </div>
              ) : (
                <button
                  onClick={onContact}
                  className="
                    w-full inline-flex items-center justify-center gap-2 px-4 py-2
                    text-sm font-medium text-white
                    bg-teal-600 hover:bg-teal-700
                    rounded-md
                    focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
                    transition-colors duration-150
                  "
                >
                  <MessageCircle className="h-4 w-4" />
                  Send Contact Request
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Contact Request Modal
// ============================================================================

interface ContactRequestModalProps {
  recipientName: string;
  onSend: (message: string) => Promise<void>;
  onClose: () => void;
  isSending: boolean;
}

function ContactRequestModal({
  recipientName,
  onSend,
  onClose,
  isSending,
}: ContactRequestModalProps): React.ReactElement {
  const [message, setMessage] = useState('');
  const maxLength = 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      await onSend(message.trim());
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 id="contact-modal-title" className="text-lg font-semibold text-gray-900">
              Contact {recipientName}
            </h2>
            <button
              onClick={onClose}
              disabled={isSending}
              className="
                p-2 text-gray-400 hover:text-gray-600
                rounded-full hover:bg-gray-100
                focus:outline-none focus:ring-2 focus:ring-teal-500
                disabled:opacity-50
              "
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="contact-message"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Introduce yourself
            </label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi! I'd like to connect with you about..."
              maxLength={maxLength}
              rows={4}
              className="
                w-full px-3 py-2
                text-sm
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500
                placeholder:text-gray-400
                resize-none
              "
              disabled={isSending}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {message.length}/{maxLength}
            </p>
          </div>

          <p className="text-sm text-gray-500">
            Your message will be sent as a contact request. {recipientName} can choose to accept or
            decline.
          </p>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="
                px-4 py-2
                text-sm font-medium text-gray-700
                bg-gray-100 hover:bg-gray-200
                rounded-md
                focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                disabled:opacity-50
                transition-colors duration-150
              "
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!message.trim() || isSending}
              className="
                inline-flex items-center gap-2 px-4 py-2
                text-sm font-medium text-white
                bg-teal-600 hover:bg-teal-700
                rounded-md
                focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-150
              "
            >
              {isSending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface MemberDirectoryProps {
  /** Current user's principal (for identifying own profile) */
  userPrincipal?: string;
  /** Additional CSS class */
  className?: string;
}

export function MemberDirectory({
  userPrincipal,
  className = '',
}: MemberDirectoryProps): React.ReactElement {
  // Member directory hook
  const {
    memberState,
    filteredMembers,
    searchQuery,
    selectedMember,
    currentPage,
    totalPages,
    isLoading,
    isRefreshing,
    refresh,
    goToPage,
    nextPage,
    prevPage,
    setSearch,
    clearSearch,
    selectMember,
  } = useMemberDirectory();

  // Contact requests hook
  const {
    isModalOpen: isContactModalOpen,
    recipientPrincipal,
    isSending,
    getStatusFor,
    openModal: openContactModal,
    closeModal: closeContactModal,
    send: sendContactRequest,
  } = useContactRequests({ userPrincipal });

  // Track when component loads
  const hasTrackedLoad = useRef(false);
  useEffect(() => {
    if (!hasTrackedLoad.current && memberState.lastUpdated) {
      hasTrackedLoad.current = true;
      trackEvent('member_directory_loaded', {
        member_count: memberState.totalCount,
        page_count: totalPages,
      });
    }
  }, [memberState.lastUpdated, memberState.totalCount, totalPages]);

  // Track search
  const searchTrackedRef = useRef<string>('');
  useEffect(() => {
    if (searchQuery && searchQuery !== searchTrackedRef.current) {
      searchTrackedRef.current = searchQuery;
      trackEvent('member_search_performed', {
        query_length: searchQuery.length,
        result_count: filteredMembers.length,
      });
    }
  }, [searchQuery, filteredMembers.length]);

  // Handle member selection
  const handleMemberClick = useCallback(
    (member: MemberProfile) => {
      selectMember(member);
      trackEvent('member_profile_viewed', {
        member_id: member.principal,
        has_archetype: !!member.archetype,
      });
    },
    [selectMember]
  );

  // Handle contact request
  const handleContactRequest = useCallback(() => {
    if (selectedMember) {
      openContactModal(selectedMember.principal);
    }
  }, [selectedMember, openContactModal]);

  // Handle send contact request
  const handleSendContact = useCallback(
    async (message: string) => {
      await sendContactRequest(message);
      // Modal closes automatically on success
    },
    [sendContactRequest]
  );

  // Get recipient name for modal
  const recipientMember = filteredMembers.find((m) => m.principal === recipientPrincipal);

  // Loading state
  if (isLoading && !memberState.lastUpdated) {
    return (
      <div className={`member-directory ${className}`}>
        <MemberSkeleton />
      </div>
    );
  }

  // Error state
  if (memberState.error && !memberState.lastUpdated) {
    return (
      <div className={`member-directory ${className}`}>
        <ErrorState error={memberState.error} onRetry={refresh} isRetrying={isRefreshing} />
      </div>
    );
  }

  // Empty state (no members at all)
  if (!memberState.members.length && !searchQuery) {
    return (
      <div className={`member-directory ${className}`}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={`member-directory ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-teal-600" />
            Member Directory
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {memberState.totalCount} member{memberState.totalCount !== 1 ? 's' : ''} in directory
          </p>
        </div>

        {/* Refresh button */}
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="
            inline-flex items-center gap-2 px-4 py-2
            text-sm font-medium text-gray-700
            bg-white border border-gray-300
            rounded-md
            hover:bg-gray-50
            disabled:opacity-50
            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
            transition-colors duration-150
          "
          aria-label="Refresh member list"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchInput
          value={searchQuery}
          onChange={setSearch}
          onClear={clearSearch}
          placeholder="Search by name, archetype, or bio..."
        />
      </div>

      {/* Search empty state */}
      {searchQuery && filteredMembers.length === 0 ? (
        <EmptyState isSearchEmpty searchQuery={searchQuery} onClearSearch={clearSearch} />
      ) : (
        <>
          {/* Member grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.principal}
                member={member}
                onClick={() => handleMemberClick(member)}
                contactStatus={getStatusFor(member.principal)}
                isCurrentUser={member.principal === userPrincipal}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            onPrevPage={prevPage}
            onNextPage={nextPage}
            isLoading={isLoading}
          />
        </>
      )}

      {/* Member detail modal */}
      {selectedMember && (
        <MemberDetail
          member={selectedMember}
          onClose={() => selectMember(null)}
          onContact={handleContactRequest}
          contactStatus={getStatusFor(selectedMember.principal)}
          isCurrentUser={selectedMember.principal === userPrincipal}
        />
      )}

      {/* Contact request modal */}
      {isContactModalOpen && recipientMember && (
        <ContactRequestModal
          recipientName={recipientMember.displayName}
          onSend={handleSendContact}
          onClose={closeContactModal}
          isSending={isSending}
        />
      )}
    </div>
  );
}

export default MemberDirectory;
