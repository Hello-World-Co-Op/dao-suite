/**
 * Notification State Tests
 *
 * Story: 9-1-7-governance-notifications
 * AC: 1, 2, 3, 4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  $notifications,
  $notificationPreferences,
  $unreadCount,
  $visibleNotifications,
  $recentNotifications,
  addNotification,
  markAsRead,
  markAllRead,
  removeNotification,
  clearNotifications,
  updateNotificationPreferences,
  resetNotificationPreferences,
  getNotification,
  createVoteResultNotification,
  createNewProposalNotification,
  createVotingDeadlineNotification,
  DEFAULT_PREFERENCES,
  MAX_NOTIFICATIONS,
  MAX_NOTIFICATIONS_PER_TYPE_PER_HOUR,
} from '@/stores';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('Notifications State', () => {
  beforeEach(() => {
    // Clear all atoms and localStorage
    $notifications.set([]);
    $notificationPreferences.set({ ...DEFAULT_PREFERENCES });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addNotification', () => {
    it('should add a notification', () => {
      const notification = addNotification('vote_result', 'Test message', {
        proposalId: 'prop-1',
      });

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe('vote_result');
      expect(notification?.message).toBe('Test message');
      expect(notification?.read).toBe(false);
      expect(notification?.metadata.proposalId).toBe('prop-1');
    });

    it('should generate unique IDs', () => {
      const n1 = addNotification('vote_result', 'Message 1', {});
      const n2 = addNotification('vote_result', 'Message 2', {});

      expect(n1?.id).not.toBe(n2?.id);
    });

    it('should update unread count', () => {
      expect($unreadCount.get()).toBe(0);

      addNotification('vote_result', 'Test', {});
      expect($unreadCount.get()).toBe(1);

      addNotification('new_proposal', 'Test 2', {});
      expect($unreadCount.get()).toBe(2);
    });

    it('should return null when notifications are disabled', () => {
      updateNotificationPreferences({ enabled: false });

      const notification = addNotification('vote_result', 'Test', {});
      expect(notification).toBeNull();
    });

    it('should return null when specific type is disabled', () => {
      updateNotificationPreferences({ vote_result: false });

      const notification = addNotification('vote_result', 'Test', {});
      expect(notification).toBeNull();
    });

    it('should prune old notifications when max is reached', () => {
      // Directly set notifications to bypass rate limiting
      // This tests the pruning logic, not the rate limiting
      const manyNotifications = Array.from({ length: MAX_NOTIFICATIONS + 5 }, (_, i) => ({
        id: `notif-${i}`,
        type: 'new_proposal' as const,
        message: `Message ${i}`,
        read: false,
        createdAt: Date.now() - i * 1000, // Stagger timestamps
        metadata: {},
      }));
      $notifications.set(manyNotifications);

      // Pruning happens on add, so trigger it
      addNotification('vote_result', 'Trigger prune', { proposalId: 'trigger' });

      // Should have pruned to MAX_NOTIFICATIONS
      expect($notifications.get().length).toBeLessThanOrEqual(MAX_NOTIFICATIONS);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', () => {
      const notification = addNotification('vote_result', 'Test', {});
      expect(notification?.read).toBe(false);

      markAsRead(notification!.id);

      const updated = getNotification(notification!.id);
      expect(updated?.read).toBe(true);
    });

    it('should update unread count', () => {
      const n1 = addNotification('vote_result', 'Test 1', { proposalId: 'unread-1' });
      addNotification('new_proposal', 'Test 2', { proposalId: 'unread-2' });
      expect($unreadCount.get()).toBe(2);

      markAsRead(n1!.id);
      expect($unreadCount.get()).toBe(1);
    });
  });

  describe('markAllRead', () => {
    it('should mark all notifications as read', () => {
      addNotification('vote_result', 'Test 1', { proposalId: 'markall-1' });
      addNotification('new_proposal', 'Test 2', { proposalId: 'markall-2' });
      addNotification('voting_ending_24h', 'Test 3', { proposalId: 'markall-3' });
      expect($unreadCount.get()).toBe(3);

      markAllRead();
      expect($unreadCount.get()).toBe(0);
    });
  });

  describe('removeNotification', () => {
    it('should remove a notification', () => {
      const notification = addNotification('vote_result', 'Test', { proposalId: 'remove-test' });
      expect($notifications.get().length).toBe(1);

      removeNotification(notification!.id);
      expect($notifications.get().length).toBe(0);
    });
  });

  describe('clearNotifications', () => {
    it('should clear all notifications', () => {
      addNotification('vote_result', 'Test 1', { proposalId: 'clear-1' });
      addNotification('new_proposal', 'Test 2', { proposalId: 'clear-2' });
      expect($notifications.get().length).toBe(2);

      clearNotifications();
      expect($notifications.get().length).toBe(0);
    });
  });

  describe('Computed atoms', () => {
    it('$visibleNotifications should return all notifications', () => {
      addNotification('vote_result', 'Test 1', { proposalId: 'p1' });
      addNotification('new_proposal', 'Test 2', { proposalId: 'p2' });

      expect($visibleNotifications.get().length).toBe(2);
    });

    it('$recentNotifications should return at most 10 notifications', () => {
      // Directly set notifications to bypass rate limiting
      const manyNotifications = Array.from({ length: 15 }, (_, i) => ({
        id: `recent-notif-${i}`,
        type: 'new_proposal' as const,
        message: `Message ${i}`,
        read: false,
        createdAt: Date.now() - i * 1000,
        metadata: {},
      }));
      $notifications.set(manyNotifications);

      expect($recentNotifications.get().length).toBe(10);
    });
  });

  describe('Preferences', () => {
    it('should update preferences', () => {
      updateNotificationPreferences({ vote_result: false });

      const prefs = $notificationPreferences.get();
      expect(prefs.vote_result).toBe(false);
      expect(prefs.new_proposal).toBe(true); // Unchanged
    });

    it('should reset preferences to defaults', () => {
      updateNotificationPreferences({ vote_result: false, new_proposal: false });

      resetNotificationPreferences();

      const prefs = $notificationPreferences.get();
      expect(prefs.vote_result).toBe(true);
      expect(prefs.new_proposal).toBe(true);
    });
  });

  describe('Helper functions', () => {
    it('createVoteResultNotification should create correct notification', () => {
      const notification = createVoteResultNotification('prop-1', 'Test Proposal', true);

      expect(notification?.type).toBe('vote_result');
      expect(notification?.message).toContain('Test Proposal');
      expect(notification?.message).toContain('passed');
      expect(notification?.metadata.proposalId).toBe('prop-1');
    });

    it('createNewProposalNotification should create correct notification', () => {
      const notification = createNewProposalNotification('prop-2', 'New Proposal');

      expect(notification?.type).toBe('new_proposal');
      expect(notification?.message).toContain('New Proposal');
      expect(notification?.metadata.proposalId).toBe('prop-2');
    });

    it('createVotingDeadlineNotification should create correct 24h notification', () => {
      const notification = createVotingDeadlineNotification('prop-3', 'Deadline Proposal', 24);

      expect(notification?.type).toBe('voting_ending_24h');
      expect(notification?.message).toContain('24 hours');
      expect(notification?.metadata.proposalId).toBe('prop-3');
    });

    it('createVotingDeadlineNotification should create correct 1h notification', () => {
      const notification = createVotingDeadlineNotification('prop-4', 'Urgent Proposal', 1);

      expect(notification?.type).toBe('voting_ending_1h');
      expect(notification?.message).toContain('1 hour');
      expect(notification?.metadata.proposalId).toBe('prop-4');
    });
  });

  describe('localStorage persistence', () => {
    it('should save notifications to localStorage', () => {
      addNotification('vote_result', 'Test', {});

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hwdao:notifications-v1',
        expect.any(String)
      );
    });

    it('should save preferences to localStorage', () => {
      updateNotificationPreferences({ vote_result: false });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hwdao:notification-preferences-v1',
        expect.any(String)
      );
    });
  });

  describe('Rate limiting', () => {
    it('should rate limit notifications of the same type', () => {
      // Add max notifications for this type with unique proposal IDs
      for (let i = 0; i < MAX_NOTIFICATIONS_PER_TYPE_PER_HOUR; i++) {
        const n = addNotification('new_proposal', `Unique message ${i} at ${Date.now()}`, {
          proposalId: `unique-prop-${i}`,
        });
        expect(n).not.toBeNull();
      }

      // Next one should be rate limited
      const rateLimited = addNotification('new_proposal', 'Rate limited message', {
        proposalId: 'rate-limited-prop',
      });
      expect(rateLimited).toBeNull();
    });

    it('should allow different types even when one is rate limited', () => {
      // Fill up new_proposal type with unique IDs
      for (let i = 0; i < MAX_NOTIFICATIONS_PER_TYPE_PER_HOUR; i++) {
        addNotification('new_proposal', `Message ${i}`, { proposalId: `prop-${i}` });
      }

      // vote_result should still work
      const notification = addNotification('vote_result', 'Vote result', {
        proposalId: 'vote-result-prop',
      });
      expect(notification).not.toBeNull();
    });
  });
});
