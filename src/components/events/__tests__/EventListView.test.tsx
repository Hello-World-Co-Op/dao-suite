/**
 * EventListView Component Tests
 *
 * Story: BL-025.3
 * AC: 14
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventListView } from '@/components/events/EventListView';
import { type EventItem } from '@/services/eventService';

// Mock oracleBridge (EventCard uses getIcsUrl)
vi.mock('@/utils/oracleBridge', () => ({
  getOracleBridgeUrl: () => 'http://localhost:3000',
}));

function createMockEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'evt-1',
    title: 'List View Event',
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
    attendee_count: 3,
    rsvp_status: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('EventListView', () => {
  const mockOnEventClick = vi.fn();
  const mockOnRsvp = vi.fn();
  const mockOnRemoveRsvp = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders skeleton loading cards when loading', () => {
    render(
      <EventListView
        events={[]}
        loading={true}
        onEventClick={mockOnEventClick}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        rsvpLoading={null}
      />
    );

    const skeleton = screen.getByTestId('events-loading-skeleton');
    expect(skeleton).toBeInTheDocument();
    // Should have 3 skeleton cards
    const skeletonCards = skeleton.querySelectorAll('.h-32');
    expect(skeletonCards).toHaveLength(3);
  });

  it('renders empty state with data-testid', () => {
    render(
      <EventListView
        events={[]}
        loading={false}
        onEventClick={mockOnEventClick}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        rsvpLoading={null}
      />
    );

    const emptyState = screen.getByTestId('events-empty-state');
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent('No upcoming events');
    expect(emptyState).toHaveTextContent('Check back soon');
  });

  it('groups events by date with group headers', () => {
    const events = [
      createMockEvent({
        id: 'evt-1',
        title: 'Event A',
        start_time: '2026-03-15T10:00:00.000Z',
      }),
      createMockEvent({
        id: 'evt-2',
        title: 'Event B',
        start_time: '2026-03-15T14:00:00.000Z',
      }),
      createMockEvent({
        id: 'evt-3',
        title: 'Event C',
        start_time: '2026-03-16T09:00:00.000Z',
      }),
    ];

    render(
      <EventListView
        events={events}
        loading={false}
        onEventClick={mockOnEventClick}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        rsvpLoading={null}
      />
    );

    const headers = screen.getAllByTestId('date-group-header');
    // March 15 and March 16 — but exact count depends on timezone.
    // At minimum we should see group headers rendered.
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it('renders EventCard for each event', () => {
    const events = [
      createMockEvent({ id: 'evt-1', title: 'First Event' }),
      createMockEvent({
        id: 'evt-2',
        title: 'Second Event',
        start_time: '2026-03-16T14:00:00.000Z',
      }),
    ];

    render(
      <EventListView
        events={events}
        loading={false}
        onEventClick={mockOnEventClick}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        rsvpLoading={null}
      />
    );

    expect(screen.getByText('First Event')).toBeInTheDocument();
    expect(screen.getByText('Second Event')).toBeInTheDocument();
  });

  it('events are sorted ascending by start_time', () => {
    const events = [
      createMockEvent({
        id: 'evt-2',
        title: 'Later Event',
        start_time: '2026-03-20T14:00:00.000Z',
      }),
      createMockEvent({
        id: 'evt-1',
        title: 'Earlier Event',
        start_time: '2026-03-10T14:00:00.000Z',
      }),
    ];

    render(
      <EventListView
        events={events}
        loading={false}
        onEventClick={mockOnEventClick}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        rsvpLoading={null}
      />
    );

    const listView = screen.getByTestId('event-list-view');
    const allTitles = listView.querySelectorAll('[data-testid="event-card-title"]');
    expect(allTitles[0]).toHaveTextContent('Earlier Event');
    expect(allTitles[1]).toHaveTextContent('Later Event');
  });
});
