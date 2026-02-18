/**
 * Event Service
 *
 * Service for fetching events and managing RSVPs via oracle-bridge.
 * All calls use cookie-based auth (credentials: 'include').
 *
 * Story: BL-025.3
 * ACs: 1, 5, 6, 7, 8
 */

import { getOracleBridgeUrl } from '@/utils/oracleBridge';

// ============================================================================
// Types
// ============================================================================

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  location_url: string | null;
  start_time: string; // ISO string (UTC)
  end_time: string; // ISO string (UTC)
  timezone: string; // IANA timezone of event origin
  is_recurring: boolean;
  recurrence_rule: string | null;
  created_by: string;
  is_public: boolean;
  max_attendees: number | null;
  attendee_count: number;
  rsvp_status: 'going' | 'maybe' | 'not_going' | null;
  created_at: string;
  updated_at: string;
}

export interface EventsListResponse {
  events: EventItem[];
  total: number;
}

export interface RsvpResponse {
  event_id: string;
  user_id: string;
  status: 'going' | 'maybe' | 'not_going';
}

// ============================================================================
// Error Class
// ============================================================================

export class EventApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'EventApiError';
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch events within a date range from oracle-bridge.
 *
 * @param from - ISO date string for range start (default: today)
 * @param to - ISO date string for range end (default: today + 60 days)
 * @throws EventApiError on non-2xx response
 */
export async function listEvents(
  from?: string,
  to?: string
): Promise<EventsListResponse> {
  const baseUrl = getOracleBridgeUrl();

  const defaultFrom = new Date().toISOString();
  const defaultTo = new Date(
    Date.now() + 60 * 24 * 60 * 60 * 1000
  ).toISOString();

  const params = new URLSearchParams({
    from: from || defaultFrom,
    to: to || defaultTo,
    page: '1',
    page_size: '100',
  });

  const response = await fetch(`${baseUrl}/api/events?${params.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text().catch(() => undefined);
    }
    const message =
      errorBody && typeof errorBody === 'object' && 'error' in errorBody
        ? String((errorBody as Record<string, unknown>).error)
        : `Failed to fetch events: ${response.status}`;
    throw new EventApiError(message, response.status, errorBody);
  }

  return response.json();
}

/**
 * RSVP to an event.
 *
 * @param id - Event UUID
 * @param status - RSVP status ('going', 'maybe', 'not_going')
 * @throws EventApiError on non-2xx response (409 for capacity)
 */
export async function rsvpEvent(
  id: string,
  status: 'going' | 'maybe' | 'not_going'
): Promise<RsvpResponse> {
  const baseUrl = getOracleBridgeUrl();

  const response = await fetch(`${baseUrl}/api/events/${id}/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });

  if (response.status === 409) {
    throw new EventApiError('Event is at capacity', 409);
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = undefined;
    }
    const message =
      errorBody && typeof errorBody === 'object' && 'error' in errorBody
        ? String((errorBody as Record<string, unknown>).error)
        : `Failed to RSVP: ${response.status}`;
    throw new EventApiError(message, response.status, errorBody);
  }

  return response.json();
}

/**
 * Remove RSVP from an event.
 *
 * @param id - Event UUID
 * @throws EventApiError on non-2xx response (404 if no RSVP found)
 */
export async function removeRsvp(id: string): Promise<void> {
  const baseUrl = getOracleBridgeUrl();

  const response = await fetch(`${baseUrl}/api/events/${id}/rsvp`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (response.status === 204) {
    return;
  }

  if (response.status === 404) {
    throw new EventApiError('No RSVP found', 404);
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = undefined;
    }
    const message =
      errorBody && typeof errorBody === 'object' && 'error' in errorBody
        ? String((errorBody as Record<string, unknown>).error)
        : `Failed to remove RSVP: ${response.status}`;
    throw new EventApiError(message, response.status, errorBody);
  }
}

/**
 * Get the ICS download URL for an event.
 * Pure function (no fetch) - returns the URL for use in anchor tags.
 *
 * @param id - Event UUID
 */
export function getIcsUrl(id: string): string {
  return `${getOracleBridgeUrl()}/api/events/${id}/ics`;
}

/**
 * Get the ICS feed subscription URL for all events.
 * Pure function (no fetch) - returns the URL for calendar subscriptions.
 */
export function getFeedUrl(): string {
  return `${getOracleBridgeUrl()}/api/events/feed.ics`;
}
