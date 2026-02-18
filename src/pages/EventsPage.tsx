/**
 * Events Page
 *
 * Top-level page for browsing co-op events with month/list view toggle,
 * RSVP management, and event detail modal.
 *
 * Story: BL-025.3
 * ACs: 1, 4, 13
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Home, Calendar, List, LayoutGrid } from 'lucide-react';
import {
  listEvents,
  rsvpEvent,
  removeRsvp,
  EventApiError,
  type EventItem,
} from '@/services/eventService';
import { MonthCalendar } from '@/components/events/MonthCalendar';
import { EventListView } from '@/components/events/EventListView';
import { EventDetailModal } from '@/components/events/EventDetailModal';

export default function EventsPage() {
  const navigate = useNavigate();

  // State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'list'>(() => {
    const stored = localStorage.getItem('dao_suite_events_view');
    return stored === 'month' ? 'month' : 'list'; // default: list
  });
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  // Fetch events on mount
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 1); // 1 day ago
      const to = new Date();
      to.setDate(to.getDate() + 90); // 90 days ahead
      const result = await listEvents(from.toISOString(), to.toISOString());
      setEvents(result.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Persist view toggle
  const handleViewChange = (newView: 'month' | 'list') => {
    setView(newView);
    localStorage.setItem('dao_suite_events_view', newView);
  };

  // RSVP handler
  const handleRsvp = async (
    eventId: string,
    status: 'going' | 'maybe' | 'not_going'
  ) => {
    setRsvpLoading(eventId);
    setRsvpError(null);
    try {
      const response = await rsvpEvent(eventId, status);
      // Optimistically update events
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                rsvp_status: response.status,
                attendee_count:
                  response.status === 'going' && e.rsvp_status !== 'going'
                    ? e.attendee_count + 1
                    : response.status !== 'going' && e.rsvp_status === 'going'
                      ? Math.max(0, e.attendee_count - 1)
                      : e.attendee_count,
              }
            : e
        )
      );
      // Update selectedEvent if open
      setSelectedEvent((prev) =>
        prev?.id === eventId ? { ...prev, rsvp_status: response.status } : prev
      );
    } catch (e) {
      if (e instanceof EventApiError && e.status === 409) {
        setRsvpError(
          'This event is at capacity. You cannot RSVP as Going.'
        );
      } else {
        setRsvpError(
          e instanceof Error ? e.message : 'Failed to update RSVP'
        );
      }
    } finally {
      setRsvpLoading(null);
    }
  };

  // Remove RSVP handler
  const handleRemoveRsvp = async (eventId: string) => {
    setRsvpLoading(eventId);
    setRsvpError(null);
    try {
      await removeRsvp(eventId);
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                rsvp_status: null,
                attendee_count:
                  e.rsvp_status === 'going'
                    ? Math.max(0, e.attendee_count - 1)
                    : e.attendee_count,
              }
            : e
        )
      );
      setSelectedEvent((prev) =>
        prev?.id === eventId ? { ...prev, rsvp_status: null } : prev
      );
    } catch (e) {
      setRsvpError(
        e instanceof Error ? e.message : 'Failed to remove RSVP'
      );
    } finally {
      setRsvpLoading(null);
    }
  };

  // Auto-clear RSVP error after 5 seconds
  useEffect(() => {
    if (rsvpError) {
      const t = setTimeout(() => setRsvpError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [rsvpError]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium focus:outline-none focus:underline transition-colors duration-150"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium focus:outline-none focus:underline transition-colors duration-150"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </div>

          {/* Page Title + View Toggle */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-7 w-7 text-teal-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                Events Calendar
              </h1>
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => handleViewChange('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === 'list'
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                data-testid="view-toggle-list"
              >
                <List className="h-4 w-4" />
                List
              </button>
              <button
                onClick={() => handleViewChange('month')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === 'month'
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                data-testid="view-toggle-month"
              >
                <LayoutGrid className="h-4 w-4" />
                Month
              </button>
            </div>
          </div>
          <p className="text-gray-600 mt-2">
            Browse upcoming co-op events, RSVP to attend, and add events to your
            personal calendar.
          </p>
        </div>

        {/* RSVP error banner */}
        {rsvpError && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm"
            data-testid="rsvp-error-banner"
          >
            {rsvpError}
          </div>
        )}

        {/* Fetch error banner */}
        {error && !loading && (
          <div
            role="alert"
            className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md"
            data-testid="fetch-error-banner"
          >
            <p className="font-medium mb-2">{error}</p>
            <button
              onClick={fetchEvents}
              className="text-sm font-medium text-red-800 underline hover:no-underline"
              data-testid="try-again-button"
            >
              Try again
            </button>
          </div>
        )}

        {/* Views */}
        {view === 'list' ? (
          <EventListView
            events={events}
            loading={loading}
            onEventClick={(event) => setSelectedEvent(event)}
            onRsvp={handleRsvp}
            onRemoveRsvp={handleRemoveRsvp}
            rsvpLoading={rsvpLoading}
          />
        ) : (
          loading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg" />
              ))}
            </div>
          ) : (
            <MonthCalendar
              events={events}
              onEventClick={(event) => setSelectedEvent(event)}
            />
          )
        )}

        {/* Event Detail Modal */}
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRsvp={handleRsvp}
          onRemoveRsvp={handleRemoveRsvp}
          rsvpLoading={rsvpLoading}
        />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Events are shown in your local timezone.</p>
        </div>
      </div>
    </div>
  );
}
