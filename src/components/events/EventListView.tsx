/**
 * EventListView Component
 *
 * Shows upcoming events grouped by date in chronological order.
 * Events are sorted ascending by start_time with date group headers.
 *
 * Story: BL-025.3
 * ACs: 3, 13
 */

import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { type EventItem } from '@/services/eventService';
import { EventCard } from './EventCard';

export interface EventListViewProps {
  events: EventItem[];
  loading: boolean;
  onEventClick: (event: EventItem) => void;
  onRsvp: (
    eventId: string,
    status: 'going' | 'maybe' | 'not_going'
  ) => Promise<void>;
  onRemoveRsvp: (eventId: string) => Promise<void>;
  rsvpLoading: string | null;
}

interface EventGroup {
  dateKey: string;
  headerLabel: string;
  events: EventItem[];
}

export function EventListView({
  events,
  loading,
  onEventClick,
  onRsvp,
  onRemoveRsvp,
  rsvpLoading,
}: EventListViewProps) {
  // Group events by date — must be called unconditionally (React hooks rules)
  const groups = useMemo(() => {
    if (events.length === 0) return [];

    // Sort ascending by start_time
    const sorted = [...events].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    const groupMap = new Map<string, EventItem[]>();
    for (const event of sorted) {
      const dateKey = new Date(event.start_time).toDateString();
      const existing = groupMap.get(dateKey);
      if (existing) {
        existing.push(event);
      } else {
        groupMap.set(dateKey, [event]);
      }
    }

    const result: EventGroup[] = [];
    for (const [dateKey, groupEvents] of groupMap) {
      const headerLabel = new Date(
        groupEvents[0].start_time
      ).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      result.push({ dateKey, headerLabel, events: groupEvents });
    }

    return result;
  }, [events]);

  // Loading state: skeleton cards
  if (loading) {
    return (
      <div
        className="animate-pulse space-y-4"
        data-testid="events-loading-skeleton"
      >
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  // Empty state
  if (events.length === 0) {
    return (
      <div
        data-testid="events-empty-state"
        className="text-center py-12 text-gray-500"
      >
        <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
        <p className="text-lg font-medium">No upcoming events.</p>
        <p>Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="event-list-view">
      {groups.map((group) => (
        <div key={group.dateKey}>
          <h3
            className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 border-b border-gray-200 pb-1"
            data-testid="date-group-header"
          >
            {group.headerLabel}
          </h3>
          <div className="space-y-3">
            {group.events.map((event, index) => (
              <EventCard
                key={`${event.id}-${event.start_time}-${index}`}
                event={event}
                onRsvp={onRsvp}
                onRemoveRsvp={onRemoveRsvp}
                onViewDetails={onEventClick}
                rsvpLoading={rsvpLoading}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
