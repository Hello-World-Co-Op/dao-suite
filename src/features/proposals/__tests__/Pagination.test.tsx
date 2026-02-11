/**
 * Pagination Component Tests
 *
 * Tests for page navigation functionality.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 5
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pagination } from '../components/Pagination';
import { $proposalPage, $proposalTotalCount } from '@/stores';

// Reset atoms before each test
beforeEach(() => {
  $proposalPage.set(1);
  $proposalTotalCount.set(100); // 5 pages with 20 per page
});

describe('Pagination', () => {
  describe('AC-5: Pagination with 20 items per page', () => {
    it('should render pagination controls', () => {
      render(<Pagination />);

      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    });

    it('should show current page', () => {
      render(<Pagination />);

      expect(screen.getByRole('button', { name: /page 1/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
    });

    it('should show next and previous buttons', () => {
      render(<Pagination />);

      expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
    });

    it('should disable previous button on first page', () => {
      render(<Pagination />);

      expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      $proposalPage.set(5);

      render(<Pagination />);

      expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
    });

    it('should show result count', () => {
      render(<Pagination />);

      // The component shows "Showing 1 - 20 of 100 results"
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
      expect(screen.getByText(/results/i)).toBeInTheDocument();
    });

    it('should navigate to next page', () => {
      render(<Pagination />);

      fireEvent.click(screen.getByRole('button', { name: /next page/i }));

      expect($proposalPage.get()).toBe(2);
    });

    it('should navigate to previous page', () => {
      $proposalPage.set(3);

      render(<Pagination />);

      fireEvent.click(screen.getByRole('button', { name: /previous page/i }));

      expect($proposalPage.get()).toBe(2);
    });

    it('should navigate to specific page when page button clicked', () => {
      render(<Pagination />);

      fireEvent.click(screen.getByRole('button', { name: /page 3/i }));

      expect($proposalPage.get()).toBe(3);
    });
  });

  describe('Page number display', () => {
    it('should show ellipsis for many pages', () => {
      $proposalTotalCount.set(200); // 10 pages
      $proposalPage.set(5);

      render(<Pagination />);

      expect(screen.getAllByText('...')).toHaveLength(2);
    });

    it('should always show first and last page', () => {
      $proposalTotalCount.set(200); // 10 pages
      $proposalPage.set(5);

      render(<Pagination />);

      // Get all page buttons and check they contain 1 and 10
      const buttons = screen.getAllByRole('button');
      const buttonTexts = buttons.map((b) => b.textContent);
      expect(buttonTexts.some((t) => t === '1')).toBe(true);
      expect(buttonTexts.some((t) => t === '10')).toBe(true);
    });

    it('should show pages around current page', () => {
      $proposalTotalCount.set(200);
      $proposalPage.set(5);

      render(<Pagination />);

      const buttons = screen.getAllByRole('button');
      const buttonTexts = buttons.map((b) => b.textContent);
      expect(buttonTexts.some((t) => t === '4')).toBe(true);
      expect(buttonTexts.some((t) => t === '5')).toBe(true);
      expect(buttonTexts.some((t) => t === '6')).toBe(true);
    });

    it('should show all pages when 5 or fewer', () => {
      $proposalTotalCount.set(100); // 5 pages

      render(<Pagination />);

      const buttons = screen.getAllByRole('button');
      const buttonTexts = buttons.map((b) => b.textContent);
      expect(buttonTexts.some((t) => t === '1')).toBe(true);
      expect(buttonTexts.some((t) => t === '2')).toBe(true);
      expect(buttonTexts.some((t) => t === '3')).toBe(true);
      expect(buttonTexts.some((t) => t === '4')).toBe(true);
      expect(buttonTexts.some((t) => t === '5')).toBe(true);
      expect(screen.queryAllByText('...')).toHaveLength(0);
    });
  });

  describe('Single page', () => {
    it('should not render when only one page', () => {
      $proposalTotalCount.set(10);

      const { container } = render(<Pagination />);

      expect(container.querySelector('nav')).toBeNull();
    });

    it('should not render when zero items', () => {
      $proposalTotalCount.set(0);

      const { container } = render(<Pagination />);

      expect(container.querySelector('nav')).toBeNull();
    });
  });

  describe('Keyboard navigation', () => {
    it('should navigate with arrow left', () => {
      $proposalPage.set(3);

      render(<Pagination />);

      const nav = screen.getByRole('navigation');
      fireEvent.keyDown(nav, { key: 'ArrowLeft' });

      expect($proposalPage.get()).toBe(2);
    });

    it('should navigate with arrow right', () => {
      render(<Pagination />);

      const nav = screen.getByRole('navigation');
      fireEvent.keyDown(nav, { key: 'ArrowRight' });

      expect($proposalPage.get()).toBe(2);
    });

    it('should not go below page 1', () => {
      render(<Pagination />);

      const nav = screen.getByRole('navigation');
      fireEvent.keyDown(nav, { key: 'ArrowLeft' });

      expect($proposalPage.get()).toBe(1);
    });

    it('should not exceed max pages', () => {
      $proposalPage.set(5);

      render(<Pagination />);

      const nav = screen.getByRole('navigation');
      fireEvent.keyDown(nav, { key: 'ArrowRight' });

      expect($proposalPage.get()).toBe(5);
    });
  });

  describe('Callback', () => {
    it('should call onPageChange callback', () => {
      const onPageChange = vi.fn();

      render(<Pagination onPageChange={onPageChange} />);

      fireEvent.click(screen.getByRole('button', { name: /next page/i }));

      expect(onPageChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Custom page size', () => {
    it('should calculate pages based on custom page size', () => {
      $proposalTotalCount.set(100);

      render(<Pagination pageSize={10} />); // 10 pages

      expect(screen.getByRole('button', { name: /page 10/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have navigation role with label', () => {
      render(<Pagination />);

      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    });

    it('should mark current page with aria-current', () => {
      $proposalPage.set(3);

      render(<Pagination />);

      expect(screen.getByRole('button', { name: /page 3/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
    });

    it('should have aria-labels on page buttons', () => {
      render(<Pagination />);

      expect(screen.getByRole('button', { name: /page 1/i })).toHaveAttribute(
        'aria-label',
        'Page 1'
      );
    });
  });
});
