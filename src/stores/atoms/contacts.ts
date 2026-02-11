/**
 * Contact Request State Management
 *
 * Manages contact/messaging request state using nanostores.
 * Part of the member directory feature for approval-based messaging.
 *
 * Story: 9-3-1-member-directory
 * AC: 4
 *
 * NOTE: Contact request functionality requires new canister endpoints.
 * This implementation uses mock data until canister is extended.
 */

import { atom, computed } from 'nanostores';
import { ContactRequest, ContactStatus } from './members';

// ============================================================================
// Types
// ============================================================================

/**
 * Contact request state with loading/error handling
 */
export interface ContactsState {
  /** Sent contact requests (outgoing) */
  sent: ContactRequest[];
  /** Received contact requests (incoming) */
  received: ContactRequest[];
  /** Last successful fetch timestamp */
  lastUpdated: number | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if operation failed */
  error: string | null;
}

// ============================================================================
// Configuration
// ============================================================================

/** Stale threshold for contact data (2 minutes) */
export const CONTACTS_STALE_THRESHOLD_MS = 2 * 60 * 1000;

/** Initial contacts state */
const INITIAL_CONTACTS_STATE: ContactsState = {
  sent: [],
  received: [],
  lastUpdated: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Main contacts state store
 */
export const $contacts = atom<ContactsState>({ ...INITIAL_CONTACTS_STATE });

/**
 * Contact request modal state
 */
export const $contactModalOpen = atom<boolean>(false);

/**
 * Selected recipient for contact request
 */
export const $contactRecipient = atom<string | null>(null);

// ============================================================================
// Computed Atoms
// ============================================================================

/**
 * Loading state convenience atom
 */
export const $contactsLoading = computed($contacts, (state) => state.isLoading);

/**
 * Error state convenience atom
 */
export const $contactsError = computed($contacts, (state) => state.error);

/**
 * Pending sent requests
 */
export const $pendingSent = computed($contacts, (state) =>
  state.sent.filter((r) => r.status === 'pending')
);

/**
 * Pending received requests (need user action)
 */
export const $pendingReceived = computed($contacts, (state) =>
  state.received.filter((r) => r.status === 'pending')
);

/**
 * Approved contacts (can message directly)
 */
export const $approvedContacts = computed($contacts, (state) =>
  state.sent.filter((r) => r.status === 'approved')
);

/**
 * Rejected requests
 */
export const $rejectedRequests = computed($contacts, (state) =>
  state.sent.filter((r) => r.status === 'rejected')
);

/**
 * Count of pending received requests
 */
export const $pendingReceivedCount = computed($pendingReceived, (requests) => requests.length);

/**
 * Get contact status for a specific principal
 */
export function getContactStatusForPrincipal(principal: string): ContactStatus | null {
  const state = $contacts.get();
  const sent = state.sent.find((r) => r.to === principal);
  if (sent) return sent.status;
  const received = state.received.find((r) => r.from === principal);
  if (received) return received.status;
  return null;
}

// ============================================================================
// Actions - Contacts State
// ============================================================================

/**
 * Set loading state for contacts fetch/operation
 */
export function setContactsLoading(isLoading: boolean): void {
  const current = $contacts.get();
  $contacts.set({
    ...current,
    isLoading,
    error: isLoading ? null : current.error,
  });
}

/**
 * Set contacts after successful fetch
 * @param sent - Sent contact requests
 * @param received - Received contact requests
 */
export function setContacts(sent: ContactRequest[], received: ContactRequest[]): void {
  $contacts.set({
    sent,
    received,
    lastUpdated: Date.now(),
    isLoading: false,
    error: null,
  });
}

/**
 * Add a new sent request
 * @param request - New contact request
 */
export function addSentRequest(request: ContactRequest): void {
  const current = $contacts.get();
  $contacts.set({
    ...current,
    sent: [...current.sent, request],
    lastUpdated: Date.now(),
  });
}

/**
 * Update a request status
 * @param requestId - Request ID
 * @param status - New status
 * @param respondedAt - Response timestamp
 */
export function updateRequestStatus(
  requestId: string,
  status: ContactStatus,
  respondedAt?: bigint
): void {
  const current = $contacts.get();

  const updateRequest = (requests: ContactRequest[]): ContactRequest[] =>
    requests.map((r) =>
      r.id === requestId
        ? { ...r, status, respondedAt: respondedAt ?? r.respondedAt }
        : r
    );

  $contacts.set({
    ...current,
    sent: updateRequest(current.sent),
    received: updateRequest(current.received),
    lastUpdated: Date.now(),
  });
}

/**
 * Set error state after failed contact operation
 * @param error - Error message
 */
export function setContactsError(error: string): void {
  const current = $contacts.get();
  $contacts.set({
    ...current,
    isLoading: false,
    error,
  });
}

/**
 * Clear contacts state
 */
export function clearContacts(): void {
  $contacts.set({ ...INITIAL_CONTACTS_STATE });
  $contactModalOpen.set(false);
  $contactRecipient.set(null);
}

/**
 * Open contact request modal for a recipient
 * @param recipientPrincipal - Recipient principal
 */
export function openContactModal(recipientPrincipal: string): void {
  $contactRecipient.set(recipientPrincipal);
  $contactModalOpen.set(true);
}

/**
 * Close contact request modal
 */
export function closeContactModal(): void {
  $contactModalOpen.set(false);
  $contactRecipient.set(null);
}

/**
 * Check if contacts data is stale
 * @param thresholdMs - Stale threshold in milliseconds
 */
export function isContactsStale(thresholdMs: number = CONTACTS_STALE_THRESHOLD_MS): boolean {
  const state = $contacts.get();
  if (!state.lastUpdated) return true;
  return Date.now() - state.lastUpdated > thresholdMs;
}

// ============================================================================
// Export Actions Object
// ============================================================================

export const contactActions = {
  setLoading: setContactsLoading,
  setContacts,
  addSent: addSentRequest,
  updateStatus: updateRequestStatus,
  setError: setContactsError,
  clear: clearContacts,
  openModal: openContactModal,
  closeModal: closeContactModal,
  isStale: isContactsStale,
  getStatusFor: getContactStatusForPrincipal,
};
