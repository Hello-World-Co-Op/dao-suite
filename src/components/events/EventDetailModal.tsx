/**
 * EventDetailModal Component
 *
 * Full-detail modal for viewing event information, RSVP, and calendar actions.
 * Renders markdown description, location links, attendee stats, and RSVP controls.
 *
 * Story: BL-025.3
 * ACs: 7, 8, 9
 */

import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import {
  X,
  MapPin,
  Video,
  RotateCw,
  CalendarPlus,
  Rss,
  Loader2,
} from 'lucide-react';
import { type EventItem, getIcsUrl, getFeedUrl } from '@/services/eventService';

export interface EventDetailModalProps {
  event: EventItem | null;
  onClose: () => void;
  onRsvp: (
    eventId: string,
    status: 'going' | 'maybe' | 'not_going'
  ) => Promise<void>;
  onRemoveRsvp: (eventId: string) => Promise<void>;
  rsvpLoading?: string | null;
}

export function EventDetailModal({
  event,
  onClose,
  onRsvp,
  onRemoveRsvp,
  rsvpLoading,
}: EventDetailModalProps) {
  // ESC key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!event) return null;

  const isLoading = rsvpLoading === event.id;
  const isFull =
    event.max_attendees !== null &&
    event.attendee_count >= event.max_attendees;

  // Date/time formatting in user's local timezone
  const localTime = new Date(event.start_time).toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const localEndTime = new Date(event.end_time).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const timezoneNote = `Event timezone: ${event.timezone}`;

  const handleRsvpClick = (status: 'going' | 'maybe' | 'not_going') => {
    if (isLoading) return;
    if (event.rsvp_status === status) {
      onRemoveRsvp(event.id);
    } else {
      onRsvp(event.id, status);
    }
  };

  const isGoingDisabled = isFull && event.rsvp_status !== 'going';

  // Determine location display
  const isVirtual =
    event.location?.toLowerCase() === 'virtual' || (!event.location && event.location_url);
  const hasPhysicalLocation =
    event.location && event.location.toLowerCase() !== 'virtual';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto pt-16 pb-8"
      onClick={onClose}
      data-testid="event-detail-overlay"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-0">
          <div className="flex-1 pr-4">
            <h2
              id="event-detail-title"
              className="text-xl font-bold text-gray-900"
            >
              {event.title}
            </h2>
            {event.is_recurring && (
              <span className="inline-flex items-center gap-0.5 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1">
                <RotateCw className="h-3 w-3" />
                Recurring
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            aria-label="Close"
            data-testid="modal-close-button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Date/time */}
          <div>
            <p className="text-gray-800 font-medium">
              {localTime} &ndash; {localEndTime}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{timezoneNote}</p>
          </div>

          {/* Location */}
          {(hasPhysicalLocation || (isVirtual && event.location_url)) && (
            <div className="space-y-1">
              {hasPhysicalLocation && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700">{event.location}</p>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(event.location!)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-600 hover:text-teal-800"
                      data-testid="google-maps-link"
                    >
                      View on Google Maps
                    </a>
                  </div>
                </div>
              )}
              {event.location_url && (
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <a
                    href={event.location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-teal-600 hover:text-teal-800"
                    data-testid="virtual-link"
                  >
                    Join virtual event
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div
              className="text-gray-700 leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_a]:text-teal-600 [&_a]:underline"
              data-testid="event-description"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
              >
                {event.description}
              </ReactMarkdown>
            </div>
          )}

          {/* Attendee stats */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span data-testid="modal-attendee-count">
              {event.attendee_count} going
            </span>
            {isFull && (
              <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                Full
              </span>
            )}
          </div>

          {/* RSVP controls */}
          <div
            className="flex items-center gap-2"
            data-testid="modal-rsvp-buttons"
          >
            <ModalRsvpButton
              label="Going"
              isActive={event.rsvp_status === 'going'}
              isLoading={isLoading}
              isDisabled={isLoading || isGoingDisabled}
              activeClass="bg-green-600 text-white hover:bg-green-700"
              onClick={() => handleRsvpClick('going')}
            />
            <ModalRsvpButton
              label="Maybe"
              isActive={event.rsvp_status === 'maybe'}
              isLoading={isLoading}
              isDisabled={isLoading}
              activeClass="bg-yellow-500 text-white hover:bg-yellow-600"
              onClick={() => handleRsvpClick('maybe')}
            />
            <ModalRsvpButton
              label="Not Going"
              isActive={event.rsvp_status === 'not_going'}
              isLoading={isLoading}
              isDisabled={isLoading}
              activeClass="bg-gray-500 text-white hover:bg-gray-600"
              onClick={() => handleRsvpClick('not_going')}
            />
          </div>

          {/* Calendar actions */}
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
            <a
              href={getIcsUrl(event.id)}
              download
              className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 transition-colors"
              data-testid="modal-add-to-calendar"
            >
              <CalendarPlus className="h-4 w-4" />
              Add to Calendar
            </a>
            <a
              href={getFeedUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 transition-colors"
              data-testid="subscribe-feed-link"
            >
              <Rss className="h-4 w-4" />
              Subscribe to all events (ICS)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ModalRsvpButton Sub-component
// ============================================================================

interface ModalRsvpButtonProps {
  label: string;
  isActive: boolean;
  isLoading: boolean;
  isDisabled: boolean;
  activeClass: string;
  onClick: () => void;
}

function ModalRsvpButton({
  label,
  isActive,
  isLoading,
  isDisabled,
  activeClass,
  onClick,
}: ModalRsvpButtonProps) {
  const baseClass =
    'px-3 py-1.5 text-sm font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-teal-500';
  const inactiveClass =
    'border-gray-300 text-gray-700 bg-white hover:bg-gray-50';

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClass} ${isActive ? activeClass : inactiveClass} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      data-testid={`modal-rsvp-${label.toLowerCase().replace(/\s/g, '-')}`}
      aria-pressed={isActive}
    >
      {isActive && isLoading ? (
        <Loader2
          className="h-4 w-4 animate-spin inline mr-1"
          data-testid="modal-rsvp-spinner"
        />
      ) : null}
      {label}
    </button>
  );
}
