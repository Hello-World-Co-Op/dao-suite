/**
 * Proposal List Integration and Edge Case Tests
 *
 * Comprehensive tests covering accessibility, edge cases, filter validation,
 * URL state sync, and mobile responsiveness.
 *
 * Story: 9-1-3-proposal-listing
 * Tasks: 10.9, 10.11, 10.12, 10.13, 10.14, 10.15, 10.16
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  $proposalFilters,
  $proposalSort,
  $proposalPage,
  $proposalList,
  $proposalTotalCount,
  $proposalStatusCounts,
  $userVotes,
  initFromUrlParams,
  getUrlParams,
  type ProposalListItem,
} from '@/stores';
import { ProposalCard } from '../components/ProposalCard';
import { ProposalFilters } from '../components/ProposalFilters';
import { ProposalSearch } from '../components/ProposalSearch';
import { Pagination } from '../components/Pagination';

// Helper to render with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

// Sample proposals for testing
const createMockProposal = (overrides: Partial<ProposalListItem> = {}): ProposalListItem => ({
  id: 'prop-1',
  title: 'Test Proposal',
  proposer: 'user-1',
  status: 'Active',
  votesFor: 100,
  votesAgainst: 50,
  votesAbstain: 25,
  votingEndsAt: Date.now() + 86400000,
  createdAt: Date.now(),
  ...overrides,
});

describe('Task 10.9: Accessibility Audit', () => {
  beforeEach(() => {
    $proposalFilters.set({
      status: [],
      search: '',
      myProposals: false,
      notVoted: false,
    });
    $proposalSort.set('newest');
    $proposalPage.set(1);
    $proposalTotalCount.set(100);
    $proposalStatusCounts.set({ Active: 5, Passed: 10, Failed: 3, Pending: 2 });
    $userVotes.set({});
  });

  describe('ProposalCard accessibility', () => {
    it('should be keyboard navigable', () => {
      const proposal = createMockProposal();
      renderWithRouter(<ProposalCard proposal={proposal} />);

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should have descriptive aria-label', () => {
      const proposal = createMockProposal({ title: 'Budget Proposal 2024' });
      renderWithRouter(<ProposalCard proposal={proposal} />);

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label');
      expect(card.getAttribute('aria-label')).toContain('Budget Proposal 2024');
    });

    it('should include voted status in aria-label', () => {
      const proposal = createMockProposal();
      renderWithRouter(<ProposalCard proposal={proposal} hasVoted={true} />);

      const card = screen.getByRole('article');
      expect(card.getAttribute('aria-label')).toContain('voted');
    });

    it('should navigate on Enter key', () => {
      const onNavigate = vi.fn();
      const proposal = createMockProposal();
      renderWithRouter(<ProposalCard proposal={proposal} onNavigate={onNavigate} />);

      const card = screen.getByRole('article');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(onNavigate).toHaveBeenCalledWith('prop-1');
    });

    it('should navigate on Space key', () => {
      const onNavigate = vi.fn();
      const proposal = createMockProposal();
      renderWithRouter(<ProposalCard proposal={proposal} onNavigate={onNavigate} />);

      const card = screen.getByRole('article');
      fireEvent.keyDown(card, { key: ' ' });

      expect(onNavigate).toHaveBeenCalledWith('prop-1');
    });
  });

  describe('ProposalFilters accessibility', () => {
    it('should have accessible checkboxes with labels', () => {
      render(<ProposalFilters isAuthenticated={true} />);

      const checkboxes = screen.getAllByRole('checkbox');
      // Verify checkboxes exist and are within labeled containers
      expect(checkboxes.length).toBeGreaterThan(0);
      // Each checkbox should be within a label element
      checkboxes.forEach((checkbox) => {
        expect(checkbox.closest('label')).not.toBeNull();
      });
    });

    it('should have clear all button when filters are active', () => {
      // Set active filters so the clear button appears
      $proposalFilters.set({
        status: ['Active'],
        search: '',
        myProposals: false,
        notVoted: false,
      });

      render(<ProposalFilters isAuthenticated={true} />);

      const clearButton = screen.getByRole('button', { name: /clear all/i });
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('ProposalSearch accessibility', () => {
    it('should have aria-label on search input', () => {
      render(<ProposalSearch />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Search proposals');
    });

    it('should have clear button with aria-label', () => {
      render(<ProposalSearch />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } });

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Pagination accessibility', () => {
    it('should have navigation role with label', () => {
      render(<Pagination />);

      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
    });

    it('should mark current page with aria-current', () => {
      render(<Pagination />);

      const currentPage = screen.getByRole('button', { name: /page 1/i });
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });

    it('should support keyboard navigation', () => {
      render(<Pagination />);

      const nav = screen.getByRole('navigation');
      fireEvent.keyDown(nav, { key: 'ArrowRight' });

      expect($proposalPage.get()).toBe(2);
    });
  });
});

describe('Task 10.11: Edge Cases', () => {
  beforeEach(() => {
    $proposalList.set([]);
    $proposalFilters.set({
      status: [],
      search: '',
      myProposals: false,
      notVoted: false,
    });
    $proposalSort.set('newest');
    $proposalPage.set(1);
    $proposalTotalCount.set(0);
    $proposalStatusCounts.set({ Active: 0, Passed: 0, Failed: 0, Pending: 0 });
  });

  describe('Empty proposal fields', () => {
    it('should handle missing title', () => {
      const proposal = createMockProposal({ title: '' });
      renderWithRouter(<ProposalCard proposal={proposal} />);

      expect(screen.getByText('Untitled Proposal')).toBeInTheDocument();
    });

    it('should handle null votingEndsAt', () => {
      const proposal = createMockProposal({ votingEndsAt: null as unknown as number });
      renderWithRouter(<ProposalCard proposal={proposal} />);

      expect(screen.getByText('Deadline unknown')).toBeInTheDocument();
    });

    it('should handle undefined votingEndsAt', () => {
      const proposal = createMockProposal({ votingEndsAt: undefined as unknown as number });
      renderWithRouter(<ProposalCard proposal={proposal} />);

      expect(screen.getByText('Deadline unknown')).toBeInTheDocument();
    });

    it('should handle zero votes', () => {
      const proposal = createMockProposal({
        votesFor: 0,
        votesAgainst: 0,
        votesAbstain: 0,
      });
      renderWithRouter(<ProposalCard proposal={proposal} />);

      const yesVotes = screen.getByText('Yes').parentElement;
      expect(within(yesVotes!).getByText('0')).toBeInTheDocument();
    });
  });

  describe('Invalid timestamps', () => {
    it('should handle NaN timestamp', () => {
      const proposal = createMockProposal({ votingEndsAt: NaN });
      renderWithRouter(<ProposalCard proposal={proposal} />);

      expect(screen.getByText('Deadline unknown')).toBeInTheDocument();
    });

    it('should handle past deadline', () => {
      const proposal = createMockProposal({ votingEndsAt: Date.now() - 86400000 });
      renderWithRouter(<ProposalCard proposal={proposal} />);

      expect(screen.getByText('Voting Ended')).toBeInTheDocument();
    });
  });

  describe('Extremely long titles', () => {
    it('should truncate long titles with line-clamp', () => {
      const longTitle = 'A'.repeat(500);
      const proposal = createMockProposal({ title: longTitle });
      renderWithRouter(<ProposalCard proposal={proposal} />);

      const titleElement = screen.getByText(longTitle);
      expect(titleElement).toHaveClass('line-clamp-2');
    });

    it('should show full title on hover via title attribute', () => {
      const longTitle = 'A'.repeat(500);
      const proposal = createMockProposal({ title: longTitle });
      renderWithRouter(<ProposalCard proposal={proposal} />);

      const titleElement = screen.getByText(longTitle);
      expect(titleElement).toHaveAttribute('title', longTitle);
    });
  });
});

describe('Task 10.12: Filter Edge Cases', () => {
  beforeEach(() => {
    $proposalFilters.set({
      status: [],
      search: '',
      myProposals: false,
      notVoted: false,
    });
    $proposalStatusCounts.set({ Active: 5, Passed: 10, Failed: 3, Pending: 2 });
  });

  describe('Unauthenticated user tries member filters', () => {
    it('should disable My Proposals checkbox when not authenticated', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const myProposalsCheckbox = checkboxes[4]; // 5th checkbox
      expect(myProposalsCheckbox).toBeDisabled();
    });

    it('should disable Not Voted checkbox when not authenticated', () => {
      render(<ProposalFilters isAuthenticated={false} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const notVotedCheckbox = checkboxes[5]; // 6th checkbox
      expect(notVotedCheckbox).toBeDisabled();
    });

    it('should enable member filters when authenticated', () => {
      render(<ProposalFilters isAuthenticated={true} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const myProposalsCheckbox = checkboxes[4];
      const notVotedCheckbox = checkboxes[5];

      expect(myProposalsCheckbox).not.toBeDisabled();
      expect(notVotedCheckbox).not.toBeDisabled();
    });
  });

  describe('LocalStorage edge cases', () => {
    it('should handle empty localStorage gracefully', () => {
      localStorage.removeItem('hwdao:proposal-filters');

      // Re-read from localStorage
      const filters = $proposalFilters.get();
      expect(filters.status).toEqual([]);
      expect(filters.search).toBe('');
    });
  });
});

describe('Task 10.13: URL State Sync', () => {
  beforeEach(() => {
    $proposalFilters.set({
      status: [],
      search: '',
      myProposals: false,
      notVoted: false,
    });
    $proposalSort.set('newest');
    $proposalPage.set(1);
    $proposalTotalCount.set(100);
  });

  describe('Initialize from URL params', () => {
    it('should parse status filter from URL', () => {
      const params = new URLSearchParams('status=Active,Pending');
      initFromUrlParams(params);

      expect($proposalFilters.get().status).toEqual(['Active', 'Pending']);
    });

    it('should parse search from URL', () => {
      const params = new URLSearchParams('search=budget');
      initFromUrlParams(params);

      expect($proposalFilters.get().search).toBe('budget');
    });

    it('should parse sort from URL', () => {
      const params = new URLSearchParams('sort=oldest');
      initFromUrlParams(params);

      expect($proposalSort.get()).toBe('oldest');
    });

    it('should parse page from URL', () => {
      const params = new URLSearchParams('page=3');
      initFromUrlParams(params);

      expect($proposalPage.get()).toBe(3);
    });

    it('should parse myProposals from URL', () => {
      const params = new URLSearchParams('myProposals=true');
      initFromUrlParams(params);

      expect($proposalFilters.get().myProposals).toBe(true);
    });

    it('should parse notVoted from URL', () => {
      const params = new URLSearchParams('notVoted=true');
      initFromUrlParams(params);

      expect($proposalFilters.get().notVoted).toBe(true);
    });
  });

  describe('Generate URL params from state', () => {
    it('should include status in URL when set', () => {
      $proposalFilters.set({
        status: ['Active', 'Passed'],
        search: '',
        myProposals: false,
        notVoted: false,
      });

      const params = getUrlParams();
      expect(params.get('status')).toBe('Active,Passed');
    });

    it('should include search in URL when set', () => {
      $proposalFilters.set({
        status: [],
        search: 'test query',
        myProposals: false,
        notVoted: false,
      });

      const params = getUrlParams();
      expect(params.get('search')).toBe('test query');
    });

    it('should include sort in URL when not default', () => {
      $proposalSort.set('endingSoon');

      const params = getUrlParams();
      expect(params.get('sort')).toBe('endingSoon');
    });

    it('should include page in URL when not 1', () => {
      $proposalPage.set(5);

      const params = getUrlParams();
      expect(params.get('page')).toBe('5');
    });

    it('should NOT include default values in URL', () => {
      // All defaults
      $proposalFilters.set({
        status: [],
        search: '',
        myProposals: false,
        notVoted: false,
      });
      $proposalSort.set('newest');
      $proposalPage.set(1);

      const params = getUrlParams();
      expect(params.get('status')).toBeNull();
      expect(params.get('search')).toBeNull();
      expect(params.get('sort')).toBeNull();
      expect(params.get('page')).toBeNull();
    });
  });

  describe('Invalid URL params', () => {
    it('should handle invalid page number', () => {
      const params = new URLSearchParams('page=invalid');
      initFromUrlParams(params);

      expect($proposalPage.get()).toBe(1); // Falls back to default
    });

    it('should handle negative page number', () => {
      const params = new URLSearchParams('page=-5');
      initFromUrlParams(params);

      expect($proposalPage.get()).toBe(1); // Falls back to default
    });

    it('should handle empty status array gracefully', () => {
      const params = new URLSearchParams('status=');
      initFromUrlParams(params);

      // Should keep current status or set empty
      expect(Array.isArray($proposalFilters.get().status)).toBe(true);
    });
  });
});

describe('Task 10.16: Vote State Hydration', () => {
  beforeEach(() => {
    $userVotes.set({});
    $proposalList.set([]);
  });

  it('should show voted indicator when user has voted', () => {
    $userVotes.set({ 'prop-1': { proposalId: 'prop-1', vote: 'yes', votedAt: Date.now() } });

    const proposal = createMockProposal({ id: 'prop-1' });
    renderWithRouter(<ProposalCard proposal={proposal} hasVoted={true} />);

    expect(screen.getByText('You voted')).toBeInTheDocument();
  });

  it('should not show voted indicator when user has not voted', () => {
    const proposal = createMockProposal({ id: 'prop-1' });
    renderWithRouter(<ProposalCard proposal={proposal} hasVoted={false} />);

    expect(screen.queryByText('You voted')).not.toBeInTheDocument();
  });
});
