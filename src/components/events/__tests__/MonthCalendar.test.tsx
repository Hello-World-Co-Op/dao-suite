/**
 * MonthCalendar Component Tests
 *
 * Story: BL-025.3
 * AC: 14
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MonthCalendar } from '@/components/events/MonthCalendar';
import { type EventItem } from '@/services/eventService';

// Mock oracleBridge (EventCard uses getIcsUrl internally)
vi.mock('@/utils/oracleBridge', () => ({
  getOracleBridgeUrl: () => 'http://localhost:3000',
}));

function createMockEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'evt-1',
    title: 'Calendar Event',
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

describe('MonthCalendar', () => {
  const mockOnEventClick = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders 7 column headers (Sun Mon Tue Wed Thu Fri Sat)', () => {
    render(<MonthCalendar events={[]} onEventClick={mockOnEventClick} />);

    const headers = screen.getAllByTestId('day-header');
    expect(headers).toHaveLength(7);
    expect(headers[0]).toHaveTextContent('Sun');
    expect(headers[1]).toHaveTextContent('Mon');
    expect(headers[6]).toHaveTextContent('Sat');
  });

  it('renders day cells for the current month', () => {
    render(<MonthCalendar events={[]} onEventClick={mockOnEventClick} />);

    // Current month should have day cells
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    // At minimum, day 1 and the last day should exist
    expect(screen.getByTestId('day-cell-1')).toBeInTheDocument();
    expect(screen.getByTestId(`day-cell-${daysInMonth}`)).toBeInTheDocument();
  });

  it('shows today indicator on current date cell', () => {
    render(<MonthCalendar events={[]} onEventClick={mockOnEventClick} />);

    const todayIndicator = screen.getByTestId('today-indicator');
    expect(todayIndicator).toBeInTheDocument();

    const today = new Date();
    expect(todayIndicator).toHaveTextContent(String(today.getDate()));
  });

  it('renders event pills on the correct date', () => {
    // Create an event on the 15th of current month
    const now = new Date();
    const eventDate = new Date(now.getFullYear(), now.getMonth(), 15, 14, 0, 0);
    const event = createMockEvent({
      start_time: eventDate.toISOString(),
      title: 'Team Meeting',
    });

    render(
      <MonthCalendar events={[event]} onEventClick={mockOnEventClick} />
    );

    const dayCell = screen.getByTestId('day-cell-15');
    const pill = within(dayCell).getByTestId('event-pill');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('Team Meeting');
  });

  it('clicking an event pill calls onEventClick', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const eventDate = new Date(now.getFullYear(), now.getMonth(), 15, 14, 0, 0);
    const event = createMockEvent({
      start_time: eventDate.toISOString(),
      title: 'Clickable Event',
    });

    render(
      <MonthCalendar events={[event]} onEventClick={mockOnEventClick} />
    );

    const pill = screen.getByTestId('event-pill');
    await user.click(pill);
    expect(mockOnEventClick).toHaveBeenCalledWith(event);
  });

  it('Next button advances to next month', async () => {
    const user = userEvent.setup();
    render(<MonthCalendar events={[]} onEventClick={mockOnEventClick} />);

    const header = screen.getByTestId('month-year-header');
    const currentMonthText = header.textContent;

    await user.click(screen.getByTestId('next-month'));

    const newHeader = screen.getByTestId('month-year-header');
    expect(newHeader.textContent).not.toBe(currentMonthText);
  });

  it('Previous button goes back to previous month', async () => {
    const user = userEvent.setup();
    render(<MonthCalendar events={[]} onEventClick={mockOnEventClick} />);

    const header = screen.getByTestId('month-year-header');
    const currentMonthText = header.textContent;

    await user.click(screen.getByTestId('prev-month'));

    const newHeader = screen.getByTestId('month-year-header');
    expect(newHeader.textContent).not.toBe(currentMonthText);
  });

  it('month/year header updates on navigation', async () => {
    const user = userEvent.setup();
    render(<MonthCalendar events={[]} onEventClick={mockOnEventClick} />);

    const now = new Date();
    const currentLabel = now.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
    expect(screen.getByTestId('month-year-header')).toHaveTextContent(currentLabel);

    await user.click(screen.getByTestId('next-month'));

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextLabel = nextMonth.toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
    expect(screen.getByTestId('month-year-header')).toHaveTextContent(nextLabel);
  });

  it('shows recurring event indicator on pill', () => {
    const now = new Date();
    const eventDate = new Date(now.getFullYear(), now.getMonth(), 10, 10, 0, 0);
    const event = createMockEvent({
      start_time: eventDate.toISOString(),
      is_recurring: true,
      title: 'Weekly Sync',
    });

    render(
      <MonthCalendar events={[event]} onEventClick={mockOnEventClick} />
    );

    // The pill should contain the RotateCw icon (SVG)
    const dayCell = screen.getByTestId('day-cell-10');
    const pill = within(dayCell).getByTestId('event-pill');
    // RotateCw renders an SVG - check it exists inside the pill
    expect(pill.querySelector('svg')).toBeInTheDocument();
  });

  it('renders mobile week view container in DOM', () => {
    render(<MonthCalendar events={[]} onEventClick={mockOnEventClick} />);

    expect(screen.getByTestId('mobile-week-view')).toBeInTheDocument();
  });
});
