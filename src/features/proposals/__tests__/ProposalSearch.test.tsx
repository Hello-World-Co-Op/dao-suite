/**
 * ProposalSearch Component Tests
 *
 * Tests for search input with debouncing.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 4
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProposalSearch } from '../components/ProposalSearch';
import { $proposalFilters } from '@/stores';

// Reset atom before each test
beforeEach(() => {
  $proposalFilters.set({
    status: [],
    search: '',
    myProposals: false,
    notVoted: false,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ProposalSearch', () => {
  describe('AC-4: Search by title/description', () => {
    it('should render search input', () => {
      render(<ProposalSearch />);

      expect(screen.getByPlaceholderText(/search proposals/i)).toBeInTheDocument();
    });

    it('should have search icon', () => {
      render(<ProposalSearch />);

      expect(screen.getByLabelText(/search proposals/i)).toBeInTheDocument();
    });

    it('should update input value on type', () => {
      render(<ProposalSearch />);

      const input = screen.getByPlaceholderText(/search proposals/i);
      fireEvent.change(input, { target: { value: 'test query' } });

      expect(input).toHaveValue('test query');
    });

    it('should require minimum 2 characters', () => {
      render(<ProposalSearch />);

      const input = screen.getByPlaceholderText(/search proposals/i);

      act(() => {
        fireEvent.change(input, { target: { value: 'a' } });
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Single character should not trigger search
      expect($proposalFilters.get().search).toBe('');
    });

    it('should search with 2+ characters after debounce', () => {
      render(<ProposalSearch />);

      const input = screen.getByPlaceholderText(/search proposals/i);

      act(() => {
        fireEvent.change(input, { target: { value: 'ab' } });
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect($proposalFilters.get().search).toBe('ab');
    });

    it('should escape regex special characters', () => {
      render(<ProposalSearch />);

      const input = screen.getByPlaceholderText(/search proposals/i);

      act(() => {
        fireEvent.change(input, { target: { value: 'test(query)' } });
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      // Should escape the parentheses
      expect($proposalFilters.get().search).toBe('test\\(query\\)');
    });
  });

  describe('Clear functionality', () => {
    it('should show clear button when input has value', () => {
      render(<ProposalSearch />);

      const input = screen.getByPlaceholderText(/search proposals/i);
      fireEvent.change(input, { target: { value: 'test' } });

      expect(screen.getByLabelText(/clear search/i)).toBeInTheDocument();
    });

    it('should not show clear button when input is empty', () => {
      render(<ProposalSearch />);

      expect(screen.queryByLabelText(/clear search/i)).not.toBeInTheDocument();
    });

    it('should clear input when clear button is clicked', () => {
      render(<ProposalSearch />);

      const input = screen.getByPlaceholderText(/search proposals/i);
      fireEvent.change(input, { target: { value: 'test' } });

      const clearButton = screen.getByLabelText(/clear search/i);
      fireEvent.click(clearButton);

      expect(input).toHaveValue('');
    });

    it('should clear on Escape key', () => {
      render(<ProposalSearch />);

      const input = screen.getByPlaceholderText(/search proposals/i);
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input).toHaveValue('');
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label', () => {
      render(<ProposalSearch />);

      const input = screen.getByPlaceholderText(/search proposals/i);
      expect(input).toHaveAttribute('aria-label', 'Search proposals');
    });

    it('should be focusable', () => {
      render(<ProposalSearch />);

      const input = screen.getByPlaceholderText(/search proposals/i);
      input.focus();

      expect(document.activeElement).toBe(input);
    });
  });
});
