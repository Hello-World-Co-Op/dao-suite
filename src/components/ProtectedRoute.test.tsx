/**
 * ProtectedRoute Tests — BL-027.2
 *
 * Tests for ic_principal propagation through localStorage user_data.
 *
 * Story: BL-027.2 — Propagate IC Principal Through Session and Frontend Auth State
 * AC: 4
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

    render(
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

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('user_data') || '{}');
      expect(stored.icPrincipal).toBe('2vxsx-fae');
    });
  });
});
