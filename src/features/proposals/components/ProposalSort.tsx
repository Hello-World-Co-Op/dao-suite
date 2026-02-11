/**
 * ProposalSort Component
 *
 * Dropdown select for sorting proposals.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 3
 */

import React, { useCallback } from 'react';
import { useStore } from '@nanostores/react';
import {
  $proposalSort,
  setProposalSort,
  type ProposalSort as ProposalSortType,
} from '@/stores';

export interface ProposalSortProps {
  className?: string;
}

const SORT_OPTIONS: { value: ProposalSortType; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'mostVotes', label: 'Most Votes' },
  { value: 'endingSoon', label: 'Ending Soon' },
];

export function ProposalSort({ className = '' }: ProposalSortProps) {
  const currentSort = useStore($proposalSort);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setProposalSort(event.target.value as ProposalSortType);
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor="proposal-sort" className="text-sm text-gray-600 whitespace-nowrap">
        Sort by:
      </label>
      <select
        id="proposal-sort"
        value={currentSort}
        onChange={handleChange}
        className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ProposalSort;
