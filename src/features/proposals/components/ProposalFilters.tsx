/**
 * ProposalFilters Component
 *
 * Multi-select status filters with My Proposals and Not Voted toggles.
 * Collapsible on mobile viewports.
 *
 * Story: 9-1-3-proposal-listing
 * ACs: 2, 8, 9
 */

import React, { useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import {
  $proposalFilters,
  $proposalStatusCounts,
  toggleStatusFilter,
  updateFilters,
  clearAllFilters,
  type ProposalStatus,
} from '@/stores';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

export interface ProposalFiltersProps {
  isAuthenticated: boolean;
  className?: string;
}

const STATUS_OPTIONS: { value: ProposalStatus; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Passed', label: 'Passed' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Pending', label: 'Pending' },
];

export function ProposalFilters({ isAuthenticated, className = '' }: ProposalFiltersProps) {
  const filters = useStore($proposalFilters);
  const statusCounts = useStore($proposalStatusCounts);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleStatusToggle = useCallback((status: ProposalStatus) => {
    toggleStatusFilter(status);
  }, []);

  const handleMyProposalsToggle = useCallback(() => {
    if (!isAuthenticated) return;
    updateFilters({ myProposals: !filters.myProposals });
  }, [filters.myProposals, isAuthenticated]);

  const handleNotVotedToggle = useCallback(() => {
    if (!isAuthenticated) return;
    updateFilters({ notVoted: !filters.notVoted });
  }, [filters.notVoted, isAuthenticated]);

  const handleClearAll = useCallback(() => {
    clearAllFilters();
  }, []);

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.myProposals ||
    filters.notVoted ||
    filters.search.length > 0;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Mobile Toggle Header */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full md:hidden flex items-center justify-between p-4 text-left"
        aria-expanded={!isCollapsed}
        aria-controls="filter-panel"
      >
        <span className="font-medium text-gray-900">Filters</span>
        <span className="flex items-center gap-2">
          {hasActiveFilters && (
            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          )}
        </span>
      </button>

      {/* Filter Content */}
      <div
        id="filter-panel"
        className={`${isCollapsed ? 'hidden md:block' : ''} p-4 pt-0 md:pt-4 space-y-4`}
      >
        {/* Status Filters */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Status</h3>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.status.includes(option.value)}
                  onChange={() => handleStatusToggle(option.value)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">
                  {option.label}
                  <span className="text-gray-400 ml-1">({statusCounts[option.value] || 0})</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Member Filters */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Member Filters</h3>
          <div className="space-y-2">
            {/* My Proposals */}
            <div className="relative group">
              <label
                className={`flex items-center gap-2 ${
                  isAuthenticated ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={filters.myProposals}
                  onChange={handleMyProposalsToggle}
                  disabled={!isAuthenticated}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700">My Proposals</span>
              </label>
              {!isAuthenticated && (
                <span className="absolute left-0 -bottom-6 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded z-10 whitespace-nowrap">
                  Login required
                </span>
              )}
            </div>

            {/* Not Voted */}
            <div className="relative group">
              <label
                className={`flex items-center gap-2 ${
                  isAuthenticated ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={filters.notVoted}
                  onChange={handleNotVotedToggle}
                  disabled={!isAuthenticated}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700">Not Voted</span>
              </label>
              {!isAuthenticated && (
                <span className="absolute left-0 -bottom-6 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded z-10 whitespace-nowrap">
                  Login required
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <div className="border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProposalFilters;
