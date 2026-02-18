/**
 * EventCard Component
 *
 * Displays an event with title, date/time, location, RSVP controls,
 * capacity badge, and "Add to Calendar" download link.
 *
 * Story: BL-025.3
 * ACs: 5, 6, 7, 11
 */

import React from 'react';
import { Loader2, RotateCw, CalendarPlus } from 'lucide-react';
import { type EventItem, getIcsUrl } from '@/services/eventService';

export interface EventCardProps {
  event: EventItem;
  onRsvp: (eventId: string, status: 'going' | 'maybe' | 'not_going') => Promise<void>;
  onRemoveRsvp: (eventId: string) => Promise<void>;
  onViewDetails: (event: EventItem) => void;
  rsvpLoading?: string | null;
}

export function EventCard({
  event,
  onRsvp,
  onRemoveRsvp,
  onViewDetails,
  rsvpLoading,
}: EventCardProps) {
  const isLoading = rsvpLoading === event.id;
  const isFull =
    event.max_attendees !== null &&
    event.attendee_count >= event.max_attendees;

  const formattedDate = new Date(event.start_time).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const truncatedLocation =
    event.location && event.location.length > 40
      ? `${event.location.substring(0, 40)}...`
      : event.location;

  const handleRsvpClick = (status: 'going' | 'maybe' | 'not_going') => {
    if (isLoading) return;
    if (event.rsvp_status === status) {
      onRemoveRsvp(event.id);
    } else {
      onRsvp(event.id, status);
    }
  };

  const isGoingDisabled =
    isFull && event.rsvp_status !== 'going';

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
      data-testid={`event-card-${event.id}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <button
            onClick={() => onViewDetails(event)}
            className="text-left text-lg font-semibold text-gray-900 hover:text-teal-700 transition-colors"
            data-testid="event-card-title"
          >
            {event.title}
          </button>
          {event.is_recurring && (
            <span
              className="ml-2 inline-flex items-center gap-0.5 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded"
              data-testid="recurring-badge"
            >
              <RotateCw className="h-3 w-3" />
              Recurring
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <span data-testid="attendee-count">{event.attendee_count} going</span>
          {isFull && (
            <span
              className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-2"
              data-testid="full-badge"
            >
              Full
            </span>
          )}
        </div>
      </div>

      {/* Date/time */}
      <p className="text-sm text-gray-600 mb-1">{formattedDate}</p>

      {/* Location */}
      {truncatedLocation && (
        <p className="text-sm text-gray-500 mb-3">{truncatedLocation}</p>
      )}

      {/* RSVP buttons */}
      <div className="flex items-center gap-2 mb-3" data-testid="rsvp-buttons">
        <RsvpButton
          label="Going"
          isActive={event.rsvp_status === 'going'}
          isLoading={isLoading}
          isDisabled={isLoading || isGoingDisabled}
          activeClass="bg-green-600 text-white hover:bg-green-700"
          onClick={() => handleRsvpClick('going')}
        />
        <RsvpButton
          label="Maybe"
          isActive={event.rsvp_status === 'maybe'}
          isLoading={isLoading}
          isDisabled={isLoading}
          activeClass="bg-yellow-500 text-white hover:bg-yellow-600"
          onClick={() => handleRsvpClick('maybe')}
        />
        <RsvpButton
          label="Not Going"
          isActive={event.rsvp_status === 'not_going'}
          isLoading={isLoading}
          isDisabled={isLoading}
          activeClass="bg-gray-500 text-white hover:bg-gray-600"
          onClick={() => handleRsvpClick('not_going')}
        />
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-3 text-sm">
        <a
          href={getIcsUrl(event.id)}
          download
          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-800 transition-colors"
          data-testid="add-to-calendar-link"
        >
          <CalendarPlus className="h-4 w-4" />
          Add to Calendar
        </a>
        <button
          onClick={() => onViewDetails(event)}
          className="text-teal-600 hover:text-teal-800 transition-colors"
          data-testid="view-details-link"
        >
          View Details
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// RsvpButton Sub-component
// ============================================================================

interface RsvpButtonProps {
  label: string;
  isActive: boolean;
  isLoading: boolean;
  isDisabled: boolean;
  activeClass: string;
  onClick: () => void;
}

function RsvpButton({
  label,
  isActive,
  isLoading,
  isDisabled,
  activeClass,
  onClick,
}: RsvpButtonProps) {
  const baseClass =
    'px-3 py-1.5 text-sm font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-500';
  const inactiveClass =
    'border-gray-300 text-gray-700 bg-white hover:bg-gray-50';

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClass} ${isActive ? activeClass : inactiveClass} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      data-testid={`rsvp-${label.toLowerCase().replace(/\s/g, '-')}`}
      aria-pressed={isActive}
    >
      {isActive && isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin inline mr-1" data-testid="rsvp-spinner" />
      ) : null}
      {label}
    </button>
  );
}
