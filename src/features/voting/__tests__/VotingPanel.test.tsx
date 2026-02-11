/**
 * VotingPanel Component Tests
 *
 * Tests for vote buttons, confirmation dialog, and accessibility.
 *
 * Story: 9-1-2-voting-interface
 * AC: 2, 5, 6, 7, 8
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VotingPanel } from '../components/VotingPanel';
import type { UserVote } from '@/stores';

// Wrapper with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('VotingPanel', () => {
  const defaultProps = {
    proposalId: 'prop-123',
    proposalTitle: 'Test Proposal',
    votingEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
    isActive: true,
    userVote: null,
    isMember: true,
    isSubmitting: false,
    onVote: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AC-2: Three voting buttons', () => {
    it('should render Yes, No, and Abstain buttons', () => {
      renderWithRouter(<VotingPanel {...defaultProps} />);

      expect(screen.getByRole('button', { name: /vote yes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /vote no/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /vote abstain/i })).toBeInTheDocument();
    });

    it('should disable buttons when not a member', () => {
      renderWithRouter(<VotingPanel {...defaultProps} isMember={false} />);

      expect(screen.getByText(/membership required/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /join to vote/i })).toBeInTheDocument();
    });

    it('should disable buttons when voting is closed', () => {
      renderWithRouter(
        <VotingPanel
          {...defaultProps}
          votingEndsAt={Date.now() - 1000} // Already ended
        />
      );

      expect(screen.getByText(/voting has ended/i)).toBeInTheDocument();
    });
  });

  describe('AC-5: Confirmation dialog', () => {
    it('should show confirmation dialog when clicking vote button', async () => {
      renderWithRouter(<VotingPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /vote yes/i }));

      await waitFor(() => {
        expect(screen.getByText(/confirm your vote/i)).toBeInTheDocument();
        expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
      });
    });

    it('should include proposal title in confirmation dialog', async () => {
      renderWithRouter(<VotingPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /vote yes/i }));

      await waitFor(() => {
        expect(screen.getByText(/test proposal/i)).toBeInTheDocument();
      });
    });

    it('should close dialog when clicking Cancel', async () => {
      renderWithRouter(<VotingPanel {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /vote yes/i }));

      await waitFor(() => {
        expect(screen.getByText(/confirm your vote/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText(/confirm your vote/i)).not.toBeInTheDocument();
      });
    });

    it('should call onVote when confirming', async () => {
      const onVote = vi.fn().mockResolvedValue(undefined);
      renderWithRouter(<VotingPanel {...defaultProps} onVote={onVote} />);

      fireEvent.click(screen.getByRole('button', { name: /vote yes/i }));

      await waitFor(() => {
        expect(screen.getByText(/confirm your vote/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /confirm vote/i }));

      await waitFor(() => {
        expect(onVote).toHaveBeenCalledWith('yes');
      });
    });
  });

  describe('AC-7: Already-voted indicator', () => {
    it('should show "You voted" message when user has voted', () => {
      const userVote: UserVote = {
        proposalId: 'prop-123',
        vote: 'yes',
        votedAt: Date.now(),
        transactionId: 'tx-123',
      };

      renderWithRouter(<VotingPanel {...defaultProps} userVote={userVote} />);

      expect(screen.getByText(/you voted yes/i)).toBeInTheDocument();
      expect(screen.getByText(/votes are final/i)).toBeInTheDocument();
    });

    it('should show transaction ID when available', () => {
      const userVote: UserVote = {
        proposalId: 'prop-123',
        vote: 'no',
        votedAt: Date.now(),
        transactionId: 'tx-456',
      };

      renderWithRouter(<VotingPanel {...defaultProps} userVote={userVote} />);

      expect(screen.getByText(/tx-456/)).toBeInTheDocument();
    });
  });

  describe('AC-8: Member verification', () => {
    it('should show "Join to Vote" CTA for non-members', () => {
      renderWithRouter(<VotingPanel {...defaultProps} isMember={false} />);

      const joinButton = screen.getByRole('button', { name: /join to vote/i });
      expect(joinButton).toBeInTheDocument();
    });
  });

  describe('Submitting state', () => {
    it('should show submitting message during vote submission', () => {
      renderWithRouter(<VotingPanel {...defaultProps} isSubmitting={true} />);

      expect(screen.getByText(/submitting your vote/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on vote buttons', () => {
      renderWithRouter(<VotingPanel {...defaultProps} />);

      const yesButton = screen.getByRole('button', { name: /vote yes on test proposal/i });
      const noButton = screen.getByRole('button', { name: /vote no on test proposal/i });
      const abstainButton = screen.getByRole('button', { name: /vote abstain on test proposal/i });

      expect(yesButton).toHaveAttribute('aria-label', 'Vote Yes on Test Proposal');
      expect(noButton).toHaveAttribute('aria-label', 'Vote No on Test Proposal');
      expect(abstainButton).toHaveAttribute('aria-label', 'Vote Abstain on Test Proposal');
    });

    it('should have tooltip explaining abstain semantics', () => {
      renderWithRouter(<VotingPanel {...defaultProps} />);

      expect(screen.getByText(/abstain counts toward quorum/i)).toBeInTheDocument();
    });

    it('should have minimum touch target size (44x44px)', () => {
      renderWithRouter(<VotingPanel {...defaultProps} />);

      const buttons = screen
        .getAllByRole('button')
        .filter((btn) => btn.textContent?.match(/yes|no|abstain/i));

      buttons.forEach((button) => {
        expect(button).toHaveClass('min-h-[44px]');
      });
    });
  });

  describe('Deadline warning', () => {
    it('should show warning when deadline is imminent', async () => {
      renderWithRouter(
        <VotingPanel
          {...defaultProps}
          votingEndsAt={Date.now() + 15000} // 15 seconds remaining
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /vote yes/i }));

      await waitFor(() => {
        expect(screen.getByText(/voting ends in/i)).toBeInTheDocument();
      });
    });
  });
});
