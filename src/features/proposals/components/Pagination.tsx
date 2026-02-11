/**
 * Pagination Component
 *
 * Page navigation with prev/next buttons and page number display.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 5
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  $proposalPage,
  $proposalTotalCount,
  setProposalPage,
  nextPage,
  previousPage,
} from '@/stores';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  pageSize?: number;
  className?: string;
  onPageChange?: (page: number) => void;
}

const PAGE_SIZE = 20;
const MAX_VISIBLE_PAGES = 5;

export function Pagination({
  pageSize = PAGE_SIZE,
  className = '',
  onPageChange,
}: PaginationProps) {
  const currentPage = useStore($proposalPage);
  const totalCount = useStore($proposalTotalCount);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [totalCount, pageSize]);

  // Clamp current page to valid range if out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setProposalPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visiblePages = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= MAX_VISIBLE_PAGES) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first, last, and pages around current
      const start = Math.max(1, currentPage - 1);
      const end = Math.min(totalPages, currentPage + 1);

      if (start > 1) {
        pages.push(1);
        if (start > 2) {
          pages.push('ellipsis');
        }
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) {
          pages.push('ellipsis');
        }
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  const handlePrevious = useCallback(() => {
    previousPage();
    onPageChange?.(currentPage - 1);
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    nextPage();
    onPageChange?.(currentPage + 1);
  }, [currentPage, onPageChange]);

  const handlePageClick = useCallback(
    (page: number) => {
      setProposalPage(page);
      onPageChange?.(page);
    },
    [onPageChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && currentPage > 1) {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === 'ArrowRight' && currentPage < totalPages) {
        event.preventDefault();
        handleNext();
      }
    },
    [currentPage, totalPages, handlePrevious, handleNext]
  );

  // Don't render pagination if there's only one page
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      className={`flex items-center justify-between ${className}`}
      aria-label="Pagination"
      onKeyDown={handleKeyDown}
    >
      {/* Result count */}
      <div className="hidden sm:block">
        <p className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span>
          {' - '}
          <span className="font-medium">
            {Math.min(currentPage * pageSize, totalCount)}
          </span> of <span className="font-medium">{totalCount}</span> results
        </p>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-2 py-2 text-gray-400 hover:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {visiblePages.map((page, index) =>
            page === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-gray-500"
                aria-hidden="true"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => handlePageClick(page)}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  page === currentPage
                    ? 'bg-green-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                aria-current={page === currentPage ? 'page' : undefined}
                aria-label={`Page ${page}`}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center px-2 py-2 text-gray-400 hover:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
