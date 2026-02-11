/**
 * Notification Bell Component
 *
 * Bell icon with unread count badge and dropdown showing recent notifications.
 * Integrates with notification state management and polling service.
 *
 * Story: 9-1-7-governance-notifications
 * ACs: 1, 2, 3
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import { Popover } from '@headlessui/react';
import { Bell, CheckCircle, AlertCircle, Clock, FileText, Check, ExternalLink } from 'lucide-react';
import {
  $recentNotifications,
  $unreadCount,
  markAsRead,
  markAllRead,
  type Notification,
  type NotificationType,
} from '@/stores';
import { showWarning } from '@/stores';
import { getProposalStatus } from '../services/governanceCanister';
import { trackNotificationClicked, trackNotificationsMarkedRead } from '../utils/analytics';

// ============================================================================
// Configuration
// ============================================================================

/** Maximum badge number to display */
const MAX_BADGE_DISPLAY = 99;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format relative time (e.g., "2 hours ago", "5 minutes ago")
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: NotificationType): React.ComponentType<{ className?: string }> {
  switch (type) {
    case 'vote_result':
      return CheckCircle;
    case 'new_proposal':
      return FileText;
    case 'voting_ending_24h':
    case 'voting_ending_1h':
      return Clock;
    default:
      return AlertCircle;
  }
}

/**
 * Get icon color for notification type
 */
function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case 'vote_result':
      return 'text-green-500';
    case 'new_proposal':
      return 'text-blue-500';
    case 'voting_ending_24h':
      return 'text-yellow-500';
    case 'voting_ending_1h':
      return 'text-orange-500';
    default:
      return 'text-gray-500';
  }
}

// ============================================================================
// Notification Item Component
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onNavigate: (notification: Notification) => void;
}

function NotificationItem({ notification, onNavigate }: NotificationItemProps): React.ReactElement {
  const Icon = getNotificationIcon(notification.type);
  const iconColor = getNotificationColor(notification.type);

  return (
    <button
      onClick={() => onNavigate(notification)}
      className={`
        w-full px-4 py-3 flex items-start gap-3 text-left
        hover:bg-gray-50 transition-colors duration-150
        ${notification.read ? 'opacity-60' : 'bg-blue-50/30'}
      `}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`
            text-sm truncate
            ${notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'}
          `}
        >
          {notification.message}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{formatTimeAgo(notification.createdAt)}</p>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="flex-shrink-0">
          <div className="h-2 w-2 bg-blue-500 rounded-full" aria-hidden="true" />
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface NotificationBellProps {
  /** Optional className for container */
  className?: string;
}

export function NotificationBell({ className = '' }: NotificationBellProps): React.ReactElement {
  const navigate = useNavigate();
  const notifications = useStore($recentNotifications);
  const unreadCount = useStore($unreadCount);

  const [isAnimating, setIsAnimating] = useState(false);
  const previousUnreadRef = useRef(unreadCount);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Animate bell when new notification arrives
  useEffect(() => {
    if (unreadCount > previousUnreadRef.current) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
    previousUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Handle notification click with relevance validation
  const handleNotificationClick = useCallback(
    async (notification: Notification, close: () => void) => {
      // Track click
      trackNotificationClicked(
        notification.type,
        notification.metadata.proposalId,
        notification.read
      );

      // Mark as read
      markAsRead(notification.id);

      // If it has a proposal ID, validate relevance before navigating
      if (notification.metadata.proposalId) {
        try {
          const status = await getProposalStatus(notification.metadata.proposalId);

          // Check if proposal is still relevant for deadline notifications
          if (
            (notification.type === 'voting_ending_24h' ||
              notification.type === 'voting_ending_1h') &&
            status?.status !== 'active'
          ) {
            showWarning('This voting window has already ended.', {
              title: 'Proposal Expired',
            });
          } else {
            navigate(`/proposals/${notification.metadata.proposalId}`);
          }
        } catch {
          // On error, navigate anyway
          navigate(`/proposals/${notification.metadata.proposalId}`);
        }
      }

      close();
    },
    [navigate]
  );

  // Handle mark all read with analytics
  const handleMarkAllRead = useCallback(() => {
    trackNotificationsMarkedRead(unreadCount, true);
    markAllRead();
  }, [unreadCount]);

  // Format badge display
  const badgeText =
    unreadCount > MAX_BADGE_DISPLAY ? `${MAX_BADGE_DISPLAY}+` : unreadCount.toString();

  return (
    <Popover className={`relative ${className}`}>
      {({ open, close }) => (
        <>
          {/* Bell button */}
          <Popover.Button
            ref={buttonRef}
            className={`
              relative p-2 rounded-full
              text-gray-600 hover:text-gray-900 hover:bg-gray-100
              focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
              transition-colors duration-150
              ${isAnimating ? 'animate-wiggle' : ''}
            `}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell className={`h-6 w-6 ${open ? 'text-teal-600' : ''}`} aria-hidden="true" />

            {/* Unread badge */}
            {unreadCount > 0 && (
              <span
                className={`
                  absolute -top-0.5 -right-0.5
                  flex items-center justify-center
                  min-w-[20px] h-5 px-1
                  text-xs font-bold text-white
                  bg-red-500 rounded-full
                  ${isAnimating ? 'animate-pulse' : ''}
                `}
                aria-hidden="true"
              >
                {badgeText}
              </span>
            )}
          </Popover.Button>

          {/* Dropdown panel */}
          <Popover.Panel
            className={`
              absolute right-0 z-50 mt-2
              w-80 max-h-[480px]
              bg-white rounded-lg shadow-lg ring-1 ring-black/5
              overflow-hidden
              transform origin-top-right
              ${open ? 'animate-dropdownOpen' : ''}
            `}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Escape') {
                close();
                buttonRef.current?.focus();
              }
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="
                    text-xs text-teal-600 hover:text-teal-800
                    font-medium flex items-center gap-1
                    focus:outline-none focus:underline
                  "
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto max-h-[340px] divide-y divide-gray-100">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-gray-500">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onNavigate={(n) => handleNotificationClick(n, close)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => {
                    navigate('/notifications');
                    close();
                  }}
                  className="
                    w-full text-center text-sm text-teal-600 hover:text-teal-800
                    font-medium flex items-center justify-center gap-1
                    focus:outline-none focus:underline
                  "
                >
                  View all notifications
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            )}
          </Popover.Panel>
        </>
      )}
    </Popover>
  );
}

export default NotificationBell;
