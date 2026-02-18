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
 */

import { useCallback, useRef } from 'react';
import { useStore } from '@nanostores/react';
import {
  $contacts,
  $contactModalOpen,
  $contactRecipient,
  $pendingSent,
  $pendingReceived,
  $approvedContacts,
  $pendingReceivedCount,
  clearContacts,
  openContactModal,
  closeContactModal,
  getContactStatusForPrincipal,
  type ContactsState,
} from '@/stores';
import { type ContactRequest, type ContactStatus } from '@/stores';

// ============================================================================
// Deferred: contact requests require canister backend (future epic BL-023 or similar)
// All functions below return empty state until the contact request epic.
// The sendContactRequest, respondToContactRequest, and fetchContactRequests
// functions have been removed. The hook returns safe empty/no-op defaults
// so that the MemberDirectory component renders without errors.
// ============================================================================

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
  /** Send contact request (deferred - returns error) */
  send: (message: string) => Promise<SendContactRequestResult>;
  /** Approve a request (deferred - returns error) */
  approve: (requestId: string) => Promise<RespondToRequestResult>;
  /** Reject a request (deferred - returns error) */
  reject: (requestId: string) => Promise<RespondToRequestResult>;
  /** Refresh contacts */
  refresh: () => Promise<void>;
  /** Clear contacts state */
  clear: () => void;
}

/**
 * Hook for contact request management.
 * Currently returns safe empty/no-op defaults since contact requests
 * are deferred to a future epic (BL-023 or similar).
 */
export function useContactRequests(
  _options: UseContactRequestsOptions = {}
): UseContactRequestsResult {
  // Subscribe to stores (still needed for the modal UI)
  const contactsState = useStore($contacts);
  const pendingSentValue = useStore($pendingSent);
  const pendingReceivedValue = useStore($pendingReceived);
  const approvedContactsValue = useStore($approvedContacts);
  const pendingReceivedCountValue = useStore($pendingReceivedCount);
  const isModalOpen = useStore($contactModalOpen);
  const recipientPrincipal = useStore($contactRecipient);

  // Track if initial fetch has been done (no-op for now)
  const _initialFetchDone = useRef(false);

  // Deferred: contact requests require canister backend (future epic)
  const send = useCallback(
    async (_message: string): Promise<SendContactRequestResult> => {
      return { success: false, error: 'Contact requests coming soon' };
    },
    []
  );

  const approve = useCallback(async (_requestId: string): Promise<RespondToRequestResult> => {
    return { success: false, error: 'Contact requests coming soon' };
  }, []);

  const reject = useCallback(async (_requestId: string): Promise<RespondToRequestResult> => {
    return { success: false, error: 'Contact requests coming soon' };
  }, []);

  const refresh = useCallback(async () => {
    // No-op: contact requests deferred
  }, []);

  const clear = useCallback(() => {
    clearContacts();
  }, []);

  return {
    contactsState,
    pendingSent: pendingSentValue,
    pendingReceived: pendingReceivedValue,
    approvedContacts: approvedContactsValue,
    pendingReceivedCount: pendingReceivedCountValue,
    isModalOpen,
    recipientPrincipal,
    isLoading: false,
    isSending: false,
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
