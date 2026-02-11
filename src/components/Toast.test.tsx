/**
 * Toast Component Tests
 *
 * Tests for toast notifications including auto-dismiss,
 * different types, and accessibility.
 *
 * Story: 9-1-5-error-handling-recovery
 * AC: 5
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Toast } from './Toast';
import type { Toast as ToastType } from '@/stores';

// Mock the removeToast action from state
vi.mock('@/stores', async () => {
  const actual = await vi.importActual('@/stores');
  return {
    ...actual,
    removeToast: vi.fn(),
  };
});

describe('Toast', () => {
  const mockOnRemove = vi.fn();

  const baseToast: ToastType = {
    id: 'test-toast-1',
    type: 'info',
    message: 'Test message',
    duration: 5000,
    createdAt: Date.now(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render toast message', () => {
      render(<Toast toast={baseToast} onRemove={mockOnRemove} />);

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should render success toast with correct styling', () => {
      const successToast: ToastType = { ...baseToast, type: 'success' };
      render(<Toast toast={successToast} onRemove={mockOnRemove} />);

      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('bg-green-50');
    });

    it('should render error toast with correct styling', () => {
      const errorToast: ToastType = { ...baseToast, type: 'error' };
      render(<Toast toast={errorToast} onRemove={mockOnRemove} />);

      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('bg-red-50');
    });

    it('should render warning toast with correct styling', () => {
      const warningToast: ToastType = { ...baseToast, type: 'warning' };
      render(<Toast toast={warningToast} onRemove={mockOnRemove} />);

      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('bg-yellow-50');
    });

    it('should render info toast with correct styling', () => {
      render(<Toast toast={baseToast} onRemove={mockOnRemove} />);

      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('bg-blue-50');
    });

    it('should render optional title', () => {
      const toastWithTitle: ToastType = { ...baseToast, title: 'Test Title' };
      render(<Toast toast={toastWithTitle} onRemove={mockOnRemove} />);

      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    it('should start dismissing when close button is clicked', () => {
      render(<Toast toast={baseToast} onRemove={mockOnRemove} />);

      const closeButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(closeButton);

      // The component sets isExiting and then removes after animation delay
      // Since we mocked time, we need to advance it
      act(() => {
        vi.advanceTimersByTime(300); // Wait for animation
      });

      // onRemove should be called after the animation delay
      expect(mockOnRemove).toHaveBeenCalledWith('test-toast-1');
    });

    it('should call action callback when action button is clicked', () => {
      const actionCallback = vi.fn();
      const toastWithAction: ToastType = {
        ...baseToast,
        action: {
          label: 'Retry',
          onClick: actionCallback,
        },
      };

      render(<Toast toast={toastWithAction} onRemove={mockOnRemove} />);

      const actionButton = screen.getByRole('button', { name: 'Retry' });
      fireEvent.click(actionButton);

      expect(actionCallback).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have role="alert" for screen readers', () => {
      render(<Toast toast={baseToast} onRemove={mockOnRemove} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live attribute', () => {
      render(<Toast toast={baseToast} onRemove={mockOnRemove} />);

      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-atomic attribute', () => {
      render(<Toast toast={baseToast} onRemove={mockOnRemove} />);

      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('aria-atomic', 'true');
    });

    it('should have accessible close button', () => {
      render(<Toast toast={baseToast} onRemove={mockOnRemove} />);

      const closeButton = screen.getByRole('button', { name: /dismiss/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Progress bar', () => {
    it('should show progress bar when duration > 0', () => {
      render(<Toast toast={baseToast} onRemove={mockOnRemove} />);

      // Progress bar container should exist with the expected classes
      const toastElement = screen.getByRole('alert');
      const progressContainer = toastElement.querySelector('.h-1.bg-gray-200\\/50');
      expect(progressContainer).toBeInTheDocument();
    });

    it('should not show progress bar when duration is 0', () => {
      const persistentToast: ToastType = { ...baseToast, duration: 0 };
      render(<Toast toast={persistentToast} onRemove={mockOnRemove} />);

      const toastElement = screen.getByRole('alert');
      const progressContainer = toastElement.querySelector('.h-1.bg-gray-200\\/50');
      expect(progressContainer).not.toBeInTheDocument();
    });
  });
});
