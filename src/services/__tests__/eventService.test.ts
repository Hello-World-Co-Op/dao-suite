/**
 * Event Service Tests
 *
 * Story: BL-025.3
 * AC: 14
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listEvents,
  rsvpEvent,
  removeRsvp,
  getIcsUrl,
  getFeedUrl,
  EventApiError,
} from '@/services/eventService';

// Mock the oracleBridge utility
vi.mock('@/utils/oracleBridge', () => ({
  getOracleBridgeUrl: () => 'http://localhost:3000',
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('eventService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('listEvents', () => {
    it('fetches events with correct URL and credentials', async () => {
      const mockResponse = { events: [], total: 0 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await listEvents('2026-03-01T00:00:00Z', '2026-04-01T00:00:00Z');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(callUrl).toContain('http://localhost:3000/api/events');
      expect(callUrl).toContain('from=2026-03-01T00%3A00%3A00Z');
      expect(callUrl).toContain('to=2026-04-01T00%3A00%3A00Z');
      expect(callUrl).toContain('page=1');
      expect(callUrl).toContain('page_size=100');
      expect(mockFetch.mock.calls[0][1]).toEqual({ credentials: 'include' });
      expect(result).toEqual(mockResponse);
    });

    it('throws EventApiError on 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      await expect(listEvents()).rejects.toThrow(EventApiError);
      await expect(
        listEvents().catch((e) => {
          expect(e.status).toBe(401);
          throw e;
        })
      ).rejects.toThrow();
    });

    it('throws EventApiError on 500 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      await expect(listEvents()).rejects.toThrow(EventApiError);
      await expect(
        listEvents().catch((e) => {
          expect(e.status).toBe(500);
          throw e;
        })
      ).rejects.toThrow();
    });
  });

  describe('rsvpEvent', () => {
    it('sends POST with correct body for going status', async () => {
      const mockRsvp = {
        event_id: 'evt-1',
        user_id: 'user-1',
        status: 'going' as const,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockRsvp),
      });

      const result = await rsvpEvent('evt-1', 'going');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe(
        'http://localhost:3000/api/events/evt-1/rsvp'
      );
      expect(mockFetch.mock.calls[0][1]).toEqual({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'going' }),
      });
      expect(result).toEqual(mockRsvp);
    });

    it('throws EventApiError with 409 for capacity', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: 'At capacity' }),
      });

      try {
        await rsvpEvent('evt-1', 'going');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(EventApiError);
        expect((e as EventApiError).status).toBe(409);
        expect((e as EventApiError).message).toBe('Event is at capacity');
      }
    });

    it('throws EventApiError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      try {
        await rsvpEvent('evt-1', 'maybe');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(EventApiError);
        expect((e as EventApiError).status).toBe(401);
      }
    });
  });

  describe('removeRsvp', () => {
    it('resolves void on 204 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await expect(removeRsvp('evt-1')).resolves.toBeUndefined();
      expect(mockFetch.mock.calls[0][0]).toBe(
        'http://localhost:3000/api/events/evt-1/rsvp'
      );
      expect(mockFetch.mock.calls[0][1]).toEqual({
        method: 'DELETE',
        credentials: 'include',
      });
    });

    it('throws EventApiError on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      try {
        await removeRsvp('evt-1');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(EventApiError);
        expect((e as EventApiError).status).toBe(404);
        expect((e as EventApiError).message).toBe('No RSVP found');
      }
    });
  });

  describe('getIcsUrl', () => {
    it('returns correct ICS URL with event ID', () => {
      expect(getIcsUrl('abc-123')).toBe(
        'http://localhost:3000/api/events/abc-123/ics'
      );
    });
  });

  describe('getFeedUrl', () => {
    it('returns correct feed URL', () => {
      expect(getFeedUrl()).toBe('http://localhost:3000/api/events/feed.ics');
    });
  });
});
