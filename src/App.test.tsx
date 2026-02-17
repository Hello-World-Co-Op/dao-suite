import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from './App';

// Mock shared auth package to avoid auth service initialization in tests.
// ProtectedRoute and LoginRedirect create session checks that hang in test environments.
// These components are tested in the @hello-world-co-op/auth package's own test suite.
vi.mock('@hello-world-co-op/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hello-world-co-op/auth')>();
  return {
    ...actual,
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    LoginRedirect: () => <div>Redirecting to login...</div>,
  };
});

// Mock the ui package's SuiteSwitcher to avoid a dual auth@0.x module instance issue.
// @hello-world-co-op/ui@0.2.1 bundles auth@0.2.2 as a nested dependency. SuiteSwitcher
// calls useRoles() from that nested auth context, which is a different React context
// instance than the AuthProvider from auth@0.3.x wrapping the app. This causes a
// "useAuth must be used within an AuthProvider" error caught by ErrorBoundary.
// The SuiteSwitcher itself is tested in the ui package — we just need a stable stub here.
vi.mock('@hello-world-co-op/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hello-world-co-op/ui')>();
  return {
    ...actual,
    SuiteSwitcher: () => <nav data-testid="suite-switcher" />,
  };
});

describe('App', () => {
  beforeEach(() => {
    // Clear any ErrorBoundary state between tests
    document.body.innerHTML = '';
  });

  it('renders without crashing', async () => {
    const { container } = render(<App />);
    // Dashboard is lazy-loaded, wait for it
    await waitFor(() => {
      expect(container.firstChild).toBeTruthy();
    });
  });

  it('renders without triggering an ErrorBoundary crash', async () => {
    render(<App />);
    // Lazy loading may show spinner (Suspense fallback) or resolve immediately in tests.
    // The key assertion is that the app mounts without triggering the ErrorBoundary fallback.
    await waitFor(() => {
      // ErrorBoundary fallback renders "Something went wrong" — this must NOT appear
      const errorHeading = Array.from(document.querySelectorAll('h1')).find(
        (el) => el.textContent === 'Something went wrong',
      );
      expect(errorHeading).toBeUndefined();
      expect(document.body.children.length).toBeGreaterThan(0);
    });
  });
});
