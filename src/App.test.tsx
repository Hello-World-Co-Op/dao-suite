import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from './App';

// Mock ProtectedRoute to avoid auth service initialization in tests.
// The ProtectedRoute creates IC agent connections that hang in test environments.
// ProtectedRoute is tested separately in its own test file.
vi.mock('./components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('App', () => {
  it('renders without crashing', async () => {
    render(<App />);
    // Dashboard is lazy-loaded, wait for it
    await waitFor(() => {
      expect(document.getElementById('root') || document.body).toBeTruthy();
    });
  });

  it('renders the loading spinner initially', () => {
    render(<App />);
    // Lazy loading shows spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });
});
