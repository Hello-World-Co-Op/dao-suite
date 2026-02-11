/**
 * VotingCountdown Component Tests
 *
 * Tests for countdown timer, urgency states, and edge cases.
 *
 * Story: 9-1-2-voting-interface
 * AC: 4
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VotingCountdown } from '../components/VotingCountdown';

describe('VotingCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('AC-4: Countdown timer display', () => {
    it('should display days, hours, minutes, seconds', () => {
      const deadline =
        Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 + 45 * 60 * 1000 + 30 * 1000;
      // 2 days, 3 hours, 45 minutes, 30 seconds

      render(<VotingCountdown deadline={deadline} />);

      expect(screen.getByText('2')).toBeInTheDocument(); // Days
      expect(screen.getByText('03')).toBeInTheDocument(); // Hours (padded)
      expect(screen.getByText('45')).toBeInTheDocument(); // Minutes
      expect(screen.getByText('30')).toBeInTheDocument(); // Seconds
    });

    it('should update every second', async () => {
      const deadline = Date.now() + 10 * 1000; // 10 seconds from now

      render(<VotingCountdown deadline={deadline} />);

      expect(screen.getByText('10')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('09')).toBeInTheDocument();
    });
  });

  describe('Expired state', () => {
    it('should show "Voting Ended" when deadline passed', () => {
      const deadline = Date.now() - 1000; // Already passed

      render(<VotingCountdown deadline={deadline} />);

      expect(screen.getByText(/voting ended/i)).toBeInTheDocument();
    });

    it('should call onExpired callback when deadline passes', async () => {
      const onExpired = vi.fn();
      const deadline = Date.now() + 2000; // 2 seconds from now

      render(<VotingCountdown deadline={deadline} onExpired={onExpired} />);

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      expect(onExpired).toHaveBeenCalled();
    });

    it('should only call onExpired once even with continued timer ticks', async () => {
      const onExpired = vi.fn();
      const deadline = Date.now() + 1000;

      const { unmount } = render(<VotingCountdown deadline={deadline} onExpired={onExpired} />);

      // Advance past deadline
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // First call should have happened
      expect(onExpired).toHaveBeenCalledTimes(1);

      // Advance more time - should not call again
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(onExpired).toHaveBeenCalledTimes(1);

      // Clean up to prevent timer leak
      unmount();
    });
  });

  describe('Urgency indicators', () => {
    it('should show normal styling when > 24 hours remaining', () => {
      const deadline = Date.now() + 48 * 60 * 60 * 1000; // 48 hours

      render(<VotingCountdown deadline={deadline} />);

      expect(screen.getByText(/time remaining/i)).toBeInTheDocument();
    });

    it('should show warning styling when < 24 hours remaining', () => {
      const deadline = Date.now() + 12 * 60 * 60 * 1000; // 12 hours

      render(<VotingCountdown deadline={deadline} />);

      expect(screen.getByText(/voting ends soon/i)).toBeInTheDocument();
    });

    it('should show critical warning when < 60 seconds remaining', () => {
      const deadline = Date.now() + 30 * 1000; // 30 seconds

      render(<VotingCountdown deadline={deadline} />);

      expect(screen.getByText(/vote now.*deadline imminent/i)).toBeInTheDocument();
    });
  });

  describe('Display formatting', () => {
    it('should pad single-digit hours with zero', () => {
      const deadline = Date.now() + 5 * 60 * 60 * 1000; // 5 hours

      render(<VotingCountdown deadline={deadline} />);

      expect(screen.getByText('05')).toBeInTheDocument();
    });

    it('should not show days section when 0 days remaining', () => {
      const deadline = Date.now() + 5 * 60 * 60 * 1000; // 5 hours

      render(<VotingCountdown deadline={deadline} />);

      expect(screen.queryByText('Days')).not.toBeInTheDocument();
    });

    it('should show deadline date and time', () => {
      const deadline = Date.now() + 24 * 60 * 60 * 1000;

      render(<VotingCountdown deadline={deadline} />);

      expect(screen.getByText(/ends/i)).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should clear interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const deadline = Date.now() + 60 * 1000;

      const { unmount } = render(<VotingCountdown deadline={deadline} />);
      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
