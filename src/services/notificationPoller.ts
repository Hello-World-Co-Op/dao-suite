/**
 * Notification Polling Service
 *
 * Polls governance canister for events that trigger notifications:
 * - New proposals
 * - Vote results on proposals user voted on
 * - Voting deadline warnings (24h, 1h)
 *
 * Story: 9-1-7-governance-notifications
 * ACs: 1, 2, 3
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import {
  $notificationPreferences,
  $lastSeenProposalId,
  createVoteResultNotification,
  createNewProposalNotification,
  createVotingDeadlineNotification,
  type NotificationPreferences,
} from '@/stores';
import { getProposals } from './governanceCanister';
import type { ProposalFilters, ProposalSort } from '@/stores';
import { trackNotificationReceived } from '../utils/analytics';

// ============================================================================
// Configuration
// ============================================================================

/** Polling interval in milliseconds (30 seconds) */
const POLLING_INTERVAL_MS = 30000;

/** Maximum backoff delay for retries (5 minutes) */
const MAX_BACKOFF_MS = 5 * 60 * 1000;

/** Initial backoff delay (1 second) */
const INITIAL_BACKOFF_MS = 1000;

/** Stale threshold for polling health (2 minutes) */
const STALE_THRESHOLD_MS = 2 * 60 * 1000;

/** 24 hours in milliseconds */
const HOURS_24_MS = 24 * 60 * 60 * 1000;

/** 1 hour in milliseconds */
const HOURS_1_MS = 60 * 60 * 1000;

/** Storage keys */
const VOTED_PROPOSALS_CACHE_KEY = 'hwdao:voted-proposal-ids-cache';
const DEADLINE_NOTIFICATIONS_KEY = 'hwdao:deadline-notifications-sent';

// ============================================================================
// Types
// ============================================================================

export interface PollerState {
  isPolling: boolean;
  lastPollAt: number | null;
  error: string | null;
  isStale: boolean;
  isCanisterAvailable: boolean;
}

interface DeadlineNotificationRecord {
  [proposalId: string]: {
    sent24h: boolean;
    sent1h: boolean;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get cached voted proposal IDs from localStorage
 */
function getCachedVotedProposalIds(): string[] {
  try {
    const raw = localStorage.getItem(VOTED_PROPOSALS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Cache voted proposal IDs to localStorage
 */
function cacheVotedProposalIds(ids: string[]): void {
  try {
    localStorage.setItem(VOTED_PROPOSALS_CACHE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get deadline notification records from localStorage
 */
function getDeadlineNotificationRecords(): DeadlineNotificationRecord {
  try {
    const raw = localStorage.getItem(DEADLINE_NOTIFICATIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DeadlineNotificationRecord;
  } catch {
    return {};
  }
}

/**
 * Mark deadline notification as sent
 */
function markDeadlineNotificationSent(proposalId: string, type: '24h' | '1h'): void {
  try {
    const records = getDeadlineNotificationRecords();
    if (!records[proposalId]) {
      records[proposalId] = { sent24h: false, sent1h: false };
    }
    if (type === '24h') {
      records[proposalId].sent24h = true;
    } else {
      records[proposalId].sent1h = true;
    }
    localStorage.setItem(DEADLINE_NOTIFICATIONS_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if deadline notification was already sent
 */
function wasDeadlineNotificationSent(proposalId: string, type: '24h' | '1h'): boolean {
  const records = getDeadlineNotificationRecords();
  const record = records[proposalId];
  if (!record) return false;
  return type === '24h' ? record.sent24h : record.sent1h;
}

/**
 * Clean up old deadline notification records (for ended proposals)
 */
function cleanupDeadlineRecords(activeProposalIds: Set<string>): void {
  try {
    const records = getDeadlineNotificationRecords();
    const cleaned: DeadlineNotificationRecord = {};
    for (const id of Object.keys(records)) {
      if (activeProposalIds.has(id)) {
        cleaned[id] = records[id];
      }
    }
    localStorage.setItem(DEADLINE_NOTIFICATIONS_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Polling State
// ============================================================================

/** Polling health state atom */
import { atom } from 'nanostores';

export const $pollerState = atom<PollerState>({
  isPolling: false,
  lastPollAt: null,
  error: null,
  isStale: false,
  isCanisterAvailable: true,
});

/**
 * Update poller state
 */
function updatePollerState(updates: Partial<PollerState>): void {
  const current = $pollerState.get();
  $pollerState.set({ ...current, ...updates });
}

// ============================================================================
// Polling Logic
// ============================================================================

/**
 * Check for new proposals and generate notifications
 */
async function checkNewProposals(preferences: NotificationPreferences): Promise<void> {
  if (!preferences.enabled || !preferences.new_proposal) return;

  try {
    const filters: ProposalFilters = {
      status: [],
      search: '',
      myProposals: false,
      notVoted: false,
    };
    const sort: ProposalSort = 'newest';

    const response = await getProposals(filters, sort, 1);
    const proposals = response.items;

    if (proposals.length === 0) return;

    const lastSeenId = $lastSeenProposalId.get();
    const newestProposal = proposals[0];

    // If we have a last seen ID, find all proposals newer than it
    if (lastSeenId) {
      const lastSeenIndex = proposals.findIndex((p) => p.id === lastSeenId);

      if (lastSeenIndex === -1) {
        // Last seen not in current page, assume newest is new
        const notification = createNewProposalNotification(newestProposal.id, newestProposal.title);
        if (notification) {
          trackNotificationReceived('new_proposal', newestProposal.id);
        }
      } else if (lastSeenIndex > 0) {
        // There are newer proposals
        const newProposals = proposals.slice(0, lastSeenIndex);
        for (const proposal of newProposals) {
          const notification = createNewProposalNotification(proposal.id, proposal.title);
          if (notification) {
            trackNotificationReceived('new_proposal', proposal.id);
          }
        }
      }
    }

    // Update last seen to newest
    $lastSeenProposalId.set(newestProposal.id);
  } catch (error) {
    console.error('Error checking for new proposals:', error);
  }
}

/**
 * Check for vote results on proposals user voted on
 */
async function checkVoteResults(
  preferences: NotificationPreferences,
  votedProposalIds: string[]
): Promise<void> {
  if (!preferences.enabled || !preferences.vote_result) return;
  if (votedProposalIds.length === 0) return;

  try {
    // Get all proposals to check status
    const filters: ProposalFilters = {
      status: ['Passed', 'Failed'],
      search: '',
      myProposals: false,
      notVoted: false,
    };

    const response = await getProposals(filters, 'newest', 1);
    const completedProposals = response.items;

    // Check if any voted proposals have completed
    for (const proposal of completedProposals) {
      if (votedProposalIds.includes(proposal.id)) {
        const passed = proposal.status === 'Passed';
        const notification = createVoteResultNotification(proposal.id, proposal.title, passed);
        if (notification) {
          trackNotificationReceived('vote_result', proposal.id);
        }
      }
    }
  } catch (error) {
    console.error('Error checking vote results:', error);
  }
}

/**
 * Check for voting deadlines and generate warnings
 */
async function checkVotingDeadlines(preferences: NotificationPreferences): Promise<void> {
  if (!preferences.enabled || !preferences.voting_ending) return;

  try {
    const filters: ProposalFilters = {
      status: ['Active'],
      search: '',
      myProposals: false,
      notVoted: false,
    };

    const response = await getProposals(filters, 'endingSoon', 1);
    const activeProposals = response.items;

    const now = Date.now();
    const activeIds = new Set(activeProposals.map((p) => p.id));

    // Cleanup old deadline records
    cleanupDeadlineRecords(activeIds);

    for (const proposal of activeProposals) {
      const timeUntilEnd = proposal.votingEndsAt - now;

      // Check 24h warning (between 23h and 24h remaining)
      if (
        timeUntilEnd > 0 &&
        timeUntilEnd <= HOURS_24_MS &&
        timeUntilEnd > HOURS_24_MS - POLLING_INTERVAL_MS * 2 &&
        !wasDeadlineNotificationSent(proposal.id, '24h')
      ) {
        const notification = createVotingDeadlineNotification(proposal.id, proposal.title, 24);
        if (notification) {
          trackNotificationReceived('voting_ending_24h', proposal.id);
        }
        markDeadlineNotificationSent(proposal.id, '24h');
      }

      // Check 1h warning (between 0 and 1h remaining)
      if (
        timeUntilEnd > 0 &&
        timeUntilEnd <= HOURS_1_MS &&
        timeUntilEnd > HOURS_1_MS - POLLING_INTERVAL_MS * 2 &&
        !wasDeadlineNotificationSent(proposal.id, '1h')
      ) {
        const notification = createVotingDeadlineNotification(proposal.id, proposal.title, 1);
        if (notification) {
          trackNotificationReceived('voting_ending_1h', proposal.id);
        }
        markDeadlineNotificationSent(proposal.id, '1h');
      }
    }
  } catch (error) {
    console.error('Error checking voting deadlines:', error);
  }
}

/**
 * Main polling function
 */
async function pollForNotifications(
  preferences: NotificationPreferences,
  votedProposalIds: string[]
): Promise<void> {
  updatePollerState({ isPolling: true, error: null });

  try {
    // Run all checks in parallel
    await Promise.all([
      checkNewProposals(preferences),
      checkVoteResults(preferences, votedProposalIds),
      checkVotingDeadlines(preferences),
    ]);

    updatePollerState({
      isPolling: false,
      lastPollAt: Date.now(),
      isStale: false,
      isCanisterAvailable: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Polling error:', errorMessage);

    updatePollerState({
      isPolling: false,
      error: errorMessage,
      isCanisterAvailable: false,
    });

    throw error;
  }
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook to manage notification polling
 *
 * @param isAuthenticated - Whether user is authenticated
 * @param isMember - Whether user has active membership
 * @returns Poller state
 */
export function useNotificationPoller(isAuthenticated: boolean, isMember: boolean): PollerState {
  const preferences = useStore($notificationPreferences);
  const pollerState = useStore($pollerState);

  const [votedProposalIds, setVotedProposalIds] = useState<string[]>([]);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  // Load voted proposals on init
  useEffect(() => {
    if (!isAuthenticated || !isMember) return;

    // Load from cache first
    const cached = getCachedVotedProposalIds();
    setVotedProposalIds(cached);

    // TODO: Fetch from canister and update cache
    // For now, use cached values
  }, [isAuthenticated, isMember]);

  // Main polling effect
  useEffect(() => {
    if (!isAuthenticated || !isMember || !preferences.enabled) {
      // Clear interval if conditions not met
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    isActiveRef.current = true;

    const poll = async () => {
      if (!isActiveRef.current) return;

      try {
        await pollForNotifications(preferences, votedProposalIds);
        // Reset backoff on success
        backoffRef.current = INITIAL_BACKOFF_MS;
      } catch {
        // Exponential backoff on failure
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      }
    };

    // Initial poll
    poll();

    // Set up interval
    intervalRef.current = setInterval(poll, POLLING_INTERVAL_MS);

    return () => {
      isActiveRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, isMember, preferences, votedProposalIds]);

  // Visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        isAuthenticated &&
        isMember &&
        preferences.enabled
      ) {
        // Trigger immediate poll when tab becomes visible
        pollForNotifications(preferences, votedProposalIds).catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, isMember, preferences, votedProposalIds]);

  // Stale check effect
  useEffect(() => {
    const checkStale = () => {
      const { lastPollAt } = $pollerState.get();
      if (lastPollAt) {
        const isStale = Date.now() - lastPollAt > STALE_THRESHOLD_MS;
        if (isStale !== pollerState.isStale) {
          updatePollerState({ isStale });
        }
      }
    };

    const staleCheckInterval = setInterval(checkStale, 30000);
    return () => clearInterval(staleCheckInterval);
  }, [pollerState.isStale]);

  return pollerState;
}

/**
 * Add a proposal ID to the voted proposals cache
 * Call this when user casts a vote
 */
export function addVotedProposalToCache(proposalId: string): void {
  const cached = getCachedVotedProposalIds();
  if (!cached.includes(proposalId)) {
    cached.push(proposalId);
    cacheVotedProposalIds(cached);
  }
}

/**
 * Get current poller state (for non-React contexts)
 */
export function getPollerState(): PollerState {
  return $pollerState.get();
}

/**
 * Force a poll (for testing or manual refresh)
 */
export async function forcePoll(): Promise<void> {
  const preferences = $notificationPreferences.get();
  const votedProposalIds = getCachedVotedProposalIds();
  await pollForNotifications(preferences, votedProposalIds);
}
