/**
 * LoginRedirect Tests
 *
 * Tests for the login redirect page that sends users to FounderyOS.
 *
 * @see FAS-6.1 - DAO Suite extraction
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginRedirect from './LoginRedirect';

// Mock validateReturnUrl
vi.mock('../utils/validateReturnUrl', () => ({
  validateReturnUrl: vi.fn((url) => url || '/dashboard'),
}));

describe('LoginRedirect', () => {
  let locationAssignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock window.location.href setter
    locationAssignMock = vi.fn();

    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        href: '',
        origin: 'http://localhost:5174',
      },
    });

    Object.defineProperty(window.location, 'href', {
      set: locationAssignMock,
      get: () => 'http://localhost:5174',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to FounderyOS login with returnUrl', () => {
    const fromLocation = { pathname: '/proposals/123' };

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: fromLocation } }]}>
        <Routes>
          <Route path="/login" element={<LoginRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to FounderyOS with dao-suite returnUrl
    expect(locationAssignMock).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:5174/login')
    );
    expect(locationAssignMock).toHaveBeenCalledWith(
      expect.stringContaining('returnUrl=http%3A%2F%2Flocalhost%3A5174%2Fproposals%2F123')
    );
  });

  it('should redirect to FounderyOS login with default returnUrl when no state', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect with default dashboard returnUrl
    expect(locationAssignMock).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:5174/login')
    );
    expect(locationAssignMock).toHaveBeenCalledWith(
      expect.stringContaining('returnUrl=http%3A%2F%2Flocalhost%3A5174%2Fdashboard')
    );
  });

  it('should include message in redirect URL', () => {
    render(
      <MemoryRouter initialEntries={['/login?message=Session+expired']}>
        <Routes>
          <Route
            path="/login"
            element={
              <div>
                <LoginRedirect />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Should include message parameter (URL encoded)
    expect(locationAssignMock).toHaveBeenCalledWith(
      expect.stringContaining('message=Session')
    );
  });

  it('should use default FounderyOS URL', () => {
    const fromLocation = { pathname: '/dashboard' };

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: fromLocation } }]}>
        <Routes>
          <Route path="/login" element={<LoginRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    // Should redirect to default FounderyOS URL
    expect(locationAssignMock).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:5174/login')
    );
  });

  it('should redirect with validated returnUrl from location state', () => {
    const fromLocation = { pathname: '/proposals' };

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: fromLocation } }]}>
        <Routes>
          <Route path="/login" element={<LoginRedirect />} />
        </Routes>
      </MemoryRouter>
    );

    // Should call validateReturnUrl and use the result
    expect(locationAssignMock).toHaveBeenCalledWith(
      expect.stringContaining('returnUrl=http%3A%2F%2Flocalhost%3A5174%2Fproposals')
    );
  });
});
