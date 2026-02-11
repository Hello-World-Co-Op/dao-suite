/**
 * ProposalSort Component Tests
 *
 * Tests for sort dropdown functionality.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 3
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ProposalSort } from '../components/ProposalSort';
import { $proposalSort } from '@/stores';

// Reset atom before each test
beforeEach(() => {
  $proposalSort.set('newest');
});

describe('ProposalSort', () => {
  describe('AC-3: Sort by newest, oldest, most votes, ending soon', () => {
    it('should render sort dropdown', () => {
      render(<ProposalSort />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should have newest as default selection', () => {
      render(<ProposalSort />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('newest');
    });

    it('should have all sort options', () => {
      render(<ProposalSort />);

      const select = screen.getByRole('combobox');
      fireEvent.click(select);

      expect(screen.getByRole('option', { name: /newest/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /oldest/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /most votes/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /ending soon/i })).toBeInTheDocument();
    });

    it('should update atom when sort option is selected', () => {
      render(<ProposalSort />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'mostVotes' } });

      expect($proposalSort.get()).toBe('mostVotes');
    });

    it('should update to oldest', () => {
      render(<ProposalSort />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'oldest' } });

      expect($proposalSort.get()).toBe('oldest');
    });

    it('should update to endingSoon', () => {
      render(<ProposalSort />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'endingSoon' } });

      expect($proposalSort.get()).toBe('endingSoon');
    });
  });

  describe('Controlled state', () => {
    it('should reflect atom value', () => {
      $proposalSort.set('mostVotes');

      render(<ProposalSort />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('mostVotes');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label', () => {
      render(<ProposalSort />);

      const select = screen.getByRole('combobox');
      expect(select).toHaveAccessibleName();
    });

    it('should support keyboard navigation', () => {
      render(<ProposalSort />);

      const select = screen.getByRole('combobox');
      select.focus();

      expect(document.activeElement).toBe(select);
    });
  });
});
