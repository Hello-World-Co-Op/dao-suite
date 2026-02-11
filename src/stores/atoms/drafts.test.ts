/**
 * Draft State Tests
 *
 * Tests for the proposal draft state management.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * Story: 9-1-6-draft-proposal-management
 * AC: 2, 3, 6, 8 (9-1-1), AC: 1-5 (9-1-6)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  $drafts,
  $currentDraftId,
  $currentDraft,
  $draftsList,
  $draftsCount,
  $isSaving,
  $lastSavedAt,
  $saveError,
  $hasPendingChanges,
  $isAtMaxDrafts,
  createDraft,
  updateDraft,
  updateDraftDebounced,
  flushPendingSave,
  deleteDraft,
  getDraft,
  getDraftForUser,
  getDraftsForUser,
  setCurrentDraft,
  markSectionEdited,
  isSectionEdited,
  clearAllDrafts,
  sortDrafts,
  filterDraftsBySearch,
  persistDraft,
  MAX_DRAFTS,
  DRAFT_SCHEMA_VERSION,
  type ProposalDraft,
} from '@/stores';

describe('Draft State Management', () => {
  beforeEach(() => {
    // Clear all drafts before each test
    clearAllDrafts();
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearAllDrafts();
    vi.useRealTimers();
  });

  describe('createDraft', () => {
    it('should create a new draft with default values', () => {
      const draft = createDraft();

      expect(draft).not.toBeNull();
      expect(draft!.id).toBeDefined();
      expect(draft!.id).toMatch(/^draft-/);
      expect(draft!.title).toBe('');
      expect(draft!.prompt).toBe('');
      expect(draft!.scale).toBe('medium');
      expect(draft!.vertical).toBe('Community');
      expect(draft!.status).toBe('drafting');
      expect(draft!.editedSections).toEqual([]);
      expect(draft!.currentStep).toBe(0);
      expect(draft!.schemaVersion).toBe(DRAFT_SCHEMA_VERSION);
    });

    it('should create a draft with initial data', () => {
      const draft = createDraft({
        title: 'Test Proposal',
        prompt: 'A test proposal for community improvement',
        scale: 'large',
        vertical: 'Housing',
      });

      expect(draft!.title).toBe('Test Proposal');
      expect(draft!.prompt).toBe('A test proposal for community improvement');
      expect(draft!.scale).toBe('large');
      expect(draft!.vertical).toBe('Housing');
    });

    it('should set the new draft as current', () => {
      const draft = createDraft();
      expect($currentDraftId.get()).toBe(draft!.id);
    });

    it('should add the draft to the drafts map', () => {
      const draft = createDraft();
      expect($drafts.get()[draft!.id]).toEqual(draft);
    });

    it('should set userPrincipal when provided', () => {
      const draft = createDraft({}, 'user-principal-123');
      expect(draft!.userPrincipal).toBe('user-principal-123');
    });

    it('should not persist when persistImmediately is false', () => {
      const draft = createDraft({}, '', false);
      expect(draft).not.toBeNull();
      expect($drafts.get()[draft!.id]).toBeUndefined();
    });

    it('should enforce MAX_DRAFTS limit', () => {
      // Create MAX_DRAFTS drafts
      for (let i = 0; i < MAX_DRAFTS; i++) {
        createDraft();
      }

      // Try to create one more
      const extraDraft = createDraft();
      expect(extraDraft).toBeNull();
      expect($saveError.get()).toContain(`Maximum of ${MAX_DRAFTS}`);
    });
  });

  describe('updateDraft', () => {
    it('should update an existing draft', () => {
      const draft = createDraft({ title: 'Original' });
      vi.advanceTimersByTime(5);
      const updated = updateDraft(draft!.id, { title: 'Updated' });

      expect(updated?.title).toBe('Updated');
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(draft!.createdAt);
    });

    it('should return null for non-existent draft', () => {
      const result = updateDraft('non-existent-id', { title: 'Test' });
      expect(result).toBeNull();
    });

    it('should preserve unchanged fields', () => {
      const draft = createDraft({ title: 'Original', prompt: 'Original prompt' });
      const updated = updateDraft(draft!.id, { title: 'Updated' });

      expect(updated?.title).toBe('Updated');
      expect(updated?.prompt).toBe('Original prompt');
    });

    it('should set saving state during update', () => {
      const draft = createDraft();
      expect($isSaving.get()).toBe(false);
      updateDraft(draft!.id, { title: 'Test' });
      // After update completes, saving should be false
      expect($isSaving.get()).toBe(false);
    });

    it('should update lastSavedAt timestamp', () => {
      const draft = createDraft();
      const initialTime = $lastSavedAt.get();

      vi.advanceTimersByTime(1000);
      updateDraft(draft!.id, { title: 'Test' });

      expect($lastSavedAt.get()).toBeGreaterThan(initialTime!);
    });
  });

  describe('updateDraftDebounced', () => {
    it('should set hasPendingChanges immediately', () => {
      const draft = createDraft();
      expect($hasPendingChanges.get()).toBe(false);

      updateDraftDebounced(draft!.id, { title: 'Test' });
      expect($hasPendingChanges.get()).toBe(true);
    });

    it('should debounce multiple updates', () => {
      const draft = createDraft({ title: 'Original' });

      updateDraftDebounced(draft!.id, { title: 'Update 1' });
      updateDraftDebounced(draft!.id, { title: 'Update 2' });
      updateDraftDebounced(draft!.id, { title: 'Update 3' });

      // Before debounce expires, should still have original
      expect(getDraft(draft!.id)?.title).toBe('Original');

      // After debounce expires
      vi.advanceTimersByTime(1100);
      expect(getDraft(draft!.id)?.title).toBe('Update 3');
    });

    it('should merge updates within debounce window', () => {
      const draft = createDraft({ title: 'Original', prompt: 'Original' });

      updateDraftDebounced(draft!.id, { title: 'New Title' });
      updateDraftDebounced(draft!.id, { prompt: 'New Prompt' });

      vi.advanceTimersByTime(1100);

      const updated = getDraft(draft!.id);
      expect(updated?.title).toBe('New Title');
      expect(updated?.prompt).toBe('New Prompt');
    });
  });

  describe('flushPendingSave', () => {
    it('should immediately save pending changes', () => {
      const draft = createDraft({ title: 'Original' });

      updateDraftDebounced(draft!.id, { title: 'Flushed Update' });
      expect(getDraft(draft!.id)?.title).toBe('Original');

      flushPendingSave();
      expect(getDraft(draft!.id)?.title).toBe('Flushed Update');
    });

    it('should clear pending state after flush', () => {
      const draft = createDraft();
      updateDraftDebounced(draft!.id, { title: 'Test' });
      expect($hasPendingChanges.get()).toBe(true);

      flushPendingSave();
      expect($hasPendingChanges.get()).toBe(false);
    });

    it('should do nothing if no pending updates', () => {
      const draft = createDraft({ title: 'Original' });
      flushPendingSave();
      expect(getDraft(draft!.id)?.title).toBe('Original');
    });
  });

  describe('deleteDraft', () => {
    it('should delete an existing draft', () => {
      const draft = createDraft();
      expect(getDraft(draft!.id)).not.toBeNull();

      const result = deleteDraft(draft!.id);

      expect(result).toBe(true);
      expect(getDraft(draft!.id)).toBeNull();
    });

    it('should clear current draft if deleted', () => {
      const draft = createDraft();
      expect($currentDraftId.get()).toBe(draft!.id);

      deleteDraft(draft!.id);

      expect($currentDraftId.get()).toBe('');
    });

    it('should return false for non-existent draft', () => {
      const result = deleteDraft('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('getDraftForUser', () => {
    it('should return draft if user matches', () => {
      const draft = createDraft({}, 'user-123');
      const result = getDraftForUser(draft!.id, 'user-123');
      expect(result).not.toBeNull();
      expect(result!.id).toBe(draft!.id);
    });

    it('should return null if user does not match', () => {
      const draft = createDraft({}, 'user-123');
      const result = getDraftForUser(draft!.id, 'different-user');
      expect(result).toBeNull();
    });

    it('should return legacy drafts without userPrincipal', () => {
      const draft = createDraft({}, '');
      const result = getDraftForUser(draft!.id, 'any-user');
      expect(result).not.toBeNull();
    });
  });

  describe('getDraftsForUser', () => {
    it('should filter drafts by user principal', () => {
      createDraft({}, 'user-1');
      createDraft({}, 'user-1');
      createDraft({}, 'user-2');

      const user1Drafts = getDraftsForUser('user-1');
      expect(user1Drafts.length).toBe(2);

      const user2Drafts = getDraftsForUser('user-2');
      expect(user2Drafts.length).toBe(1);
    });

    it('should include legacy drafts without userPrincipal', () => {
      createDraft({}, '');
      createDraft({}, 'user-1');

      const drafts = getDraftsForUser('user-1');
      expect(drafts.length).toBe(2);
    });
  });

  describe('computed atoms', () => {
    it('$currentDraft should return the current draft object', () => {
      expect($currentDraft.get()).toBeNull();

      const draft = createDraft();
      expect($currentDraft.get()?.id).toEqual(draft!.id);
    });

    it('$draftsList should return drafts sorted by updatedAt', () => {
      const draft1 = createDraft({ title: 'First' });
      vi.advanceTimersByTime(10);
      createDraft({ title: 'Second' });
      vi.advanceTimersByTime(10);
      const draft3 = createDraft({ title: 'Third' });

      const list = $draftsList.get();

      expect(list.length).toBe(3);
      expect(list[0].id).toBe(draft3!.id); // Newest first
      expect(list[2].id).toBe(draft1!.id); // Oldest last
    });

    it('$draftsCount should return the number of drafts', () => {
      expect($draftsCount.get()).toBe(0);

      createDraft();
      expect($draftsCount.get()).toBe(1);

      createDraft();
      expect($draftsCount.get()).toBe(2);
    });

    it('$isAtMaxDrafts should be true when at limit', () => {
      expect($isAtMaxDrafts.get()).toBe(false);

      for (let i = 0; i < MAX_DRAFTS; i++) {
        createDraft();
      }

      expect($isAtMaxDrafts.get()).toBe(true);
    });
  });

  describe('section editing', () => {
    it('markSectionEdited should add section to editedSections', () => {
      const draft = createDraft();
      markSectionEdited(draft!.id, 'problemStatement');

      const updated = getDraft(draft!.id);
      expect(updated?.editedSections).toContain('problemStatement');
    });

    it('markSectionEdited should not duplicate sections', () => {
      const draft = createDraft();
      markSectionEdited(draft!.id, 'problemStatement');
      markSectionEdited(draft!.id, 'problemStatement');

      const updated = getDraft(draft!.id);
      expect(updated?.editedSections.filter((s) => s === 'problemStatement').length).toBe(1);
    });

    it('isSectionEdited should return true for edited sections', () => {
      const draft = createDraft();
      markSectionEdited(draft!.id, 'proposedSolution');

      expect(isSectionEdited(draft!.id, 'proposedSolution')).toBe(true);
      expect(isSectionEdited(draft!.id, 'problemStatement')).toBe(false);
    });
  });

  describe('setCurrentDraft', () => {
    it('should set the current draft ID', () => {
      const draft = createDraft();
      setCurrentDraft(null);
      expect($currentDraftId.get()).toBe('');

      setCurrentDraft(draft!.id);
      expect($currentDraftId.get()).toBe(draft!.id);
    });
  });

  describe('sortDrafts', () => {
    it('should sort by recent (default)', () => {
      const draft1 = createDraft({ title: 'A Draft' });
      vi.advanceTimersByTime(10);
      createDraft({ title: 'B Draft' });
      vi.advanceTimersByTime(10);
      const draft3 = createDraft({ title: 'C Draft' });

      const drafts = $draftsList.get();
      const sorted = sortDrafts(drafts, 'recent');

      expect(sorted[0].id).toBe(draft3!.id);
      expect(sorted[2].id).toBe(draft1!.id);
    });

    it('should sort by title alphabetically', () => {
      createDraft({ title: 'Zebra' });
      createDraft({ title: 'Apple' });
      createDraft({ title: 'Mango' });

      const drafts = $draftsList.get();
      const sorted = sortDrafts(drafts, 'title');

      expect(sorted[0].title).toBe('Apple');
      expect(sorted[1].title).toBe('Mango');
      expect(sorted[2].title).toBe('Zebra');
    });

    it('should handle untitled drafts in title sort', () => {
      createDraft({ title: '' });
      createDraft({ title: 'Named' });

      const drafts = $draftsList.get();
      const sorted = sortDrafts(drafts, 'title');

      // "Named" should come after "Untitled" alphabetically
      expect(sorted[0].title).toBe('Named');
      expect(sorted[1].title).toBe('');
    });
  });

  describe('filterDraftsBySearch', () => {
    it('should filter by title', () => {
      createDraft({ title: 'Community Garden Project' });
      createDraft({ title: 'Housing Initiative' });
      createDraft({ title: 'Education Program' });

      const drafts = $draftsList.get();
      const filtered = filterDraftsBySearch(drafts, 'garden');

      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Community Garden Project');
    });

    it('should filter by prompt', () => {
      createDraft({ title: 'Project A', prompt: 'This is about education' });
      createDraft({ title: 'Project B', prompt: 'This is about housing' });

      const drafts = $draftsList.get();
      const filtered = filterDraftsBySearch(drafts, 'education');

      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Project A');
    });

    it('should be case insensitive', () => {
      createDraft({ title: 'TEST PROPOSAL' });

      const drafts = $draftsList.get();
      const filtered = filterDraftsBySearch(drafts, 'test');

      expect(filtered.length).toBe(1);
    });

    it('should return all drafts for empty search', () => {
      createDraft({ title: 'One' });
      createDraft({ title: 'Two' });

      const drafts = $draftsList.get();
      const filtered = filterDraftsBySearch(drafts, '');

      expect(filtered.length).toBe(2);
    });
  });

  describe('persistDraft', () => {
    it('should persist a non-persisted draft', () => {
      const draft = createDraft({}, '', false);
      expect($drafts.get()[draft!.id]).toBeUndefined();

      const result = persistDraft(draft!);
      expect(result).toBe(true);
      expect($drafts.get()[draft!.id]).toBeDefined();
    });

    it('should update lastSavedAt', () => {
      const draft = createDraft({}, '', false);
      const beforeTime = $lastSavedAt.get();

      vi.advanceTimersByTime(100);
      persistDraft(draft!);

      expect($lastSavedAt.get()).toBeGreaterThan(beforeTime ?? 0);
    });

    it('should fail if at max drafts', () => {
      for (let i = 0; i < MAX_DRAFTS; i++) {
        createDraft();
      }

      const newDraft: ProposalDraft = {
        id: 'extra-draft',
        title: 'Extra',
        prompt: '',
        scale: 'medium',
        vertical: 'Community',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'drafting',
        editedSections: [],
        currentStep: 0,
        userPrincipal: '',
        schemaVersion: DRAFT_SCHEMA_VERSION,
      };

      const result = persistDraft(newDraft);
      expect(result).toBe(false);
      expect($saveError.get()).toContain('Maximum');
    });
  });
});
