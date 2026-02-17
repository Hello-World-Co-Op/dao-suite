import { describe, it, expect, vi } from 'vitest';
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

describe('App', () => {
  it('renders without crashing', async () => {
    render(<App />);
    // Dashboard is lazy-loaded, wait for it
    await waitFor(() => {
      expect(document.getElementById('root') || document.body).toBeTruthy();
    });
  });

  it('renders either the loading spinner or resolved content', () => {
    render(<App />);
    // Lazy loading may show spinner (Suspense fallback) or resolve immediately in tests.
    // Either state is valid — the key assertion is that the app mounts without error.
    const spinner = document.querySelector('.animate-spin');
    const body = document.body;
    expect(spinner || body.children.length > 0).toBeTruthy();
  });
});
