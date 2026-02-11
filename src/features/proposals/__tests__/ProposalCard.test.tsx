/**
 * ProposalCard Component Tests
 *
 * Tests for proposal card display, status badges, and accessibility.
 *
 * Story: 9-1-3-proposal-listing
 * AC: 1, 6, 7
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProposalCard } from '../components/ProposalCard';
import type { ProposalListItem } from '@/stores';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Wrapper with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('ProposalCard', () => {
  const baseProposal: ProposalListItem = {
    id: 'prop-123',
    title: 'Test Proposal Title',
    proposer: 'user-456',
    status: 'Active',
    votesFor: 100,
    votesAgainst: 50,
    votesAbstain: 25,
    votingEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
    createdAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC-1: List view with title, status badge, vote count, deadline', () => {
    it('should display proposal title', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      expect(screen.getByText('Test Proposal Title')).toBeInTheDocument();
    });

    it('should display status badge for Active status', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      // Active status shows as "Voting Open"
      expect(screen.getByText('Voting Open')).toBeInTheDocument();
    });

    it('should display vote counts', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      expect(screen.getByText('100')).toBeInTheDocument(); // votesFor
      expect(screen.getByText('50')).toBeInTheDocument(); // votesAgainst
      expect(screen.getByText('25')).toBeInTheDocument(); // votesAbstain
    });

    it('should display deadline countdown', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      expect(screen.getByText(/remaining/i)).toBeInTheDocument();
    });

    it('should show correct badge color for Active status', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      const badge = screen.getByText('Voting Open');
      expect(badge).toHaveClass('bg-green-100', 'text-green-700');
    });

    it('should show correct badge color for Passed status', () => {
      const passedProposal = { ...baseProposal, status: 'Passed' as const };
      renderWithRouter(<ProposalCard proposal={passedProposal} />);

      const badge = screen.getByText('Passed');
      expect(badge).toHaveClass('bg-teal-100', 'text-teal-700');
    });

    it('should show correct badge color for Failed status', () => {
      const failedProposal = { ...baseProposal, status: 'Failed' as const };
      renderWithRouter(<ProposalCard proposal={failedProposal} />);

      const badge = screen.getByText('Failed');
      expect(badge).toHaveClass('bg-red-100', 'text-red-700');
    });

    it('should show correct badge for Pending status', () => {
      const pendingProposal = { ...baseProposal, status: 'Pending' as const };
      renderWithRouter(<ProposalCard proposal={pendingProposal} />);

      // Pending status shows as "Pending Review"
      const badge = screen.getByText('Pending Review');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-700');
    });
  });

  describe('AC-6: Click navigates to detail page', () => {
    it('should navigate to proposal detail page when clicked', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      const card = screen.getByRole('article');
      fireEvent.click(card);

      expect(mockNavigate).toHaveBeenCalledWith('/proposals/prop-123');
    });

    it('should have proper cursor style for clickable area', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      const card = screen.getByRole('article');
      expect(card).toHaveClass('cursor-pointer');
    });
  });

  describe('AC-7: Visual indicator for user voted', () => {
    it('should show voted indicator when hasVoted is true', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} hasVoted={true} />);

      expect(screen.getByText(/you voted/i)).toBeInTheDocument();
    });

    it('should not show voted indicator when hasVoted is false', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} hasVoted={false} />);

      expect(screen.queryByText(/you voted/i)).not.toBeInTheDocument();
    });

    it('should not show voted indicator when hasVoted is undefined', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      expect(screen.queryByText(/you voted/i)).not.toBeInTheDocument();
    });
  });

  describe('Deadline display', () => {
    it('should show "Voting Ended" for past deadlines', () => {
      const expiredProposal = {
        ...baseProposal,
        votingEndsAt: Date.now() - 1000,
      };
      renderWithRouter(<ProposalCard proposal={expiredProposal} />);

      expect(screen.getByText(/voting ended/i)).toBeInTheDocument();
    });

    it('should show time remaining for future deadlines', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      // Should show days remaining (e.g., "6d 23h remaining")
      expect(screen.getByText(/\d+d.*remaining/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have article role', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should navigate on Enter key', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      const card = screen.getByRole('article');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(mockNavigate).toHaveBeenCalledWith('/proposals/prop-123');
    });

    it('should navigate on Space key', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      const card = screen.getByRole('article');
      fireEvent.keyDown(card, { key: ' ' });

      expect(mockNavigate).toHaveBeenCalledWith('/proposals/prop-123');
    });

    it('should have aria-label describing the proposal', () => {
      renderWithRouter(<ProposalCard proposal={baseProposal} />);

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', expect.stringContaining('Test Proposal Title'));
    });
  });
});
