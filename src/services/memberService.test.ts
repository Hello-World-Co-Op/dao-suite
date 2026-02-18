/**
 * Member Service API Function Tests
 *
 * Unit tests for oracle-bridge fetch functions in memberService.ts.
 * Tests that the correct URLs, query params, and headers are sent to the API.
 *
 * Story: BL-021.2
 * ACs: 1, 4, 5, 9, 10
 * Task: 6.3(d) — search param is passed to fetch URL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchMembers,
  fetchMemberProfile,
  updateOwnProfile,
  getOwnVisibility,
  setOwnVisibility,
  getOracleBridgeUrl,
} from './memberService';

// ============================================================================
// Test helpers
// ============================================================================

function makeMockDirectoryEntry(overrides: Record<string, unknown> = {}) {
  return {
    principal: 'test-principal-abc',
    display_name: 'Test User',
    avatar: 'https://example.com/avatar.png',
    archetype: 'Builder',
    bio: 'A test user',
    join_date: '2025-06-15T00:00:00Z',
    is_active: true,
    ...overrides,
  };
}

function makeMockDirectoryResponse(overrides: Record<string, unknown> = {}) {
  return {
    entries: [makeMockDirectoryEntry()],
    total_count: 1,
    page: 1,
    page_size: 20,
    has_more: false,
    ...overrides,
  };
}

function mockFetchOk(body: unknown) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response)
  );
}

function mockFetchStatus(status: number, body = '') {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(body),
    } as Response)
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('memberService', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ORACLE_BRIDGE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // getOracleBridgeUrl
  // --------------------------------------------------------------------------

  describe('getOracleBridgeUrl', () => {
    it('returns VITE_ORACLE_BRIDGE_URL when set', () => {
      vi.stubEnv('VITE_ORACLE_BRIDGE_URL', 'https://oracle.helloworlddao.com');
      expect(getOracleBridgeUrl()).toBe('https://oracle.helloworlddao.com');
    });

    it('returns empty string or localhost:3000 when no env var (depends on build mode)', () => {
      vi.stubEnv('VITE_ORACLE_BRIDGE_URL', '');
      // In test mode (not PROD), this returns 'http://localhost:3000'.
      // In production build, import.meta.env.PROD is baked as true, returning ''.
      // We verify it returns a non-undefined value (behavior is build-mode dependent).
      const url = getOracleBridgeUrl();
      expect(url === 'http://localhost:3000' || url === '').toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // fetchMembers — AC4: search param is passed to fetch URL (Task 6.3d)
  // --------------------------------------------------------------------------

  describe('fetchMembers', () => {
    it('sends GET /api/members/directory with page and page_size query params', async () => {
      const mockFetch = mockFetchOk(makeMockDirectoryResponse());
      vi.stubGlobal('fetch', mockFetch);

      await fetchMembers(1, 20);

      expect(mockFetch).toHaveBeenCalledOnce();
      const call = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      const [url, options] = call;
      expect(url).toContain('/api/members/directory');
      expect(url).toContain('page=1');
      expect(url).toContain('page_size=20');
      expect(options).toMatchObject({ credentials: 'include' });
    });

    it('includes search query param in URL when search is provided (AC-4, Task 6.3d)', async () => {
      const mockFetch = mockFetchOk(makeMockDirectoryResponse({ entries: [] }));
      vi.stubGlobal('fetch', mockFetch);

      await fetchMembers(1, 20, 'alice builder');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0] as unknown as [string];
      // URLSearchParams encodes spaces as '+' in application/x-www-form-urlencoded
      expect(url).toMatch(/search=alice(\+|%20)builder/);
    });

    it('does NOT include search param when search is empty (Task 6.3d)', async () => {
      const mockFetch = mockFetchOk(makeMockDirectoryResponse());
      vi.stubGlobal('fetch', mockFetch);

      await fetchMembers(1, 20, '');

      const [url] = mockFetch.mock.calls[0] as unknown as [string];
      expect(url).not.toContain('search=');
    });

    it('does NOT include search param when search is whitespace only', async () => {
      const mockFetch = mockFetchOk(makeMockDirectoryResponse());
      vi.stubGlobal('fetch', mockFetch);

      await fetchMembers(1, 20, '   ');

      const [url] = mockFetch.mock.calls[0] as unknown as [string];
      expect(url).not.toContain('search=');
    });

    it('maps oracle-bridge snake_case response to camelCase MemberProfile', async () => {
      const entry = makeMockDirectoryEntry({
        display_name: 'Alice',
        join_date: '2025-01-01T00:00:00Z',
        is_active: true,
      });
      const mockFetch = mockFetchOk(makeMockDirectoryResponse({ entries: [entry] }));
      vi.stubGlobal('fetch', mockFetch);

      const result = await fetchMembers(1, 20);

      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(1);
      expect(result.members![0]).toMatchObject({
        displayName: 'Alice',
        joinDate: '2025-01-01T00:00:00Z',
        isActive: true,
        principal: 'test-principal-abc',
      });
    });

    it('returns success=false with error message on 401', async () => {
      const mockFetch = mockFetchStatus(401);
      vi.stubGlobal('fetch', mockFetch);

      const result = await fetchMembers(1, 20);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication');
    });

    it('returns success=false with error message on server error (500)', async () => {
      const mockFetch = mockFetchStatus(500, 'Internal Server Error');
      vi.stubGlobal('fetch', mockFetch);

      const result = await fetchMembers(1, 20);

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('returns success=false with error message when fetch throws (network error)', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network failure'))));

      const result = await fetchMembers(1, 20);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network failure');
    });

    it('returns has_more from oracle-bridge response', async () => {
      const mockFetch = mockFetchOk(makeMockDirectoryResponse({ has_more: true, total_count: 50 }));
      vi.stubGlobal('fetch', mockFetch);

      const result = await fetchMembers(1, 20);

      expect(result.success).toBe(true);
      expect(result.hasMore).toBe(true);
      expect(result.totalCount).toBe(50);
    });
  });

  // --------------------------------------------------------------------------
  // fetchMemberProfile
  // --------------------------------------------------------------------------

  describe('fetchMemberProfile', () => {
    it('sends GET /api/members/profile/:principal with credentials', async () => {
      const entry = makeMockDirectoryEntry();
      const mockFetch = mockFetchOk(entry);
      vi.stubGlobal('fetch', mockFetch);

      await fetchMemberProfile('test-principal-abc');

      const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain('/api/members/profile/test-principal-abc');
      expect(options).toMatchObject({ credentials: 'include' });
    });

    it('returns success=false when profile not found (404)', async () => {
      vi.stubGlobal('fetch', mockFetchStatus(404));

      const result = await fetchMemberProfile('unknown-principal');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // --------------------------------------------------------------------------
  // updateOwnProfile — AC9
  // --------------------------------------------------------------------------

  describe('updateOwnProfile', () => {
    it('sends PUT /api/members/profile with JSON body and credentials (AC-9)', async () => {
      const mockFetch = mockFetchOk({ success: true });
      vi.stubGlobal('fetch', mockFetch);

      const profileData = { display_name: 'Alice', bio: 'A test bio' };
      await updateOwnProfile(profileData);

      const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain('/api/members/profile');
      expect(options).toMatchObject({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(JSON.parse(options.body as string)).toEqual(profileData);
    });

    it('returns success=true on 200 response', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const result = await updateOwnProfile({ display_name: 'Bob' });

      expect(result.success).toBe(true);
    });

    it('returns success=false on 401', async () => {
      vi.stubGlobal('fetch', mockFetchStatus(401));

      const result = await updateOwnProfile({ display_name: 'Bob' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication');
    });
  });

  // --------------------------------------------------------------------------
  // getOwnVisibility / setOwnVisibility — AC9
  // --------------------------------------------------------------------------

  describe('getOwnVisibility', () => {
    it('sends GET /api/members/visibility with credentials', async () => {
      const mockFetch = mockFetchOk({ visibility: 'Public' });
      vi.stubGlobal('fetch', mockFetch);

      const result = await getOwnVisibility();

      const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain('/api/members/visibility');
      expect(options).toMatchObject({ credentials: 'include' });
      expect(result.success).toBe(true);
      expect(result.visibility).toBe('Public');
    });
  });

  describe('setOwnVisibility', () => {
    it('sends PUT /api/members/visibility with JSON body and credentials (AC-9)', async () => {
      const mockFetch = mockFetchOk({});
      vi.stubGlobal('fetch', mockFetch);

      await setOwnVisibility('MembersOnly');

      const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain('/api/members/visibility');
      expect(options).toMatchObject({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(JSON.parse(options.body as string)).toEqual({ visibility: 'MembersOnly' });
    });

    it('returns success=true on 200 response', async () => {
      vi.stubGlobal('fetch', mockFetchOk({}));

      const result = await setOwnVisibility('Private');

      expect(result.success).toBe(true);
    });
  });
});
