/**
 * Notifications Page
 *
 * Full page view of all notifications with filtering and bulk actions.
 *
 * Story: 9-1-7-governance-notifications
 * ACs: 1, 2, 3
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import {
  Bell,
  CheckCircle,
  FileText,
  Clock,
  AlertCircle,
  Check,
  Trash2,
  Filter,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  $visibleNotifications,
  $unreadCount,
  markAsRead,
  markAllRead,
  removeNotification,
  clearNotifications,
  type Notification,
  type NotificationType,
} from '@/stores';
import { showWarning, showSuccess } from '@/stores';
import { getProposalStatus } from '@/services/governanceCanister';

// ============================================================================
// Configuration
// ============================================================================

/** Items per page */
const ITEMS_PER_PAGE = 20;

// ============================================================================
// Filter Types
// ============================================================================

type FilterType = 'all' | 'unread' | NotificationType;

interface FilterOption {
  value: FilterType;
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'vote_result', label: 'Vote Results' },
  { value: 'new_proposal', label: 'New Proposals' },
  { value: 'voting_ending_24h', label: '24h Deadline' },
  { value: 'voting_ending_1h', label: '1h Deadline' },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format relative time
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

/**
 * Get type label for notification
 */
function getTypeLabel(type: NotificationType): string {
  switch (type) {
    case 'vote_result':
      return 'Vote Result';
    case 'new_proposal':
      return 'New Proposal';
    case 'voting_ending_24h':
      return '24h Deadline';
    case 'voting_ending_1h':
      return '1h Deadline';
    default:
      return 'Notification';
  }
}

// ============================================================================
// Notification Item Component
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onNavigate: (notification: Notification) => void;
  onRemove: (id: string) => void;
}

function NotificationItem({
  notification,
  onNavigate,
  onRemove,
}: NotificationItemProps): React.ReactElement {
  const Icon = getNotificationIcon(notification.type);
  const iconColor = getNotificationColor(notification.type);

  return (
    <div
      className={`
        p-4 border rounded-lg flex items-start gap-4
        transition-colors duration-150
        ${notification.read ? 'bg-white' : 'bg-blue-50/30 border-blue-100'}
      `}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {getTypeLabel(notification.type)}
          </span>
          {!notification.read && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              New
            </span>
          )}
        </div>
        <button
          onClick={() => onNavigate(notification)}
          className={`
            text-left w-full
            ${notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'}
            hover:text-teal-700 focus:outline-none focus:underline
          `}
        >
          {notification.message}
        </button>
        <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(notification.createdAt)}</p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {!notification.read && (
          <button
            onClick={() => markAsRead(notification.id)}
            className="p-1.5 text-gray-400 hover:text-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded"
            aria-label="Mark as read"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onRemove(notification.id)}
          className="p-1.5 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
          aria-label="Remove notification"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function NotificationsPage(): React.ReactElement {
  const navigate = useNavigate();
  const notifications = useStore($visibleNotifications);
  const unreadCount = useStore($unreadCount);

  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE));
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNotifications.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredNotifications, currentPage]);

  // Reset to page 1 when filter changes
  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  // Handle notification click with relevance validation
  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
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
    },
    [navigate]
  );

  // Handle remove notification
  const handleRemove = useCallback((id: string) => {
    removeNotification(id);
  }, []);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    clearNotifications();
    showSuccess('All notifications cleared');
    setShowClearConfirm(false);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-8 w-8 text-teal-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Notifications</h1>
                <p className="text-gray-600">
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                    : 'All caught up!'}
                </p>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllRead()}
                  className="flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleFilterChange(option.value)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium
                    transition-colors duration-150
                    ${
                      filter === option.value
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card>
          <CardContent className="p-0">
            {filteredNotifications.length === 0 ? (
              <div className="p-12 text-center">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" aria-hidden="true" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No notifications</h3>
                <p className="text-gray-500">
                  {filter === 'all'
                    ? "You don't have any notifications yet"
                    : `No ${filter === 'unread' ? 'unread' : ''} notifications match your filter`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {paginatedNotifications.map((notification) => (
                  <div key={notification.id} className="p-4">
                    <NotificationItem
                      notification={notification}
                      onNavigate={handleNotificationClick}
                      onRemove={handleRemove}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}

        {/* Clear All Section */}
        {notifications.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            {showClearConfirm ? (
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-red-800">
                    Are you sure you want to clear all notifications? This cannot be undone.
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleClearAll}>
                      Clear All
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowClearConfirm(true)}
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Notifications
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
