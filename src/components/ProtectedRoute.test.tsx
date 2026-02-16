/**
 * ProtectedRoute Tests — BL-027.2 + BL-028.3
 *
 * Tests for ic_principal and displayName propagation through localStorage user_data.
 *
 * Story: BL-027.2 — Propagate IC Principal Through Session and Frontend Auth State
 * Story: BL-028.3 — Display Name from Session
 * AC: BL-027.2 AC4, BL-028.3 AC6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock auth utils before importing ProtectedRoute
vi.mock('../utils/auth', () => ({
  isAuthenticated: vi.fn(() => false),
  isAccessTokenExpired: vi.fn(() => false),
  getRefreshToken: vi.fn(() => null),
  storeTokens: vi.fn(),
  clearTokens: vi.fn(),
  getTimezone: vi.fn(() => 'UTC'),
  getUserAgent: vi.fn(() => 'test-agent'),
  getStoredTokens: vi.fn(() => null),
}));

vi.mock('../utils/deviceFingerprint', () => ({
  getDeviceFingerprint: vi.fn(() => Promise.resolve('test-fp')),
}));

vi.mock('../hooks/useAuthService', () => ({
  useAuthService: () => ({
    refreshTokens: vi.fn(),
  }),
}));

const mockCheckSession = vi.fn();
vi.mock('../services/authCookieClient', () => ({
  checkSession: (...args: unknown[]) => mockCheckSession(...args),
}));

import { ProtectedRoute } from './ProtectedRoute';

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div data-testid="content">Protected</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute — ic_principal in localStorage (BL-027.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('stores ic_principal in localStorage user_data when session includes it', async () => {
    mockCheckSession.mockResolvedValue({
      authenticated: true,
      userId: 'user-1',
      membershipStatus: 'Active',
      icPrincipal: '2vxsx-fae',
    });

    renderProtected();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('user_data') || '{}');
      expect(stored.icPrincipal).toBe('2vxsx-fae');
    });
  });
});

describe('ProtectedRoute — displayName from session (BL-028.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // -------------------------------------------------------------------------
  // AC6: Uses displayName from session when available
  // -------------------------------------------------------------------------
  it('should use displayName from session when available', async () => {
    mockCheckSession.mockResolvedValue({
      authenticated: true,
      userId: 'user-1',
      email: 'coby@example.com',
      displayName: 'Alice',
      icPrincipal: null,
    });

    renderProtected();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('user_data') || '{}');
      expect(stored.firstName).toBe('Alice');
    });
  });

  // -------------------------------------------------------------------------
  // AC6: Falls back to email prefix when displayName is null
  // -------------------------------------------------------------------------
  it('should fall back to email prefix when displayName is null', async () => {
    mockCheckSession.mockResolvedValue({
      authenticated: true,
      userId: 'user-1',
      email: 'coby@example.com',
      displayName: null,
      icPrincipal: null,
    });

    renderProtected();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('user_data') || '{}');
      expect(stored.firstName).toBe('coby');
    });
  });

  // -------------------------------------------------------------------------
  // AC6: Falls back to "Member" when displayName and email are null
  // -------------------------------------------------------------------------
  it('should fall back to "Member" when displayName and email are null', async () => {
    mockCheckSession.mockResolvedValue({
      authenticated: true,
      userId: 'user-1',
      email: null,
      displayName: null,
      icPrincipal: null,
    });

    renderProtected();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('user_data') || '{}');
      expect(stored.firstName).toBe('Member');
    });
  });

  // -------------------------------------------------------------------------
  // displayName takes precedence over existing firstName in localStorage
  // -------------------------------------------------------------------------
  it('should override existing firstName with displayName from session', async () => {
    // Pre-populate localStorage with old firstName
    localStorage.setItem('user_data', JSON.stringify({
      userId: 'user-1',
      email: 'coby@example.com',
      firstName: 'coby',
      lastName: '',
      icPrincipal: null,
    }));

    mockCheckSession.mockResolvedValue({
      authenticated: true,
      userId: 'user-1',
      email: 'coby@example.com',
      displayName: 'Alice',
      icPrincipal: null,
    });

    renderProtected();

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('user_data') || '{}');
      expect(stored.firstName).toBe('Alice');
    });
  });
});
