/**
 * MonthCalendar Component
 *
 * Renders a 7-column Sun-Sat month grid using native Date API.
 * Events appear as color-coded pills on their start date.
 * Mobile responsive: collapses to current-week list on small screens.
 *
 * Story: BL-025.3
 * ACs: 2, 10, 12
 */

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { type EventItem } from '@/services/eventService';

export interface MonthCalendarProps {
  events: EventItem[];
  onEventClick: (event: EventItem) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_PILLS_PER_CELL = 3;

export function MonthCalendar({ events, onEventClick }: MonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = lastDay.getDate();

  const cells: (number | null)[] = useMemo(
    () => [
      ...Array(startPadding).fill(null) as null[],
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ],
    [startPadding, daysInMonth]
  );

  // Today check
  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  // Get events for a specific day
  const eventsForDay = (dayNumber: number): EventItem[] => {
    return events.filter((e) => {
      const eventDate = new Date(e.start_time);
      return (
        eventDate.getFullYear() === year &&
        eventDate.getMonth() === month &&
        eventDate.getDate() === dayNumber
      );
    });
  };

  // Check if any event falls in the current month
  const hasEventsInMonth = useMemo(
    () =>
      events.some((e) => {
        const d = new Date(e.start_time);
        return d.getFullYear() === year && d.getMonth() === month;
      }),
    [events, year, month]
  );

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };
  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const monthYearLabel = currentMonth.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  // Pill color based on RSVP status
  const getPillClass = (event: EventItem): string => {
    switch (event.rsvp_status) {
      case 'going':
        return 'bg-green-200 text-green-800 hover:bg-green-300';
      case 'maybe':
        return 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300';
      default:
        return 'bg-gray-200 text-gray-700 hover:bg-gray-300';
    }
  };

  // Mobile: current week events
  const mobileWeekData = useMemo(() => {
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay(); // 0 = Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekEvents = events.filter((e) => {
      const d = new Date(e.start_time);
      return d >= monday && d <= sunday;
    });

    const headerStart = monday.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const headerEnd = sunday.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });

    return {
      events: weekEvents,
      header: `Week of ${headerStart} \u2013 ${headerEnd}`,
    };
  }, [events]);

  return (
    <div>
      {/* Navigation header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium"
          data-testid="prev-month"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <h2
          className="text-lg font-semibold text-gray-900"
          data-testid="month-year-header"
        >
          {monthYearLabel}
        </h2>
        <button
          onClick={goToNextMonth}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium"
          data-testid="next-month"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Desktop: Full month grid */}
      <div className="hidden md:block" data-testid="desktop-calendar-grid">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-1">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-2"
              data-testid="day-header"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {cells.map((day, index) => {
            if (day === null) {
              return (
                <div
                  key={`pad-${index}`}
                  className="bg-gray-50 min-h-[80px] p-1"
                />
              );
            }

            const dayEvents = eventsForDay(day);
            const visibleEvents = dayEvents.slice(0, MAX_PILLS_PER_CELL);
            const overflowCount = dayEvents.length - MAX_PILLS_PER_CELL;
            const todayHighlight = isToday(day);

            return (
              <div
                key={`day-${day}`}
                className={`bg-white min-h-[80px] p-1 ${todayHighlight ? 'ring-2 ring-inset ring-green-400' : ''}`}
                data-testid={`day-cell-${day}`}
              >
                <div
                  className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    todayHighlight
                      ? 'bg-green-100 font-bold text-green-800'
                      : 'text-gray-700'
                  }`}
                  data-testid={todayHighlight ? 'today-indicator' : undefined}
                >
                  {day}
                </div>
                <div className="space-y-0.5">
                  {visibleEvents.map((evt, evtIndex) => (
                    <button
                      key={`${evt.id}-${evt.start_time}-${evtIndex}`}
                      onClick={() => onEventClick(evt)}
                      className={`block w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded truncate ${getPillClass(evt)}`}
                      title={evt.title}
                      data-testid="event-pill"
                    >
                      {evt.is_recurring && (
                        <RotateCw className="h-2.5 w-2.5 inline mr-0.5" />
                      )}
                      {evt.title.length > 12
                        ? `${evt.title.substring(0, 12)}...`
                        : evt.title}
                    </button>
                  ))}
                  {overflowCount > 0 && (
                    <span className="text-[10px] text-gray-500 pl-1">
                      +{overflowCount} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty month state */}
        {!hasEventsInMonth && (
          <p
            className="text-center text-gray-500 py-6"
            data-testid="empty-month-message"
          >
            No events this month.
          </p>
        )}
      </div>

      {/* Mobile: Week view */}
      <div className="block md:hidden" data-testid="mobile-week-view">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">
          {mobileWeekData.header}
        </h3>
        {mobileWeekData.events.length === 0 ? (
          <p className="text-center text-gray-500 py-6">
            No events this week.
          </p>
        ) : (
          <div className="space-y-2">
            {mobileWeekData.events.map((evt, index) => (
              <button
                key={`${evt.id}-${evt.start_time}-${index}`}
                onClick={() => onEventClick(evt)}
                className="block w-full text-left bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-shadow"
              >
                <p className="font-medium text-gray-900 text-sm">
                  {evt.is_recurring && (
                    <RotateCw className="h-3 w-3 inline mr-1 text-gray-500" />
                  )}
                  {evt.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(evt.start_time).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
