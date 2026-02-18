/**
 * EventsPage Tests
 *
 * Story: BL-025.3
 * AC: 14
 */

import React, { type ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// Mock auth
vi.mock('@hello-world-co-op/auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { userId: 'test-user', roles: ['member'] },
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
  useRoles: () => ['member'],
}));

// Mock oracleBridge
vi.mock('@/utils/oracleBridge', () => ({
  getOracleBridgeUrl: () => 'http://localhost:3000',
}));

// Create stable mock functions
const mockListEvents = vi.fn();
const mockRsvpEvent = vi.fn();
const mockRemoveRsvp = vi.fn();

// Mock eventService
vi.mock('@/services/eventService', () => ({
  listEvents: (...args: unknown[]) => mockListEvents(...args),
  rsvpEvent: (...args: unknown[]) => mockRsvpEvent(...args),
  removeRsvp: (...args: unknown[]) => mockRemoveRsvp(...args),
  getIcsUrl: (id: string) => `http://localhost:3000/api/events/${id}/ics`,
  getFeedUrl: () => 'http://localhost:3000/api/events/feed.ics',
  EventApiError: class EventApiError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.name = 'EventApiError';
      this.status = status;
    }
  },
}));

// Import the actual page component - vi.mock is hoisted, so mocks are in place
import EventsPage from '@/pages/EventsPage';
import type { EventItem } from '@/services/eventService';

function createMockEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'evt-1',
    title: 'Page Test Event',
    description: null,
    location: null,
    location_url: null,
    start_time: '2026-03-15T14:00:00.000Z',
    end_time: '2026-03-15T15:00:00.000Z',
    timezone: 'UTC',
    is_recurring: false,
    recurrence_rule: null,
    created_by: 'user-1',
    is_public: true,
    max_attendees: null,
    attendee_count: 5,
    rsvp_status: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/events']}>
      <EventsPage />
    </MemoryRouter>
  );
}

describe('EventsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    mockListEvents.mockResolvedValue({ events: [], total: 0 });
  });

  it('renders Events Calendar heading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Events Calendar')).toBeInTheDocument();
    });
  });

  it('calls listEvents on mount', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalledTimes(1);
    });
  });

  it('shows EventListView by default (list view)', async () => {
    const events = [createMockEvent()];
    mockListEvents.mockResolvedValue({ events, total: 1 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Page Test Event')).toBeInTheDocument();
    });

    // List view toggle should be active
    const listToggle = screen.getByTestId('view-toggle-list');
    expect(listToggle.className).toContain('bg-teal-600');
  });

  it('Month toggle switches to month view and persists to localStorage', async () => {
    const user = userEvent.setup();
    mockListEvents.mockResolvedValue({ events: [], total: 0 });

    renderPage();

    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalled();
    });

    await user.click(screen.getByTestId('view-toggle-month'));

    expect(localStorage.getItem('dao_suite_events_view')).toBe('month');
    // Month view should now be shown (desktop calendar grid)
    expect(screen.getByTestId('desktop-calendar-grid')).toBeInTheDocument();
  });

  it('List toggle switches back to list view', async () => {
    const user = userEvent.setup();
    mockListEvents.mockResolvedValue({ events: [], total: 0 });

    renderPage();

    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalled();
    });

    // Switch to month first
    await user.click(screen.getByTestId('view-toggle-month'));
    // Switch back to list
    await user.click(screen.getByTestId('view-toggle-list'));

    expect(localStorage.getItem('dao_suite_events_view')).toBe('list');
    expect(screen.getByTestId('events-empty-state')).toBeInTheDocument();
  });

  it('restores month view from localStorage on init', async () => {
    localStorage.setItem('dao_suite_events_view', 'month');
    mockListEvents.mockResolvedValue({ events: [], total: 0 });

    renderPage();

    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalled();
    });

    // Should show month view (the desktop calendar grid)
    expect(screen.getByTestId('desktop-calendar-grid')).toBeInTheDocument();
  });

  it('EventDetailModal opens when event clicked in list view', async () => {
    const user = userEvent.setup();
    const events = [createMockEvent({ title: 'Clickable Event' })];
    mockListEvents.mockResolvedValue({ events, total: 1 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Clickable Event')).toBeInTheDocument();
    });

    // Click the event title in the card
    await user.click(screen.getAllByTestId('event-card-title')[0]);

    // Modal should be visible
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('EventDetailModal closes when onClose is called', async () => {
    const user = userEvent.setup();
    const events = [createMockEvent()];
    mockListEvents.mockResolvedValue({ events, total: 1 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Page Test Event')).toBeInTheDocument();
    });

    // Open modal
    await user.click(screen.getAllByTestId('event-card-title')[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close modal
    await user.click(screen.getByTestId('modal-close-button'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('RSVP success: state is optimistically updated', async () => {
    const user = userEvent.setup();
    const events = [createMockEvent({ id: 'evt-1', rsvp_status: null })];
    mockListEvents.mockResolvedValue({ events, total: 1 });
    mockRsvpEvent.mockResolvedValue({
      event_id: 'evt-1',
      user_id: 'test-user',
      status: 'going',
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Page Test Event')).toBeInTheDocument();
    });

    // Click Going button
    await user.click(screen.getByTestId('rsvp-going'));

    await waitFor(() => {
      expect(mockRsvpEvent).toHaveBeenCalledWith('evt-1', 'going');
    });

    // After successful RSVP, Going button should now be active (aria-pressed)
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-going')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });
  });

  it('RSVP error (409): shows capacity error message', async () => {
    const user = userEvent.setup();
    const events = [createMockEvent()];
    mockListEvents.mockResolvedValue({ events, total: 1 });

    // Import and use the mocked EventApiError
    const { EventApiError } = await import('@/services/eventService');
    mockRsvpEvent.mockRejectedValue(
      new EventApiError('Event is at capacity', 409)
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Page Test Event')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('rsvp-going'));

    await waitFor(() => {
      const banner = screen.getByTestId('rsvp-error-banner');
      expect(banner).toHaveTextContent('capacity');
    });
  });

  it('Remove RSVP success: state is updated', async () => {
    const user = userEvent.setup();
    const events = [createMockEvent({ id: 'evt-1', rsvp_status: 'going' })];
    mockListEvents.mockResolvedValue({ events, total: 1 });
    mockRemoveRsvp.mockResolvedValue(undefined);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Page Test Event')).toBeInTheDocument();
    });

    // Going button should be active
    expect(screen.getByTestId('rsvp-going')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // Click Going (already active) to remove
    await user.click(screen.getByTestId('rsvp-going'));

    await waitFor(() => {
      expect(mockRemoveRsvp).toHaveBeenCalledWith('evt-1');
    });

    // After removal, Going should no longer be active
    await waitFor(() => {
      expect(screen.getByTestId('rsvp-going')).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });
  });

  // AI-R120: Pagination escalation tests
  it('shows pagination indicator when total exceeds displayed events', async () => {
    const events = [createMockEvent({ id: 'evt-1', title: 'Event 1' })];
    // total=150 but only 1 event returned (simulating page_size truncation)
    mockListEvents.mockResolvedValue({ events, total: 150 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('pagination-indicator')).toBeInTheDocument();
    });

    expect(screen.getByTestId('pagination-indicator')).toHaveTextContent(
      'Showing 1 of 150 events'
    );
  });

  it('hides pagination indicator when total equals events length', async () => {
    const events = [createMockEvent()];
    mockListEvents.mockResolvedValue({ events, total: 1 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Page Test Event')).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('pagination-indicator')
    ).not.toBeInTheDocument();
  });

  it('hides pagination indicator when total is 0 (empty result)', async () => {
    mockListEvents.mockResolvedValue({ events: [], total: 0 });

    renderPage();

    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalled();
    });

    expect(
      screen.queryByTestId('pagination-indicator')
    ).not.toBeInTheDocument();
  });

  it('API fetch error: shows error banner with Try again button', async () => {
    const user = userEvent.setup();
    mockListEvents.mockRejectedValueOnce(new Error('Network error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('fetch-error-banner')).toBeInTheDocument();
    });

    expect(screen.getByTestId('fetch-error-banner')).toHaveTextContent(
      'Network error'
    );

    // Try again
    mockListEvents.mockResolvedValue({ events: [], total: 0 });
    await user.click(screen.getByTestId('try-again-button'));

    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalledTimes(2);
    });
  });
});
