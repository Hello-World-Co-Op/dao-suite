/**
 * EventDetailModal Component Tests
 *
 * Story: BL-025.3
 * AC: 14
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventDetailModal } from '@/components/events/EventDetailModal';
import { type EventItem } from '@/services/eventService';

// Mock oracleBridge for getIcsUrl and getFeedUrl
vi.mock('@/utils/oracleBridge', () => ({
  getOracleBridgeUrl: () => 'http://localhost:3000',
}));

function createMockEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'evt-1',
    title: 'Test Event Detail',
    description: '**Bold description** with [a link](https://example.com)',
    location: '123 Main St, Springfield',
    location_url: null,
    start_time: '2026-03-15T14:00:00.000Z',
    end_time: '2026-03-15T15:00:00.000Z',
    timezone: 'America/New_York',
    is_recurring: false,
    recurrence_rule: null,
    created_by: 'user-1',
    is_public: true,
    max_attendees: null,
    attendee_count: 8,
    rsvp_status: null,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('EventDetailModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRsvp = vi.fn();
  const mockOnRemoveRsvp = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('does not render when event is null', () => {
    const { container } = render(
      <EventDetailModal
        event={null}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders title, date/time, and location when open', () => {
    const event = createMockEvent();
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    expect(screen.getByText('Test Event Detail')).toBeInTheDocument();
    expect(screen.getByText('123 Main St, Springfield')).toBeInTheDocument();
    expect(screen.getByText('Event timezone: America/New_York')).toBeInTheDocument();
  });

  it('shows Google Maps link for physical location', () => {
    const event = createMockEvent({ location: '123 Main St' });
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    const mapsLink = screen.getByTestId('google-maps-link');
    expect(mapsLink).toHaveAttribute(
      'href',
      'https://maps.google.com/?q=123%20Main%20St'
    );
    expect(mapsLink).toHaveAttribute('target', '_blank');
  });

  it('shows virtual URL link for virtual events', () => {
    const event = createMockEvent({
      location: 'Virtual',
      location_url: 'https://zoom.us/j/12345',
    });
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    const virtualLink = screen.getByTestId('virtual-link');
    expect(virtualLink).toHaveAttribute('href', 'https://zoom.us/j/12345');
    expect(virtualLink).toHaveAttribute('target', '_blank');
    expect(virtualLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders markdown description', () => {
    const event = createMockEvent({ description: '**Bold text**' });
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    const descSection = screen.getByTestId('event-description');
    expect(descSection).toBeInTheDocument();
    expect(descSection.querySelector('strong')).toHaveTextContent('Bold text');
  });

  it('RSVP buttons function correctly - going/maybe/not going', async () => {
    const user = userEvent.setup();
    const event = createMockEvent();
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    await user.click(screen.getByTestId('modal-rsvp-going'));
    expect(mockOnRsvp).toHaveBeenCalledWith('evt-1', 'going');

    await user.click(screen.getByTestId('modal-rsvp-maybe'));
    expect(mockOnRsvp).toHaveBeenCalledWith('evt-1', 'maybe');

    await user.click(screen.getByTestId('modal-rsvp-not-going'));
    expect(mockOnRsvp).toHaveBeenCalledWith('evt-1', 'not_going');
  });

  it('has Add to Calendar anchor with correct ICS href', () => {
    const event = createMockEvent({ id: 'evt-abc' });
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    const calLink = screen.getByTestId('modal-add-to-calendar');
    expect(calLink).toHaveAttribute(
      'href',
      'http://localhost:3000/api/events/evt-abc/ics'
    );
    expect(calLink).toHaveAttribute('download');
  });

  it('has Subscribe to all events link with correct feed URL and target=_blank', () => {
    const event = createMockEvent();
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    const feedLink = screen.getByTestId('subscribe-feed-link');
    expect(feedLink).toHaveAttribute(
      'href',
      'http://localhost:3000/api/events/feed.ics'
    );
    expect(feedLink).toHaveAttribute('target', '_blank');
    expect(feedLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const event = createMockEvent();
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    await user.click(screen.getByTestId('modal-close-button'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay background is clicked', async () => {
    const user = userEvent.setup();
    const event = createMockEvent();
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    await user.click(screen.getByTestId('event-detail-overlay'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('ESC key calls onClose', () => {
    const event = createMockEvent();
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('has correct aria-labelledby matching title id', () => {
    const event = createMockEvent();
    render(
      <EventDetailModal
        event={event}
        onClose={mockOnClose}
        onRsvp={mockOnRsvp}
        onRemoveRsvp={mockOnRemoveRsvp}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'event-detail-title');
    expect(document.getElementById('event-detail-title')).toHaveTextContent('Test Event Detail');
  });
});
