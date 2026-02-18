/**
 * EventCard Component Tests
 *
 * Story: BL-025.3
 * AC: 14
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventCard } from '@/components/events/EventCard';
import { type EventItem } from '@/services/eventService';

// Mock oracleBridge for getIcsUrl
vi.mock('@/utils/oracleBridge', () => ({
  getOracleBridgeUrl: () => 'http://localhost:3000',
}));

function createMockEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'evt-1',
    title: 'Test Event',
    description: 'A description',
    location: 'Meeting Room A',
    location_url: null,
    start_time: '2026-03-15T14:00:00.000Z',
    end_time: '2026-03-15T15:00:00.000Z',
    timezone: 'America/New_York',
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

describe('EventCard', () => {
  const mockOnRsvp = vi.fn();
  const mockOnRemoveRsvp = vi.fn();
  const mockOnViewDetails = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders event title, date/time, and attendee count', () => {
    const event = createMockEvent();
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByTestId('event-card-title')).toHaveTextContent('Test Event');
    expect(screen.getByTestId('attendee-count')).toHaveTextContent('5 going');
  });

  it('highlights Going button when rsvp_status is going; calls onRemoveRsvp on click', async () => {
    const user = userEvent.setup();
    const event = createMockEvent({ rsvp_status: 'going' });
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
      />
    );

    const goingBtn = screen.getByTestId('rsvp-going');
    expect(goingBtn).toHaveAttribute('aria-pressed', 'true');

    await user.click(goingBtn);
    expect(mockOnRemoveRsvp).toHaveBeenCalledWith('evt-1');
    expect(mockOnRsvp).not.toHaveBeenCalled();
  });

  it('calls onRsvp with maybe when Maybe button clicked', async () => {
    const user = userEvent.setup();
    const event = createMockEvent();
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
      />
    );

    await user.click(screen.getByTestId('rsvp-maybe'));
    expect(mockOnRsvp).toHaveBeenCalledWith('evt-1', 'maybe');
  });

  it('calls onRsvp with not_going when Not Going button clicked', async () => {
    const user = userEvent.setup();
    const event = createMockEvent();
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
      />
    );

    await user.click(screen.getByTestId('rsvp-not-going'));
    expect(mockOnRsvp).toHaveBeenCalledWith('evt-1', 'not_going');
  });

  it('shows Full badge and disables Going when at capacity', () => {
    const event = createMockEvent({
      max_attendees: 10,
      attendee_count: 10,
      rsvp_status: null,
    });
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByTestId('full-badge')).toHaveTextContent('Full');
    expect(screen.getByTestId('rsvp-going')).toBeDisabled();
    expect(screen.getByTestId('rsvp-maybe')).not.toBeDisabled();
    expect(screen.getByTestId('rsvp-not-going')).not.toBeDisabled();
  });

  it('does NOT disable Going for user already going when full', () => {
    const event = createMockEvent({
      max_attendees: 10,
      attendee_count: 10,
      rsvp_status: 'going',
    });
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByTestId('rsvp-going')).not.toBeDisabled();
  });

  it('shows recurring badge when is_recurring is true', () => {
    const event = createMockEvent({ is_recurring: true });
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByTestId('recurring-badge')).toBeInTheDocument();
  });

  it('has Add to Calendar link with correct ICS href', () => {
    const event = createMockEvent({ id: 'my-event-id' });
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
      />
    );

    const link = screen.getByTestId('add-to-calendar-link');
    expect(link).toHaveAttribute(
      'href',
      'http://localhost:3000/api/events/my-event-id/ics'
    );
    expect(link).toHaveAttribute('download');
  });

  it('disables RSVP buttons and shows spinner when loading', () => {
    const event = createMockEvent({ rsvp_status: 'going' });
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
        rsvpLoading="evt-1"
      />
    );

    expect(screen.getByTestId('rsvp-going')).toBeDisabled();
    expect(screen.getByTestId('rsvp-maybe')).toBeDisabled();
    expect(screen.getByTestId('rsvp-not-going')).toBeDisabled();
    expect(screen.getByTestId('rsvp-spinner')).toBeInTheDocument();
  });

  it('calls onViewDetails when title is clicked', async () => {
    const user = userEvent.setup();
    const event = createMockEvent();
    render(
      <EventCard
        event={event}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
        onViewDetails={mockOnViewDetails}
      />
    );

    await user.click(screen.getByTestId('event-card-title'));
    expect(mockOnViewDetails).toHaveBeenCalledWith(event);
  });
});
