/**
 * Notification State Management
 *
 * Manages in-app notifications for governance events using nanostores.
 * Follows the drafts.ts pattern for localStorage with corruption recovery,
 * quota handling, and cross-tab sync.
 *
 * Story: 9-1-7-governance-notifications
 * ACs: 1, 2, 3, 4
 */

import { atom, computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';

// ============================================================================
// Types
// ============================================================================

/**
 * Notification types for governance events
 */
export type NotificationType =
  | 'vote_result'
  | 'new_proposal'
  | 'voting_ending_24h'
  | 'voting_ending_1h';

/**
 * Notification metadata for navigation and display
 */
export interface NotificationMetadata {
  /** Proposal ID for navigation */
  proposalId?: string;
  /** Proposal title for display (may be hidden per privacy settings) */
  proposalTitle?: string;
  /** Result for vote_result type */
  result?: 'passed' | 'failed';
}

/**
 * Notification object
 */
export interface Notification {
  /** Unique identifier */
  id: string;
  /** Notification type */
  type: NotificationType;
  /** Display message */
  message: string;
  /** Read status */
  read: boolean;
  /** Unix timestamp when created */
  createdAt: number;
  /** Additional metadata for navigation and display */
  metadata: NotificationMetadata;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  /** Master toggle for all notifications */
  enabled: boolean;
  /** Notify on vote results */
  vote_result: boolean;
  /** Notify on new proposals */
  new_proposal: boolean;
  /** Notify on voting deadlines (24h and 1h) */
  voting_ending: boolean;
  /** Hide proposal titles in notifications for privacy */
  hideProposalTitles: boolean;
  /** Schema version for migration */
  schemaVersion: number;
}

// ============================================================================
// Configuration
// ============================================================================

/** Current schema version for preferences migration */
export const PREFERENCES_SCHEMA_VERSION = 1;

/** Maximum notifications to keep */
export const MAX_NOTIFICATIONS = 50;

/** Maximum notifications per type per hour (rate limiting) */
export const MAX_NOTIFICATIONS_PER_TYPE_PER_HOUR = 5;

/** Storage keys */
const NOTIFICATIONS_STORAGE_KEY = 'hwdao:notifications-v1';
const PREFERENCES_STORAGE_KEY = 'hwdao:notification-preferences-v1';
const LAST_SEEN_PROPOSAL_KEY = 'hwdao:last-seen-proposal-id';
const RATE_LIMIT_KEY = 'hwdao:notification-rate-limits';

/** Default preferences */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  vote_result: true,
  new_proposal: true,
  voting_ending: true,
  hideProposalTitles: false,
  schemaVersion: PREFERENCES_SCHEMA_VERSION,
};

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitRecord {
  [type: string]: number[]; // Array of timestamps
}

/**
 * Get rate limit record from localStorage
 */
function getRateLimitRecord(): RateLimitRecord {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RateLimitRecord;
  } catch {
    return {};
  }
}

/**
 * Check if notification type is rate limited
 */
function isRateLimited(type: NotificationType): boolean {
  const record = getRateLimitRecord();
  const timestamps = record[type] || [];
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentCount = timestamps.filter((t) => t > oneHourAgo).length;
  return recentCount >= MAX_NOTIFICATIONS_PER_TYPE_PER_HOUR;
}

/**
 * Record a notification for rate limiting
 */
function recordNotificationForRateLimit(type: NotificationType): void {
  try {
    const record = getRateLimitRecord();
    const timestamps = record[type] || [];
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    // Keep only recent timestamps and add new one
    const filtered = timestamps.filter((t) => t > oneHourAgo);
    filtered.push(Date.now());
    record[type] = filtered;
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage errors for rate limiting
  }
}

// ============================================================================
// Safe localStorage Operations
// ============================================================================

/**
 * Safely save notifications to localStorage with quota handling
 * @returns true if saved successfully, false if quota exceeded
 */
function safeSaveNotifications(notifications: Notification[]): boolean {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded for notifications');
      // Try to prune more aggressively
      const pruned = notifications.slice(-Math.floor(MAX_NOTIFICATIONS / 2));
      try {
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(pruned));
        return true;
      } catch {
        console.error('Still quota exceeded after pruning');
        return false;
      }
    }
    console.error('Failed to save notifications:', error);
    return false;
  }
}

// ============================================================================
// Preferences Schema Migration
// ============================================================================

/**
 * Migrate preferences to current schema version
 */
function migratePreferencesSchema(
  prefs: Partial<NotificationPreferences>
): NotificationPreferences {
  return {
    enabled: prefs.enabled ?? DEFAULT_PREFERENCES.enabled,
    vote_result: prefs.vote_result ?? DEFAULT_PREFERENCES.vote_result,
    new_proposal: prefs.new_proposal ?? DEFAULT_PREFERENCES.new_proposal,
    voting_ending: prefs.voting_ending ?? DEFAULT_PREFERENCES.voting_ending,
    hideProposalTitles: prefs.hideProposalTitles ?? DEFAULT_PREFERENCES.hideProposalTitles,
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
  };
}

/**
 * Safely get preferences from localStorage with migration
 */
function safeGetPreferences(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    // Migrate if needed
    if (parsed.schemaVersion !== PREFERENCES_SCHEMA_VERSION) {
      const migrated = migratePreferencesSchema(parsed);
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return migratePreferencesSchema(parsed);
  } catch (error) {
    console.error('Preferences storage corrupted, using defaults:', error);
    try {
      localStorage.removeItem(PREFERENCES_STORAGE_KEY);
    } catch {
      // Ignore removal errors
    }
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Safely save preferences to localStorage
 */
function safeSavePreferences(prefs: NotificationPreferences): boolean {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch (error) {
    console.error('Failed to save notification preferences:', error);
    return false;
  }
}

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Main notifications store - ephemeral (doesn't persist across page refresh by design)
 * Uses manual localStorage for cross-tab sync only
 */
export const $notifications = atom<Notification[]>([]);

/**
 * Notification preferences - persists across sessions
 */
export const $notificationPreferences = atom<NotificationPreferences>(safeGetPreferences());

/**
 * Last seen proposal ID for detecting new proposals
 */
export const $lastSeenProposalId = persistentAtom<string>(LAST_SEEN_PROPOSAL_KEY, '');

/**
 * Computed: Unread notification count
 */
export const $unreadCount = computed($notifications, (notifications) => {
  return notifications.filter((n) => !n.read).length;
});

/**
 * Computed: Visible notifications (sorted by createdAt, newest first)
 */
export const $visibleNotifications = computed($notifications, (notifications) => {
  return [...notifications].sort((a, b) => b.createdAt - a.createdAt);
});

/**
 * Computed: Recent notifications (max 10 for dropdown)
 */
export const $recentNotifications = computed($visibleNotifications, (notifications) => {
  return notifications.slice(0, 10);
});

/**
 * Save error state for UI feedback
 */
export const $notificationSaveError = atom<string | null>(null);

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate unique notification ID
 */
function generateNotificationId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Add a notification
 * @param type - Notification type
 * @param message - Display message
 * @param metadata - Additional metadata
 * @returns The created notification or null if rate limited
 */
export function addNotification(
  type: NotificationType,
  message: string,
  metadata: NotificationMetadata = {}
): Notification | null {
  // Check preferences
  const prefs = $notificationPreferences.get();
  if (!prefs.enabled) return null;

  // Check type-specific preferences
  if (type === 'vote_result' && !prefs.vote_result) return null;
  if (type === 'new_proposal' && !prefs.new_proposal) return null;
  if ((type === 'voting_ending_24h' || type === 'voting_ending_1h') && !prefs.voting_ending) {
    return null;
  }

  // Check rate limit
  if (isRateLimited(type)) {
    console.warn(`Rate limited: ${type}`);
    return null;
  }

  // Apply privacy setting
  let displayMessage = message;
  if (prefs.hideProposalTitles && metadata.proposalTitle) {
    displayMessage = message.replace(metadata.proposalTitle, '[Hidden]');
  }

  const notification: Notification = {
    id: generateNotificationId(),
    type,
    message: displayMessage,
    read: false,
    createdAt: Date.now(),
    metadata,
  };

  let notifications = $notifications.get();

  // Check for duplicates (same proposal + type within last hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const isDuplicate = notifications.some(
    (n) =>
      n.type === type &&
      n.metadata.proposalId === metadata.proposalId &&
      n.createdAt > oneHourAgo
  );

  if (isDuplicate) {
    console.warn('Duplicate notification suppressed:', type, metadata.proposalId);
    return null;
  }

  // Add notification
  notifications = [notification, ...notifications];

  // Prune if over limit
  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications = notifications.slice(0, MAX_NOTIFICATIONS);
  }

  $notifications.set(notifications);
  safeSaveNotifications(notifications);
  recordNotificationForRateLimit(type);
  $notificationSaveError.set(null);

  return notification;
}

/**
 * Mark a notification as read
 * @param id - Notification ID
 */
export function markAsRead(id: string): void {
  const notifications = $notifications.get();
  const updated = notifications.map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
  $notifications.set(updated);
  safeSaveNotifications(updated);
}

/**
 * Mark all notifications as read
 */
export function markAllRead(): void {
  const notifications = $notifications.get();
  const updated = notifications.map((n) => ({ ...n, read: true }));
  $notifications.set(updated);
  safeSaveNotifications(updated);
}

/**
 * Remove a notification
 * @param id - Notification ID
 */
export function removeNotification(id: string): void {
  const notifications = $notifications.get();
  const updated = notifications.filter((n) => n.id !== id);
  $notifications.set(updated);
  safeSaveNotifications(updated);
}

/**
 * Clear all notifications
 */
export function clearNotifications(): void {
  $notifications.set([]);
  try {
    localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
  } catch {
    // Ignore removal errors
  }
}

/**
 * Update notification preferences
 * @param updates - Partial preferences to update
 */
export function updateNotificationPreferences(
  updates: Partial<Omit<NotificationPreferences, 'schemaVersion'>>
): void {
  const current = $notificationPreferences.get();
  const updated = {
    ...current,
    ...updates,
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
  };
  $notificationPreferences.set(updated);
  safeSavePreferences(updated);
}

/**
 * Reset preferences to defaults
 */
export function resetNotificationPreferences(): void {
  $notificationPreferences.set({ ...DEFAULT_PREFERENCES });
  safeSavePreferences(DEFAULT_PREFERENCES);
}

/**
 * Clear the notification save error
 */
export function clearNotificationSaveError(): void {
  $notificationSaveError.set(null);
}

/**
 * Get notification by ID
 * @param id - Notification ID
 */
export function getNotification(id: string): Notification | null {
  const notifications = $notifications.get();
  return notifications.find((n) => n.id === id) ?? null;
}

// ============================================================================
// Cross-Tab Sync
// ============================================================================

/**
 * Set up cross-tab sync for notifications
 * @returns Cleanup function to remove listener
 */
export function setupNotificationsCrossTabSync(): () => void {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === NOTIFICATIONS_STORAGE_KEY && e.newValue !== null) {
      try {
        const newNotifications = JSON.parse(e.newValue) as Notification[];
        if (Array.isArray(newNotifications)) {
          $notifications.set(newNotifications);
        }
      } catch (error) {
        console.error('Failed to sync notifications from other tab:', error);
      }
    }

    if (e.key === PREFERENCES_STORAGE_KEY && e.newValue !== null) {
      try {
        const newPrefs = JSON.parse(e.newValue) as NotificationPreferences;
        $notificationPreferences.set(migratePreferencesSchema(newPrefs));
      } catch (error) {
        console.error('Failed to sync preferences from other tab:', error);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}

// ============================================================================
// Helper Functions for Notification Generation
// ============================================================================

/**
 * Create a vote result notification
 */
export function createVoteResultNotification(
  proposalId: string,
  proposalTitle: string,
  passed: boolean
): Notification | null {
  const result = passed ? 'passed' : 'failed';
  const message = `Proposal "${proposalTitle}" has ${result}`;
  return addNotification('vote_result', message, {
    proposalId,
    proposalTitle,
    result,
  });
}

/**
 * Create a new proposal notification
 */
export function createNewProposalNotification(
  proposalId: string,
  proposalTitle: string
): Notification | null {
  const message = `New proposal: "${proposalTitle}"`;
  return addNotification('new_proposal', message, {
    proposalId,
    proposalTitle,
  });
}

/**
 * Create a voting deadline notification
 */
export function createVotingDeadlineNotification(
  proposalId: string,
  proposalTitle: string,
  hoursRemaining: 24 | 1
): Notification | null {
  const type: NotificationType =
    hoursRemaining === 24 ? 'voting_ending_24h' : 'voting_ending_1h';
  const message =
    hoursRemaining === 24
      ? `Voting ends in 24 hours: "${proposalTitle}"`
      : `Voting ends in 1 hour: "${proposalTitle}"`;
  return addNotification(type, message, {
    proposalId,
    proposalTitle,
  });
}

// ============================================================================
// Export Actions Object
// ============================================================================

export const notificationActions = {
  add: addNotification,
  markAsRead,
  markAllRead,
  remove: removeNotification,
  clear: clearNotifications,
  get: getNotification,
  updatePreferences: updateNotificationPreferences,
  resetPreferences: resetNotificationPreferences,
  setupCrossTabSync: setupNotificationsCrossTabSync,
  // Helpers
  createVoteResult: createVoteResultNotification,
  createNewProposal: createNewProposalNotification,
  createVotingDeadline: createVotingDeadlineNotification,
};
