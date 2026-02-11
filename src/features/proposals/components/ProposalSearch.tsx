/**
 * ProposalSearch Component
 *
 * Search input with debouncing and clear functionality.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 4
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $proposalFilters, updateFilters, clearSearch } from '@/stores';
import { Search, X } from 'lucide-react';

export interface ProposalSearchProps {
  className?: string;
  debounceMs?: number;
}

/**
 * Escape regex special characters in search input
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function ProposalSearch({ className = '', debounceMs = 300 }: ProposalSearchProps) {
  const filters = useStore($proposalFilters);
  const [localValue, setLocalValue] = useState(filters.search);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track the last value we sent to the atom to detect external changes
  const lastAppliedRef = useRef(filters.search);

  // Sync local value when atom changes externally (e.g., clearAllFilters button)
  // Only update if the change wasn't from our own debounced update
  useEffect(() => {
    if (filters.search !== lastAppliedRef.current) {
      lastAppliedRef.current = filters.search;
      setLocalValue(filters.search);
    }
  }, [filters.search]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setLocalValue(value);

      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Check minimum length requirement
      if (value.length > 0 && value.length < 2) {
        setIsDebouncing(false);
        return; // Don't search yet
      }

      setIsDebouncing(true);

      // Debounce the actual search
      debounceRef.current = setTimeout(() => {
        const escapedValue = escapeRegex(value);
        lastAppliedRef.current = escapedValue;
        updateFilters({ search: escapedValue });
        setIsDebouncing(false);
      }, debounceMs);
    },
    [debounceMs]
  );

  const handleClear = useCallback(() => {
    setLocalValue('');
    lastAppliedRef.current = '';
    clearSearch();
    setIsDebouncing(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClear();
      }
    },
    [handleClear]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const showMinLengthHint = localValue.length > 0 && localValue.length < 2;

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search proposals..."
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
          aria-label="Search proposals"
        />
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            aria-label="Clear search"
          >
            <X className="h-5 w-5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Status indicators */}
      {isDebouncing && (
        <p className="absolute -bottom-5 left-0 text-xs text-gray-500">Searching...</p>
      )}
      {showMinLengthHint && !isDebouncing && (
        <p className="absolute -bottom-5 left-0 text-xs text-gray-500">
          Enter at least 2 characters
        </p>
      )}
    </div>
  );
}

export default ProposalSearch;
