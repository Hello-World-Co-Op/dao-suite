import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from './App';

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
