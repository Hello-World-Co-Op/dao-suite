/**
 * ProposalFilters Component Tests
 *
 * Tests for status filters, My Proposals, and Not Voted toggles.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 2, 8, 9
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ProposalFilters } from '../components/ProposalFilters';
import { $proposalFilters, $proposalStatusCounts } from '@/stores';

// Reset atoms before each test
beforeEach(() => {
  $proposalFilters.set({
    status: [],
    search: '',
    myProposals: false,
    notVoted: false,
  });
  $proposalStatusCounts.set({
    Active: 10,
    Passed: 5,
    Failed: 3,
    Pending: 2,
  });
});

describe('ProposalFilters', () => {
  describe('AC-2: Filter by status', () => {
    it('should render all status filter options', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Passed')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should display status counts', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      expect(screen.getByText('(10)')).toBeInTheDocument(); // Active
      expect(screen.getByText('(5)')).toBeInTheDocument(); // Passed
      expect(screen.getByText('(3)')).toBeInTheDocument(); // Failed
      expect(screen.getByText('(2)')).toBeInTheDocument(); // Pending
    });

    it('should toggle status filter when clicked', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox is Active
      fireEvent.click(checkboxes[0]);

      expect($proposalFilters.get().status).toContain('Active');
    });

    it('should allow multiple status filters', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // Status checkboxes are first 4
      fireEvent.click(checkboxes[0]); // Active
      fireEvent.click(checkboxes[3]); // Pending

      const filters = $proposalFilters.get();
      expect(filters.status).toContain('Active');
      expect(filters.status).toContain('Pending');
    });

    it('should remove status when unchecked', () => {
      // Pre-set a filter
      $proposalFilters.set({
        status: ['Active'],
        search: '',
        myProposals: false,
        notVoted: false,
      });

      render(<ProposalFilters isAuthenticated={false} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked(); // Active checkbox

      fireEvent.click(checkboxes[0]);

      expect($proposalFilters.get().status).not.toContain('Active');
    });
  });

  describe('AC-8: Filter by My Proposals', () => {
    it('should show My Proposals filter (may be disabled)', () => {
      render(<ProposalFilters isAuthenticated={true} />);

      expect(screen.getByText('My Proposals')).toBeInTheDocument();
    });

    it('should enable My Proposals when authenticated', () => {
      render(<ProposalFilters isAuthenticated={true} />);

      const myProposalsCheckbox = screen.getAllByRole('checkbox')[4]; // 5th checkbox
      expect(myProposalsCheckbox).not.toBeDisabled();
    });

    it('should disable My Proposals when not authenticated', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      const myProposalsCheckbox = screen.getAllByRole('checkbox')[4]; // 5th checkbox
      expect(myProposalsCheckbox).toBeDisabled();
    });

    it('should toggle My Proposals filter when clicked', () => {
      render(<ProposalFilters isAuthenticated={true} />);

      const myProposalsCheckbox = screen.getAllByRole('checkbox')[4];
      fireEvent.click(myProposalsCheckbox);

      expect($proposalFilters.get().myProposals).toBe(true);
    });
  });

  describe('AC-9: Filter by Not Voted', () => {
    it('should show Not Voted filter', () => {
      render(<ProposalFilters isAuthenticated={true} />);

      expect(screen.getByText('Not Voted')).toBeInTheDocument();
    });

    it('should enable Not Voted when authenticated', () => {
      render(<ProposalFilters isAuthenticated={true} />);

      const notVotedCheckbox = screen.getAllByRole('checkbox')[5]; // 6th checkbox
      expect(notVotedCheckbox).not.toBeDisabled();
    });

    it('should disable Not Voted when not authenticated', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      const notVotedCheckbox = screen.getAllByRole('checkbox')[5]; // 6th checkbox
      expect(notVotedCheckbox).toBeDisabled();
    });

    it('should toggle Not Voted filter when clicked', () => {
      render(<ProposalFilters isAuthenticated={true} />);

      const notVotedCheckbox = screen.getAllByRole('checkbox')[5];
      fireEvent.click(notVotedCheckbox);

      expect($proposalFilters.get().notVoted).toBe(true);
    });
  });

  describe('Clear All button', () => {
    it('should show Clear All when filters are active', () => {
      $proposalFilters.set({
        status: ['Active'],
        search: '',
        myProposals: false,
        notVoted: false,
      });

      render(<ProposalFilters isAuthenticated={false} />);

      expect(screen.getByText(/clear all filters/i)).toBeInTheDocument();
    });

    it('should clear all filters when clicked', () => {
      $proposalFilters.set({
        status: ['Active', 'Pending'],
        search: 'test',
        myProposals: true,
        notVoted: true,
      });

      render(<ProposalFilters isAuthenticated={true} />);

      fireEvent.click(screen.getByText(/clear all filters/i));

      const filters = $proposalFilters.get();
      expect(filters.status).toHaveLength(0);
      expect(filters.search).toBe('');
      expect(filters.myProposals).toBe(false);
      expect(filters.notVoted).toBe(false);
    });
  });

  describe('Mobile responsiveness', () => {
    it('should have collapsible section header', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have status heading', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('should have checkboxes for all filter options', () => {
      render(<ProposalFilters isAuthenticated={true} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // 4 status + 2 member filters = 6 total
      expect(checkboxes.length).toBe(6);
    });
  });
});
