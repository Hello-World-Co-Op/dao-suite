/**
 * DraftsList Component Tests
 *
 * Tests for the drafts list display, search, sort, and delete functionality.
 *
 * Story: 9-1-6-draft-proposal-management
 * ACs: 3, 5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DraftsList } from '../components/DraftsList';
import { createDraft, clearAllDrafts } from '@/stores';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock getUserId
vi.mock('../../../utils/auth', () => ({
  getUserId: () => 'test-user-principal',
}));

// Wrapper with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('DraftsList', () => {
  beforeEach(() => {
    clearAllDrafts();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearAllDrafts();
  });

  describe('AC-3: Drafts accessible from proposals page', () => {
    it('should display empty state when no drafts exist', () => {
      renderWithRouter(<DraftsList />);

      expect(screen.getByText('No drafts yet')).toBeInTheDocument();
      expect(screen.getByText('Start creating a proposal to save a draft.')).toBeInTheDocument();
    });

    it('should display create proposal button in empty state', () => {
      renderWithRouter(<DraftsList />);

      const createButton = screen.getByRole('button', { name: /create proposal/i });
      expect(createButton).toBeInTheDocument();

      fireEvent.click(createButton);
      expect(mockNavigate).toHaveBeenCalledWith('/proposals/create');
    });

    it('should display drafts list when drafts exist', () => {
      createDraft({ title: 'Test Draft 1' }, 'test-user-principal');
      createDraft({ title: 'Test Draft 2' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByText('Test Draft 1')).toBeInTheDocument();
      expect(screen.getByText('Test Draft 2')).toBeInTheDocument();
    });

    it('should display draft count in header', () => {
      createDraft({ title: 'Draft 1' }, 'test-user-principal');
      createDraft({ title: 'Draft 2' }, 'test-user-principal');
      createDraft({ title: 'Draft 3' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByText(/Your Drafts \(3\)/)).toBeInTheDocument();
    });

    it('should show status badges', () => {
      createDraft({ title: 'Drafting Draft', status: 'drafting' }, 'test-user-principal');
      createDraft({ title: 'Ready Draft', status: 'ready-for-review' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByText('Drafting')).toBeInTheDocument();
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should display "Updated X ago" timestamp', () => {
      createDraft({ title: 'Recent Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });
  });

  describe('AC-5: Delete draft with confirmation', () => {
    it('should show delete button on draft cards', () => {
      createDraft({ title: 'Test Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      const deleteButton = screen.getByRole('button', { name: /delete draft/i });
      expect(deleteButton).toBeInTheDocument();
    });

    it('should show confirmation dialog when delete is clicked', () => {
      createDraft({ title: 'Test Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      const deleteButton = screen.getByRole('button', { name: /delete draft/i });
      fireEvent.click(deleteButton);

      expect(screen.getByText('Delete Draft?')).toBeInTheDocument();
      expect(screen.getByText(/will permanently delete/i)).toBeInTheDocument();
    });

    it('should close dialog when cancel is clicked', () => {
      createDraft({ title: 'Test Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      const deleteButton = screen.getByRole('button', { name: /delete draft/i });
      fireEvent.click(deleteButton);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(screen.queryByText('Delete Draft?')).not.toBeInTheDocument();
    });

    it('should delete draft when confirmed', async () => {
      createDraft({ title: 'Draft to Delete' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByText('Draft to Delete')).toBeInTheDocument();

      const deleteButton = screen.getByRole('button', { name: /delete draft/i });
      fireEvent.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /^delete$/i });
      fireEvent.click(confirmButton);

      // After delete, should show empty state
      await waitFor(() => {
        expect(screen.queryByText('Draft to Delete')).not.toBeInTheDocument();
      });
    });
  });

  describe('Search functionality', () => {
    it('should show search input when multiple drafts exist', () => {
      createDraft({ title: 'Draft 1' }, 'test-user-principal');
      createDraft({ title: 'Draft 2' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      expect(screen.getByPlaceholderText('Search drafts...')).toBeInTheDocument();
    });

    it('should filter drafts by search term', () => {
      createDraft({ title: 'Community Garden' }, 'test-user-principal');
      createDraft({ title: 'Housing Project' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      const searchInput = screen.getByPlaceholderText('Search drafts...');
      fireEvent.change(searchInput, { target: { value: 'garden' } });

      expect(screen.getByText('Community Garden')).toBeInTheDocument();
      expect(screen.queryByText('Housing Project')).not.toBeInTheDocument();
    });

    it('should show no results message when search has no matches', () => {
      createDraft({ title: 'Test Draft' }, 'test-user-principal');
      createDraft({ title: 'Another Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      const searchInput = screen.getByPlaceholderText('Search drafts...');
      fireEvent.change(searchInput, { target: { value: 'xyz123' } });

      expect(screen.getByText(/No drafts match/)).toBeInTheDocument();
    });
  });

  describe('Sort functionality', () => {
    it('should show sort dropdown when multiple drafts exist', () => {
      createDraft({ title: 'Draft 1' }, 'test-user-principal');
      createDraft({ title: 'Draft 2' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      expect(screen.getByRole('combobox', { name: /sort drafts/i })).toBeInTheDocument();
    });

    it('should sort by recent by default', async () => {
      // Create drafts with delay to ensure different timestamps
      createDraft({ title: 'First Draft' }, 'test-user-principal');
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));
      createDraft({ title: 'Second Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      // Most recent should be first
      const articles = screen.getAllByRole('article');
      expect(articles[0]).toHaveAttribute('aria-label', 'Draft: Second Draft');
    });

    it('should sort by title when selected', () => {
      createDraft({ title: 'Zebra Project' }, 'test-user-principal');
      createDraft({ title: 'Apple Initiative' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      const sortDropdown = screen.getByRole('combobox', { name: /sort drafts/i });
      fireEvent.change(sortDropdown, { target: { value: 'title' } });

      const articles = screen.getAllByRole('article');
      expect(articles[0]).toHaveAttribute('aria-label', 'Draft: Apple Initiative');
    });
  });

  describe('Continue editing', () => {
    it('should show continue button on each draft', () => {
      createDraft({ title: 'Test Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });

    it('should navigate to edit route when continue is clicked', () => {
      const draft = createDraft({ title: 'Test Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      expect(mockNavigate).toHaveBeenCalledWith(`/proposals/draft/${draft!.id}/edit`);
    });
  });

  describe('Clear all functionality', () => {
    it('should show clear all button when multiple drafts exist', () => {
      createDraft({ title: 'Draft 1' }, 'test-user-principal');
      createDraft({ title: 'Draft 2' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    });

    it('should not show clear all button when only one draft', () => {
      createDraft({ title: 'Only Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument();
    });
  });

  describe('maxVisible prop', () => {
    it('should limit displayed drafts when maxVisible is set', () => {
      createDraft({ title: 'Draft 1' }, 'test-user-principal');
      createDraft({ title: 'Draft 2' }, 'test-user-principal');
      createDraft({ title: 'Draft 3' }, 'test-user-principal');

      renderWithRouter(<DraftsList maxVisible={2} />);

      const articles = screen.getAllByRole('article');
      expect(articles.length).toBe(2);
    });

    it('should show all drafts when maxVisible is 0', () => {
      createDraft({ title: 'Draft 1' }, 'test-user-principal');
      createDraft({ title: 'Draft 2' }, 'test-user-principal');
      createDraft({ title: 'Draft 3' }, 'test-user-principal');

      renderWithRouter(<DraftsList maxVisible={0} />);

      const articles = screen.getAllByRole('article');
      expect(articles.length).toBe(3);
    });
  });

  describe('User privacy', () => {
    it('should only show drafts for current user', () => {
      createDraft({ title: 'My Draft' }, 'test-user-principal');
      createDraft({ title: 'Other User Draft' }, 'other-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByText('My Draft')).toBeInTheDocument();
      expect(screen.queryByText('Other User Draft')).not.toBeInTheDocument();
    });

    it('should show legacy drafts without userPrincipal', () => {
      createDraft({ title: 'Legacy Draft' }, '');
      createDraft({ title: 'My Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByText('Legacy Draft')).toBeInTheDocument();
      expect(screen.getByText('My Draft')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have article role for draft cards', () => {
      createDraft({ title: 'Test Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should have aria-label on draft cards', () => {
      createDraft({ title: 'Accessible Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', 'Draft: Accessible Draft');
    });

    it('should have aria-label on search input', () => {
      createDraft({ title: 'Draft 1' }, 'test-user-principal');
      createDraft({ title: 'Draft 2' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      expect(screen.getByRole('textbox', { name: /search drafts/i })).toBeInTheDocument();
    });

    it('should have aria-label on sort dropdown', () => {
      createDraft({ title: 'Draft 1' }, 'test-user-principal');
      createDraft({ title: 'Draft 2' }, 'test-user-principal');

      renderWithRouter(<DraftsList showControls={true} />);

      expect(screen.getByRole('combobox', { name: /sort drafts/i })).toBeInTheDocument();
    });

    it('should have accessible delete dialog', () => {
      createDraft({ title: 'Test Draft' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      const deleteButton = screen.getByRole('button', { name: /delete draft/i });
      fireEvent.click(deleteButton);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'delete-dialog-title');
    });
  });

  describe('Untitled drafts', () => {
    it('should display "Untitled Draft" for drafts without title', () => {
      createDraft({ title: '' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByText('Untitled Draft')).toBeInTheDocument();
    });

    it('should display "No description" for drafts without prompt', () => {
      createDraft({ title: 'Test', prompt: '' }, 'test-user-principal');

      renderWithRouter(<DraftsList />);

      expect(screen.getByText('No description')).toBeInTheDocument();
    });
  });
});
