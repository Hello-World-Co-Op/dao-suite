/**
 * Contact Request Service
 *
 * Service for managing contact requests between members.
 * Provides hooks for React component integration.
 *
 * Story: 9-3-1-member-directory
 * AC: 4
 *
 * NOTE: Contact request functionality requires new canister endpoints.
 * This implementation uses mock data until canister is extended.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  $contacts,
  $contactModalOpen,
  $contactRecipient,
  $pendingSent,
  $pendingReceived,
  $approvedContacts,
  $pendingReceivedCount,
  setContactsLoading,
  setContacts,
  addSentRequest,
  updateRequestStatus,
  setContactsError,
  clearContacts,
  openContactModal,
  closeContactModal,
  isContactsStale,
  getContactStatusForPrincipal,
  type ContactsState,
} from '@/stores';
import { type ContactRequest, type ContactStatus } from '@/stores';
import { trackEvent } from '../utils/analytics';

// ============================================================================
// Configuration
// ============================================================================

// NOTE: The following constants are reserved for future canister integration:
// REQUEST_TIMEOUT_MS, INITIAL_BACKOFF_MS, MAX_BACKOFF_MS, MAX_RETRY_ATTEMPTS
// Currently using mock implementation that doesn't require these.

// ============================================================================
// Types
// ============================================================================

export interface SendContactRequestResult {
  success: boolean;
  request?: ContactRequest;
  error?: string;
}

export interface RespondToRequestResult {
  success: boolean;
  error?: string;
}

export interface FetchContactsResult {
  success: boolean;
  sent?: ContactRequest[];
  received?: ContactRequest[];
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create structured log entry
 */
function log(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: 'ContactService',
    level,
    message,
    ...data,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Mock Implementation
// ============================================================================

/** Mock contact requests storage (in-memory for development) */
const mockSentRequests: ContactRequest[] = [];
let mockReceivedRequests: ContactRequest[] = [];

/**
 * Mock: Send contact request
 */
async function mockSendRequest(
  fromPrincipal: string,
  toPrincipal: string,
  message: string
): Promise<SendContactRequestResult> {
  log('info', 'Mock send contact request', { from: fromPrincipal, to: toPrincipal });

  // Simulate network delay
  await sleep(300 + Math.random() * 200);

  // Check for existing request
  const existing = mockSentRequests.find((r) => r.to === toPrincipal);
  if (existing) {
    return { success: false, error: 'Contact request already sent to this member' };
  }

  const request: ContactRequest = {
    id: generateRequestId(),
    from: fromPrincipal,
    to: toPrincipal,
    message,
    status: 'pending',
    createdAt: BigInt(Date.now() * 1_000_000),
  };

  mockSentRequests.push(request);

  return { success: true, request };
}

/**
 * Mock: Respond to contact request
 */
async function mockRespondToRequest(
  requestId: string,
  response: 'approved' | 'rejected'
): Promise<RespondToRequestResult> {
  log('info', 'Mock respond to contact request', { requestId, response });

  // Simulate network delay
  await sleep(200 + Math.random() * 100);

  const request = mockReceivedRequests.find((r) => r.id === requestId);
  if (!request) {
    return { success: false, error: 'Request not found' };
  }

  request.status = response;
  request.respondedAt = BigInt(Date.now() * 1_000_000);

  return { success: true };
}

/**
 * Mock: Fetch contact requests
 */
async function mockFetchContacts(userPrincipal: string): Promise<FetchContactsResult> {
  log('info', 'Mock fetch contacts', { userPrincipal });

  // Simulate network delay
  await sleep(200 + Math.random() * 100);

  // No mock data — return empty until canister endpoints exist

  return {
    success: true,
    sent: mockSentRequests,
    received: mockReceivedRequests,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Send a contact request to another member
 */
export async function sendContactRequest(
  fromPrincipal: string,
  toPrincipal: string,
  message: string
): Promise<SendContactRequestResult> {
  // Always use mock for now until canister endpoints exist
  return mockSendRequest(fromPrincipal, toPrincipal, message);
}

/**
 * Respond to a received contact request
 */
export async function respondToContactRequest(
  requestId: string,
  response: 'approved' | 'rejected'
): Promise<RespondToRequestResult> {
  // Always use mock for now until canister endpoints exist
  return mockRespondToRequest(requestId, response);
}

/**
 * Fetch all contact requests for current user
 */
export async function fetchContactRequests(userPrincipal: string): Promise<FetchContactsResult> {
  // Always use mock for now until canister endpoints exist
  return mockFetchContacts(userPrincipal);
}

// ============================================================================
// React Hooks
// ============================================================================

export interface UseContactRequestsOptions {
  /** User's principal */
  userPrincipal?: string;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

export interface UseContactRequestsResult {
  /** Current contacts state */
  contactsState: ContactsState;
  /** Pending sent requests */
  pendingSent: ContactRequest[];
  /** Pending received requests (need action) */
  pendingReceived: ContactRequest[];
  /** Approved contacts */
  approvedContacts: ContactRequest[];
  /** Count of pending received requests */
  pendingReceivedCount: number;
  /** Contact modal open state */
  isModalOpen: boolean;
  /** Current recipient for modal */
  recipientPrincipal: string | null;
  /** Is loading state */
  isLoading: boolean;
  /** Is sending a request */
  isSending: boolean;
  /** Get contact status for a principal */
  getStatusFor: (principal: string) => ContactStatus | null;
  /** Open contact modal for a recipient */
  openModal: (recipientPrincipal: string) => void;
  /** Close contact modal */
  closeModal: () => void;
  /** Send contact request */
  send: (message: string) => Promise<SendContactRequestResult>;
  /** Approve a request */
  approve: (requestId: string) => Promise<RespondToRequestResult>;
  /** Reject a request */
  reject: (requestId: string) => Promise<RespondToRequestResult>;
  /** Refresh contacts */
  refresh: () => Promise<void>;
  /** Clear contacts state */
  clear: () => void;
}

/**
 * Hook for contact request management
 */
export function useContactRequests(
  options: UseContactRequestsOptions = {}
): UseContactRequestsResult {
  const { userPrincipal, autoFetch = true } = options;

  // Subscribe to stores
  const contactsState = useStore($contacts);
  const pendingSentValue = useStore($pendingSent);
  const pendingReceivedValue = useStore($pendingReceived);
  const approvedContactsValue = useStore($approvedContacts);
  const pendingReceivedCountValue = useStore($pendingReceivedCount);
  const isModalOpen = useStore($contactModalOpen);
  const recipientPrincipal = useStore($contactRecipient);

  // Local state
  const [isSending, setIsSending] = useState(false);

  // Track if initial fetch has been done
  const initialFetchDone = useRef(false);

  /**
   * Fetch contacts
   */
  const fetchContacts = useCallback(async () => {
    if (!userPrincipal) return;

    setContactsLoading(true);
    log('info', 'Fetching contacts', { userPrincipal });

    try {
      const result = await fetchContactRequests(userPrincipal);

      if (result.success) {
        setContacts(result.sent || [], result.received || []);
        log('info', 'Contacts fetched successfully', {
          sentCount: result.sent?.length,
          receivedCount: result.received?.length,
        });
      } else {
        setContactsError(result.error || 'Failed to fetch contacts');
        log('error', 'Failed to fetch contacts', { error: result.error });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setContactsError(errorMessage);
      log('error', 'Exception during contacts fetch', { error: errorMessage });
    }
  }, [userPrincipal]);

  /**
   * Refresh contacts
   */
  const refresh = useCallback(async () => {
    await fetchContacts();
  }, [fetchContacts]);

  /**
   * Send contact request
   */
  const send = useCallback(
    async (message: string): Promise<SendContactRequestResult> => {
      if (!userPrincipal || !recipientPrincipal) {
        return { success: false, error: 'Missing user or recipient principal' };
      }

      setIsSending(true);
      log('info', 'Sending contact request', {
        from: userPrincipal,
        to: recipientPrincipal,
      });

      try {
        const result = await sendContactRequest(userPrincipal, recipientPrincipal, message);

        if (result.success && result.request) {
          addSentRequest(result.request);
          closeContactModal();

          // Track analytics
          trackEvent('contact_request_sent', {
            recipient_id: recipientPrincipal,
            message_length: message.length,
          });

          log('info', 'Contact request sent successfully', {
            requestId: result.request.id,
          });
        } else {
          log('error', 'Failed to send contact request', { error: result.error });
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log('error', 'Exception during send contact request', { error: errorMessage });
        return { success: false, error: errorMessage };
      } finally {
        setIsSending(false);
      }
    },
    [userPrincipal, recipientPrincipal]
  );

  /**
   * Approve a request
   */
  const approve = useCallback(async (requestId: string): Promise<RespondToRequestResult> => {
    log('info', 'Approving contact request', { requestId });

    try {
      const result = await respondToContactRequest(requestId, 'approved');

      if (result.success) {
        updateRequestStatus(requestId, 'approved', BigInt(Date.now() * 1_000_000));
        log('info', 'Contact request approved', { requestId });
      } else {
        log('error', 'Failed to approve request', { error: result.error });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'Exception during approve request', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Reject a request
   */
  const reject = useCallback(async (requestId: string): Promise<RespondToRequestResult> => {
    log('info', 'Rejecting contact request', { requestId });

    try {
      const result = await respondToContactRequest(requestId, 'rejected');

      if (result.success) {
        updateRequestStatus(requestId, 'rejected', BigInt(Date.now() * 1_000_000));
        log('info', 'Contact request rejected', { requestId });
      } else {
        log('error', 'Failed to reject request', { error: result.error });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'Exception during reject request', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Clear contacts
   */
  const clear = useCallback(() => {
    clearContacts();
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && userPrincipal && !initialFetchDone.current) {
      const shouldFetch = !contactsState.lastUpdated || isContactsStale();

      if (shouldFetch) {
        initialFetchDone.current = true;
        fetchContacts();
      }
    }
  }, [autoFetch, userPrincipal, contactsState.lastUpdated, fetchContacts]);

  return {
    contactsState,
    pendingSent: pendingSentValue,
    pendingReceived: pendingReceivedValue,
    approvedContacts: approvedContactsValue,
    pendingReceivedCount: pendingReceivedCountValue,
    isModalOpen,
    recipientPrincipal,
    isLoading: contactsState.isLoading,
    isSending,
    getStatusFor: getContactStatusForPrincipal,
    openModal: openContactModal,
    closeModal: closeContactModal,
    send,
    approve,
    reject,
    refresh,
    clear,
  };
}
