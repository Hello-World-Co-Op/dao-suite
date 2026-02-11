/**
 * VotingCountdown Component
 *
 * Displays countdown timer for voting deadline with urgency indicators.
 * Uses server-provided timestamp to prevent clock drift.
 *
 * Story: 9-1-2-voting-interface
 * AC: 4
 */

import React, { useState, useEffect, useMemo } from 'react';

export interface VotingCountdownProps {
  deadline: number; // Unix timestamp in milliseconds
  onExpired?: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

type UrgencyLevel = 'normal' | 'warning' | 'critical' | 'expired';

/**
 * Calculate time remaining from deadline
 */
function calculateTimeRemaining(deadline: number): TimeRemaining {
  const total = Math.max(0, deadline - Date.now());

  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
    total,
  };
}

/**
 * Determine urgency level based on time remaining
 */
function getUrgencyLevel(totalMs: number): UrgencyLevel {
  if (totalMs <= 0) return 'expired';
  if (totalMs < 60 * 1000) return 'critical'; // < 1 minute
  if (totalMs < 24 * 60 * 60 * 1000) return 'warning'; // < 24 hours
  return 'normal';
}

/**
 * Pad number with leading zero
 */
function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

export function VotingCountdown({ deadline, onExpired }: VotingCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(deadline)
  );

  // Memoize urgency to prevent flicker
  const [urgency, setUrgency] = useState<UrgencyLevel>(() =>
    getUrgencyLevel(calculateTimeRemaining(deadline).total)
  );

  // Track if expired callback has been called
  const [hasExpired, setHasExpired] = useState(false);

  // Update timer every second
  useEffect(() => {
    const updateTimer = () => {
      const remaining = calculateTimeRemaining(deadline);
      setTimeRemaining(remaining);

      // Update urgency level (memoized to prevent flicker)
      const newUrgency = getUrgencyLevel(remaining.total);
      setUrgency((prev) => (prev !== newUrgency ? newUrgency : prev));

      // Trigger expired callback once
      if (remaining.total <= 0 && !hasExpired) {
        setHasExpired(true);
        onExpired?.();
      }
    };

    // Initial update
    updateTimer();

    // Set up interval
    const intervalId = setInterval(updateTimer, 1000);

    // Cleanup
    return () => clearInterval(intervalId);
  }, [deadline, onExpired, hasExpired]);

  // Styling based on urgency
  const containerStyles = useMemo(() => {
    switch (urgency) {
      case 'expired':
        return 'bg-gray-100 border-gray-300 text-gray-600';
      case 'critical':
        return 'bg-red-50 border-red-300 text-red-700 animate-pulse';
      case 'warning':
        return 'bg-amber-50 border-amber-300 text-amber-700';
      default:
        return 'bg-teal-50 border-teal-300 text-teal-700';
    }
  }, [urgency]);

  const iconColor = useMemo(() => {
    switch (urgency) {
      case 'expired':
        return 'text-gray-500';
      case 'critical':
        return 'text-red-600';
      case 'warning':
        return 'text-amber-600';
      default:
        return 'text-teal-600';
    }
  }, [urgency]);

  // Expired state
  if (urgency === 'expired') {
    return (
      <div className={`rounded-lg border p-4 ${containerStyles}`}>
        <div className="flex items-center gap-2">
          <svg
            className={`h-5 w-5 ${iconColor}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">Voting Ended</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${containerStyles}`}>
      {/* Critical warning banner */}
      {urgency === 'critical' && (
        <div className="mb-3 flex items-center gap-2 text-red-800 font-medium text-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Vote now - deadline imminent!
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <svg
          className={`h-5 w-5 ${iconColor}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="font-medium">
          {urgency === 'warning' ? 'Voting Ends Soon' : 'Time Remaining'}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 text-center">
        {timeRemaining.days > 0 && (
          <>
            <div className="flex flex-col items-center min-w-[50px]">
              <span className="text-2xl font-bold tabular-nums">{timeRemaining.days}</span>
              <span className="text-xs uppercase opacity-75">Days</span>
            </div>
            <span className="text-2xl font-light opacity-50">:</span>
          </>
        )}

        <div className="flex flex-col items-center min-w-[50px]">
          <span className="text-2xl font-bold tabular-nums">{pad(timeRemaining.hours)}</span>
          <span className="text-xs uppercase opacity-75">Hours</span>
        </div>
        <span className="text-2xl font-light opacity-50">:</span>

        <div className="flex flex-col items-center min-w-[50px]">
          <span className="text-2xl font-bold tabular-nums">{pad(timeRemaining.minutes)}</span>
          <span className="text-xs uppercase opacity-75">Min</span>
        </div>
        <span className="text-2xl font-light opacity-50">:</span>

        <div className="flex flex-col items-center min-w-[50px]">
          <span className="text-2xl font-bold tabular-nums">{pad(timeRemaining.seconds)}</span>
          <span className="text-xs uppercase opacity-75">Sec</span>
        </div>
      </div>

      {/* Deadline date */}
      <div className="mt-3 text-center text-xs opacity-75">
        Ends {new Date(deadline).toLocaleDateString()} at{' '}
        {new Date(deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

export default VotingCountdown;
