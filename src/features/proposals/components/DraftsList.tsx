/**
 * Drafts List Component
 *
 * Displays a list of user's proposal drafts with search, sort, and management.
 *
 * Story: 9-1-6-draft-proposal-management
 * ACs: 3, 5
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@nanostores/react';
import {
  $draftsList,
  deleteDraft,
  clearAllDrafts,
  setCurrentDraft,
  getDraftsForUser,
  sortDrafts,
  filterDraftsBySearch,
  type ProposalDraft,
  type DraftSort,
  showSuccess,
} from '@/stores';
import { Button } from '../../../components/ui/button';
import { getUserId } from '../../../utils/auth';
import { trackDraftDeleted } from '../../../utils/posthog';

// ============================================================================
// Types
// ============================================================================

export interface DraftsListProps {
  /** Maximum number of drafts to show (0 = no limit) */
  maxVisible?: number;
  /** Whether to show the search/sort controls */
  showControls?: boolean;
  /** Callback when a draft is deleted */
  onDraftDeleted?: (draftId: string) => void;
}

// ============================================================================
// Delete Confirmation Dialog
// ============================================================================

interface DeleteDialogProps {
  isOpen: boolean;
  draftTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmDialog({
  isOpen,
  draftTitle,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 id="delete-dialog-title" className="text-lg font-semibold text-gray-900">
          Delete Draft?
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          This will permanently delete "{draftTitle || 'Untitled Draft'}". This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="min-w-[80px]"
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Deleting
              </span>
            ) : (
              'Delete'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Draft Card Component
// ============================================================================

interface DraftCardProps {
  draft: ProposalDraft;
  onDelete: (draft: ProposalDraft) => void;
}

function DraftCard({ draft, onDelete }: DraftCardProps) {
  const navigate = useNavigate();

  const handleContinue = () => {
    setCurrentDraft(draft.id);
    // Navigate to resume route
    navigate(`/proposals/draft/${draft.id}/edit`);
  };

  const statusBadge = {
    drafting: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Drafting' },
    'ai-processing': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'AI Processing' },
    'ready-for-review': { bg: 'bg-green-100', text: 'text-green-700', label: 'Ready' },
  }[draft.status] ?? { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' };

  const updatedDate = new Date(draft.updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updatedDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let updatedAgo: string;
  if (diffMins < 1) {
    updatedAgo = 'Just now';
  } else if (diffMins < 60) {
    updatedAgo = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    updatedAgo = `${diffHours}h ago`;
  } else if (diffDays < 7) {
    updatedAgo = `${diffDays}d ago`;
  } else {
    updatedAgo = updatedDate.toLocaleDateString();
  }

  return (
    <div
      className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors bg-white"
      role="article"
      aria-label={`Draft: ${draft.title || 'Untitled'}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{draft.title || 'Untitled Draft'}</h3>
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
            {draft.prompt || 'No description'}
          </p>
        </div>
        <div className="ml-2 flex items-center gap-2">
          <span
            className={`flex-shrink-0 rounded px-2 py-1 text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
          >
            {statusBadge.label}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(draft);
            }}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Delete draft"
            aria-label={`Delete draft: ${draft.title || 'Untitled'}`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-400">Updated {updatedAgo}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleContinue}
          className="min-h-[44px] min-w-[44px]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyDrafts({ onCreateProposal }: { onCreateProposal: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
      <p className="mt-2 text-gray-900 font-medium">No drafts yet</p>
      <p className="text-sm text-gray-500">Start creating a proposal to save a draft.</p>
      <Button onClick={onCreateProposal} className="mt-4">
        Create Proposal
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DraftsList({
  maxVisible = 0,
  showControls = true,
  onDraftDeleted,
}: DraftsListProps) {
  const navigate = useNavigate();
  const allDrafts = useStore($draftsList);
  const userId = getUserId();

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<DraftSort>('recent');
  const [deleteTarget, setDeleteTarget] = useState<ProposalDraft | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter drafts by user (privacy)
  const userDrafts = useMemo(() => {
    if (!userId) return allDrafts; // Show all if no user (legacy)
    return getDraftsForUser(userId);
  }, [allDrafts, userId]);

  // Apply search and sort
  const displayDrafts = useMemo(() => {
    let result = userDrafts;

    // Apply search filter
    if (searchTerm) {
      result = filterDraftsBySearch(result, searchTerm);
    }

    // Apply sort
    result = sortDrafts(result, sortBy);

    // Apply max visible limit
    if (maxVisible > 0) {
      result = result.slice(0, maxVisible);
    }

    return result;
  }, [userDrafts, searchTerm, sortBy, maxVisible]);

  // Handle delete
  const handleDeleteClick = useCallback((draft: ProposalDraft) => {
    setDeleteTarget(draft);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);

    // Small delay for UX feedback
    await new Promise((resolve) => setTimeout(resolve, 300));

    const deleted = deleteDraft(deleteTarget.id);

    if (deleted) {
      showSuccess('Draft deleted');
      trackDraftDeleted(deleteTarget.id);
      onDraftDeleted?.(deleteTarget.id);
    }

    setIsDeleting(false);
    setDeleteTarget(null);
  }, [deleteTarget, onDraftDeleted]);

  const handleDeleteCancel = useCallback(() => {
    if (!isDeleting) {
      setDeleteTarget(null);
    }
  }, [isDeleting]);

  const handleClearAll = useCallback(() => {
    if (confirm('Delete all drafts? This cannot be undone.')) {
      clearAllDrafts();
      showSuccess('All drafts deleted');
    }
  }, []);

  const handleCreateProposal = useCallback(() => {
    navigate('/proposals/create');
  }, [navigate]);

  // Empty state
  if (userDrafts.length === 0) {
    return <EmptyDrafts onCreateProposal={handleCreateProposal} />;
  }

  return (
    <div>
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Your Drafts ({userDrafts.length})</h2>

        {showControls && userDrafts.length > 1 && (
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search drafts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-40 sm:w-48 px-3 py-2 pl-9 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                aria-label="Search drafts"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as DraftSort)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              aria-label="Sort drafts"
            >
              <option value="recent">Recent</option>
              <option value="title">Title</option>
            </select>

            {/* Clear all */}
            <button
              onClick={handleClearAll}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors whitespace-nowrap"
              aria-label="Clear all drafts"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Search results message */}
      {searchTerm && displayDrafts.length === 0 && (
        <div className="text-center py-8 text-gray-500">No drafts match "{searchTerm}"</div>
      )}

      {/* Drafts grid */}
      {displayDrafts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayDrafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} onDelete={handleDeleteClick} />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        draftTitle={deleteTarget?.title ?? ''}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isDeleting={isDeleting}
      />
    </div>
  );
}

export default DraftsList;
