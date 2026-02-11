/**
 * VoteTally Component
 *
 * Displays vote distribution as a horizontal bar chart with
 * quorum and passing threshold indicators.
 *
 * Story: 9-1-2-voting-interface
 * ACs: 3, 4
 */

import React, { useMemo } from 'react';
import type { VoteTally as VoteTallyType } from '@/stores';

export interface VoteTallyProps {
  tally: VoteTallyType | null;
  isLoading: boolean;
  error?: string;
}

/**
 * Format time ago from timestamp
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Loading skeleton for VoteTally
 */
export function VoteTallySkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
      <div className="space-y-4">
        <div>
          <div className="h-4 w-20 bg-gray-200 rounded mb-2" />
          <div className="h-6 bg-gray-200 rounded" />
        </div>
        <div className="flex justify-between">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export function VoteTally({ tally, isLoading, error }: VoteTallyProps) {
  // Calculate percentages
  const percentages = useMemo(() => {
    if (!tally || tally.totalVotes === 0) {
      return { yes: 0, no: 0, abstain: 0 };
    }

    // Clamp to non-negative values
    const yes = Math.max(0, tally.yes);
    const no = Math.max(0, tally.no);
    const abstain = Math.max(0, tally.abstain);
    const total = yes + no + abstain;

    if (total === 0) {
      return { yes: 0, no: 0, abstain: 0 };
    }

    // Calculate raw percentages
    const yesRaw = (yes / total) * 100;
    const noRaw = (no / total) * 100;
    const abstainRaw = (abstain / total) * 100;

    // Round and ensure they sum to 100
    let yesPct = Math.round(yesRaw);
    let noPct = Math.round(noRaw);
    let abstainPct = Math.round(abstainRaw);

    // Adjust to ensure total is 100
    const diff = 100 - (yesPct + noPct + abstainPct);
    if (diff !== 0) {
      // Add difference to the largest segment
      if (yesRaw >= noRaw && yesRaw >= abstainRaw) {
        yesPct += diff;
      } else if (noRaw >= abstainRaw) {
        noPct += diff;
      } else {
        abstainPct += diff;
      }
    }

    return { yes: yesPct, no: noPct, abstain: abstainPct };
  }, [tally]);

  // Screen reader announcement text
  const srAnnouncement = useMemo(() => {
    if (!tally || tally.totalVotes === 0) {
      return 'No votes yet.';
    }
    return `${percentages.yes}% Yes, ${percentages.no}% No, ${percentages.abstain}% Abstain. ${tally.quorumMet ? 'Quorum reached.' : 'Quorum not yet reached.'}`;
  }, [tally, percentages]);

  if (isLoading) {
    return <VoteTallySkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!tally) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-gray-500">Vote tally unavailable</p>
      </div>
    );
  }

  const hasVotes = tally.totalVotes > 0;

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Vote Results</h3>
        {tally.lastUpdated && (
          <span className="text-xs text-gray-500">
            Last updated {formatTimeAgo(tally.lastUpdated)}
          </span>
        )}
      </div>

      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>

      {!hasVotes ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mt-2 text-gray-500">No votes yet</p>
          <p className="text-sm text-gray-400">Be the first to vote!</p>
        </div>
      ) : (
        <>
          {/* Vote bar chart */}
          <div className="mb-6">
            <div
              className="h-8 rounded-full overflow-hidden flex bg-gray-100"
              role="img"
              aria-label={srAnnouncement}
            >
              {percentages.yes > 0 && (
                <div
                  className="bg-green-500 transition-all duration-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${percentages.yes}%` }}
                >
                  {percentages.yes >= 10 && `${percentages.yes}%`}
                </div>
              )}
              {percentages.no > 0 && (
                <div
                  className="bg-red-500 transition-all duration-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${percentages.no}%` }}
                >
                  {percentages.no >= 10 && `${percentages.no}%`}
                </div>
              )}
              {percentages.abstain > 0 && (
                <div
                  className="bg-gray-400 transition-all duration-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${percentages.abstain}%` }}
                >
                  {percentages.abstain >= 10 && `${percentages.abstain}%`}
                </div>
              )}
            </div>
          </div>

          {/* Vote counts */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-gray-600">Yes</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{Math.max(0, tally.yes)}</p>
              <p className="text-xs text-gray-500">{percentages.yes}%</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-gray-600">No</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{Math.max(0, tally.no)}</p>
              <p className="text-xs text-gray-500">{percentages.no}%</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm text-gray-600">Abstain</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{Math.max(0, tally.abstain)}</p>
              <p className="text-xs text-gray-500">{percentages.abstain}%</p>
            </div>
          </div>
        </>
      )}

      {/* Quorum and threshold indicators */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Quorum</span>
          <div className="flex items-center gap-2">
            <span className={tally.quorumMet ? 'text-green-600 font-medium' : 'text-gray-900'}>
              {tally.totalVotes} / {tally.quorumRequired}
            </span>
            {tally.quorumMet && (
              <svg
                className="h-4 w-4 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Passing threshold</span>
          <span className="text-gray-900">{tally.passingThreshold}%</span>
        </div>
      </div>
    </div>
  );
}

export default VoteTally;
