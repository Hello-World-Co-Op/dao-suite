/**
 * Proposal List State Atoms Tests
 *
 * Tests for proposal list filtering, sorting, and pagination state management.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 2, 3, 4, 5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  $proposalList,
  $proposalFilters,
  $proposalSort,
  $proposalPage,
  $proposalTotalCount,
  $proposalListLoading,
  $proposalListError,
  $proposalStatusCounts,
  setProposalList,
  setProposalFilters,
  updateFilters,
  toggleStatusFilter,
  clearAllFilters,
  clearSearch,
  setProposalSort,
  setProposalPage,
  nextPage,
  previousPage,
  setProposalTotalCount,
  setProposalListLoading,
  setProposalListError,
  setProposalStatusCounts,
  initFromUrlParams,
  getUrlParams,
  type ProposalListItem,
} from '@/stores';

describe('Proposal List State Atoms', () => {
  beforeEach(() => {
    // Reset all atoms
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
    $proposalListLoading.set(false);
    $proposalListError.set(null);
    $proposalStatusCounts.set({
      Active: 0,
      Passed: 0,
      Failed: 0,
      Pending: 0,
    });
  });

  describe('$proposalList', () => {
    const mockProposals: ProposalListItem[] = [
      {
        id: 'prop-1',
        title: 'Test Proposal 1',
        proposer: 'user-1',
        status: 'Active',
        votesFor: 100,
        votesAgainst: 50,
        votesAbstain: 25,
        votingEndsAt: Date.now() + 86400000,
        createdAt: Date.now(),
      },
      {
        id: 'prop-2',
        title: 'Test Proposal 2',
        proposer: 'user-2',
        status: 'Passed',
        votesFor: 200,
        votesAgainst: 30,
        votesAbstain: 10,
        votingEndsAt: Date.now() - 86400000,
        createdAt: Date.now() - 172800000,
      },
    ];

    it('should set proposal list', () => {
      setProposalList(mockProposals);

      expect($proposalList.get()).toEqual(mockProposals);
    });

    it('should replace existing list', () => {
      setProposalList(mockProposals);
      setProposalList([mockProposals[0]]);

      expect($proposalList.get()).toHaveLength(1);
    });
  });

  describe('$proposalFilters', () => {
    it('should set complete filter state', () => {
      setProposalFilters({
        status: ['Active', 'Pending'],
        search: 'test',
        myProposals: true,
        notVoted: false,
      });

      const filters = $proposalFilters.get();
      expect(filters.status).toEqual(['Active', 'Pending']);
      expect(filters.search).toBe('test');
      expect(filters.myProposals).toBe(true);
    });

    it('should update partial filters', () => {
      updateFilters({ search: 'query' });

      expect($proposalFilters.get().search).toBe('query');
      expect($proposalFilters.get().status).toEqual([]);
    });

    it('should toggle status filter on', () => {
      toggleStatusFilter('Active');

      expect($proposalFilters.get().status).toContain('Active');
    });

    it('should toggle status filter off', () => {
      $proposalFilters.set({
        status: ['Active', 'Pending'],
        search: '',
        myProposals: false,
        notVoted: false,
      });

      toggleStatusFilter('Active');

      expect($proposalFilters.get().status).not.toContain('Active');
      expect($proposalFilters.get().status).toContain('Pending');
    });

    it('should clear all filters', () => {
      $proposalFilters.set({
        status: ['Active', 'Pending'],
        search: 'test',
        myProposals: true,
        notVoted: true,
      });

      clearAllFilters();

      const filters = $proposalFilters.get();
      expect(filters.status).toEqual([]);
      expect(filters.search).toBe('');
      expect(filters.myProposals).toBe(false);
      expect(filters.notVoted).toBe(false);
    });

    it('should clear search only', () => {
      $proposalFilters.set({
        status: ['Active'],
        search: 'test',
        myProposals: true,
        notVoted: false,
      });

      clearSearch();

      expect($proposalFilters.get().search).toBe('');
      expect($proposalFilters.get().status).toEqual(['Active']);
      expect($proposalFilters.get().myProposals).toBe(true);
    });

    it('should reset page when filters change', () => {
      $proposalPage.set(5);

      updateFilters({ search: 'new search' });

      expect($proposalPage.get()).toBe(1);
    });
  });

  describe('$proposalSort', () => {
    it('should set sort option', () => {
      setProposalSort('oldest');

      expect($proposalSort.get()).toBe('oldest');
    });

    it('should accept all valid sort options', () => {
      setProposalSort('newest');
      expect($proposalSort.get()).toBe('newest');

      setProposalSort('oldest');
      expect($proposalSort.get()).toBe('oldest');

      setProposalSort('mostVotes');
      expect($proposalSort.get()).toBe('mostVotes');

      setProposalSort('endingSoon');
      expect($proposalSort.get()).toBe('endingSoon');
    });

    it('should reset page when sort changes', () => {
      $proposalPage.set(5);

      setProposalSort('oldest');

      expect($proposalPage.get()).toBe(1);
    });
  });

  describe('$proposalPage', () => {
    it('should set page number', () => {
      // Need totalCount for page clamping to allow page 3
      $proposalTotalCount.set(100);

      setProposalPage(3);

      expect($proposalPage.get()).toBe(3);
    });

    it('should go to next page', () => {
      // Need to set totalCount so maxPage > 1
      $proposalTotalCount.set(100);

      nextPage();

      expect($proposalPage.get()).toBe(2);
    });

    it('should go to previous page', () => {
      $proposalTotalCount.set(100);
      $proposalPage.set(3);
      previousPage();

      expect($proposalPage.get()).toBe(2);
    });

    it('should not go below page 1', () => {
      $proposalTotalCount.set(100);
      previousPage();

      expect($proposalPage.get()).toBe(1);
    });
  });

  describe('$proposalTotalCount', () => {
    it('should set total count', () => {
      setProposalTotalCount(100);

      expect($proposalTotalCount.get()).toBe(100);
    });
  });

  describe('$proposalListLoading', () => {
    it('should set loading state', () => {
      setProposalListLoading(true);

      expect($proposalListLoading.get()).toBe(true);
    });
  });

  describe('$proposalListError', () => {
    it('should set error message', () => {
      setProposalListError('Failed to load');

      expect($proposalListError.get()).toBe('Failed to load');
    });

    it('should clear error', () => {
      setProposalListError('Error');
      setProposalListError(null);

      expect($proposalListError.get()).toBeNull();
    });
  });

  describe('$proposalStatusCounts', () => {
    it('should set status counts', () => {
      setProposalStatusCounts({
        Active: 10,
        Passed: 20,
        Failed: 5,
        Pending: 3,
      });

      const counts = $proposalStatusCounts.get();
      expect(counts.Active).toBe(10);
      expect(counts.Passed).toBe(20);
      expect(counts.Failed).toBe(5);
      expect(counts.Pending).toBe(3);
    });
  });

  describe('URL params sync', () => {
    it('should initialize from URL params', () => {
      const params = new URLSearchParams('status=Active,Pending&search=test&sort=oldest&page=2');

      initFromUrlParams(params);

      expect($proposalFilters.get().status).toEqual(['Active', 'Pending']);
      expect($proposalFilters.get().search).toBe('test');
      expect($proposalSort.get()).toBe('oldest');
      expect($proposalPage.get()).toBe(2);
    });

    it('should generate URL params from state', () => {
      $proposalFilters.set({
        status: ['Active'],
        search: 'query',
        myProposals: true,
        notVoted: false,
      });
      $proposalSort.set('mostVotes');
      $proposalPage.set(3);

      const params = getUrlParams();

      expect(params.get('status')).toBe('Active');
      expect(params.get('search')).toBe('query');
      expect(params.get('myProposals')).toBe('true');
      expect(params.get('sort')).toBe('mostVotes');
      expect(params.get('page')).toBe('3');
    });

    it('should not include default values in URL params', () => {
      // Default state
      const params = getUrlParams();

      expect(params.get('status')).toBeNull();
      expect(params.get('search')).toBeNull();
      expect(params.get('sort')).toBeNull(); // 'newest' is default
      expect(params.get('page')).toBeNull(); // 1 is default
    });

    it('should handle empty URL params', () => {
      const params = new URLSearchParams('');

      initFromUrlParams(params);

      expect($proposalFilters.get().status).toEqual([]);
      expect($proposalFilters.get().search).toBe('');
      expect($proposalSort.get()).toBe('newest');
      expect($proposalPage.get()).toBe(1);
    });

    it('should handle invalid page number', () => {
      const params = new URLSearchParams('page=invalid');

      initFromUrlParams(params);

      expect($proposalPage.get()).toBe(1);
    });

    it('should accept any sort value from URL', () => {
      // Note: URL params are not validated - the UI should only generate valid values
      const params = new URLSearchParams('sort=endingSoon');

      initFromUrlParams(params);

      expect($proposalSort.get()).toBe('endingSoon');
    });
  });
});
