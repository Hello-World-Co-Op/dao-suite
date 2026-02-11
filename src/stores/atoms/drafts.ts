/**
 * Proposal Draft State Management
 *
 * Uses nanostores with localStorage persistence for draft proposals.
 * Supports auto-save with debouncing, CRUD operations, and cross-tab sync.
 *
 * Story: 9-1-1-think-tank-proposal-creation
 * Story: 9-1-6-draft-proposal-management (enhancements)
 * ACs: 1, 2, 4, 5
 */

import { atom, computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import type {
  ThinkTankOutput,
  ProposalDraft,
  DraftSort,
} from '../types';
import { DRAFT_SCHEMA_VERSION, MAX_DRAFTS } from '../types';

// Re-export types for convenience
export type { ProposalDraft, DraftStatus, DraftSort } from '../types';
export { DRAFT_SCHEMA_VERSION, MAX_DRAFTS } from '../types';

// Storage keys - versioned for migrations
const DRAFTS_STORAGE_KEY = 'hwdao:proposal-drafts-v1';
const CURRENT_DRAFT_ID_KEY = 'hwdao:current-draft-id';

// Generate unique ID
function generateId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Schema Migration
// ============================================================================

/**
 * Derive a title from the prompt text
 * Truncates at ~60 chars on a word boundary
 */
function deriveTitleFromPrompt(prompt: string): string {
  if (!prompt || !prompt.trim()) return '';
  const maxLen = 60;
  let title = prompt.trim();
  if (title.length > maxLen) {
    title = title.substring(0, maxLen);
    const lastSpace = title.lastIndexOf(' ');
    if (lastSpace > 30) {
      title = title.substring(0, lastSpace);
    }
    title = title + '...';
  }
  return title;
}

/**
 * Migrate a draft to the current schema version
 * Adds default values for any missing fields
 * Derives title from prompt if missing (fixes drafts saved before title derivation)
 */
function migrateDraftSchema(draft: Partial<ProposalDraft>, id: string): ProposalDraft {
  // Derive title from prompt if title is empty but prompt exists
  const title = draft.title || deriveTitleFromPrompt(draft.prompt ?? '');

  return {
    id: draft.id ?? id,
    title,
    prompt: draft.prompt ?? '',
    scale: draft.scale ?? 'medium',
    vertical: draft.vertical ?? 'Community',
    thinkTankOutput: draft.thinkTankOutput,
    thinkTankRequestId: draft.thinkTankRequestId,
    createdAt: draft.createdAt ?? Date.now(),
    updatedAt: draft.updatedAt ?? Date.now(),
    status: draft.status ?? 'drafting',
    editedSections: draft.editedSections ?? [],
    // New fields with defaults
    currentStep: draft.currentStep ?? 0,
    userPrincipal: draft.userPrincipal ?? '',
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };
}

// ============================================================================
// Safe localStorage Operations
// ============================================================================

/**
 * Safely parse drafts from localStorage with error recovery
 */
function safeGetDrafts(): Record<string, ProposalDraft> {
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<ProposalDraft>>;
    // Migrate all drafts to current schema
    const migrated: Record<string, ProposalDraft> = {};
    for (const [key, draft] of Object.entries(parsed)) {
      migrated[key] = migrateDraftSchema(draft, key);
    }
    return migrated;
  } catch (error) {
    console.error('Draft storage corrupted, clearing:', error);
    try {
      localStorage.removeItem(DRAFTS_STORAGE_KEY);
    } catch {
      // Ignore removal errors
    }
    return {};
  }
}

/**
 * Safely save drafts to localStorage with quota handling
 * @returns true if saved successfully, false if quota exceeded
 */
function safeSaveDrafts(drafts: Record<string, ProposalDraft>): boolean {
  try {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded, cannot save drafts');
      $saveError.set('Storage quota exceeded. Please delete some drafts.');
      return false;
    }
    console.error('Failed to save drafts:', error);
    return false;
  }
}

// ============================================================================
// State Atoms
// ============================================================================

// Plain atom for drafts - we handle localStorage manually for proper quota handling
// Initialize from localStorage on module load
export const $drafts = atom<Record<string, ProposalDraft>>(safeGetDrafts());

// Current draft ID (which draft is being edited)
// Note: persistentAtom requires string, but we need null for "no selection"
export const $currentDraftId = persistentAtom<string>(
  CURRENT_DRAFT_ID_KEY,
  ''
);

// Story 9-1-6: Saving state indicator
export const $isSaving = atom<boolean>(false);

// Story 9-1-6: Last saved timestamp (null if never saved or no pending save)
export const $lastSavedAt = atom<number | null>(null);

// Story 9-1-6: Save error message (null if no error)
export const $saveError = atom<string | null>(null);

// Story 9-1-6: Pending changes indicator (dirty state)
export const $hasPendingChanges = atom<boolean>(false);

// Computed: Current draft object
export const $currentDraft = computed([$drafts, $currentDraftId], (drafts, currentId) => {
  if (!currentId) return null;
  const draft = drafts[currentId];
  if (!draft) return null;
  // Ensure id is always present and migrate schema
  return migrateDraftSchema(draft, currentId);
});

// Computed: List of all drafts sorted by updatedAt (newest first)
export const $draftsList = computed($drafts, (drafts) => {
  // Use Object.entries to ensure id is always present (from key if missing in value)
  return Object.entries(drafts)
    .map(([key, draft]) => migrateDraftSchema(draft, key))
    .sort((a, b) => b.updatedAt - a.updatedAt);
});

// Computed: Count of drafts
export const $draftsCount = computed($drafts, (drafts) => {
  return Object.keys(drafts).length;
});

// Story 9-1-6: Check if at max draft limit
export const $isAtMaxDrafts = computed($draftsCount, (count) => count >= MAX_DRAFTS);

// Debounce timer for auto-save
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 1000;

// Pending updates for flush on unmount
let pendingDraftId: string | null = null;
let pendingUpdates: Partial<Omit<ProposalDraft, 'id' | 'createdAt'>> | null = null;

// ============================================================================
// Draft CRUD Operations
// ============================================================================

/**
 * Create a new draft
 * Story 9-1-6: Now requires userPrincipal, enforces max limit, defers persistence
 *
 * @param initialData - Optional initial data for the draft
 * @param userPrincipal - Required user principal for ownership
 * @param persistImmediately - If false, draft is created but not persisted until meaningful input
 * @returns The created draft or null if at max limit
 */
export function createDraft(
  initialData?: Partial<Omit<ProposalDraft, 'id' | 'createdAt' | 'updatedAt'>>,
  userPrincipal: string = '',
  persistImmediately: boolean = true
): ProposalDraft | null {
  // Check max draft limit
  if ($draftsCount.get() >= MAX_DRAFTS) {
    $saveError.set(`Maximum of ${MAX_DRAFTS} drafts reached. Please delete some drafts.`);
    return null;
  }

  const now = Date.now();
  const draft: ProposalDraft = {
    id: generateId(),
    title: initialData?.title ?? '',
    prompt: initialData?.prompt ?? '',
    scale: initialData?.scale ?? 'medium',
    vertical: initialData?.vertical ?? 'Community',
    thinkTankOutput: initialData?.thinkTankOutput,
    thinkTankRequestId: initialData?.thinkTankRequestId,
    createdAt: now,
    updatedAt: now,
    status: initialData?.status ?? 'drafting',
    editedSections: initialData?.editedSections ?? [],
    currentStep: initialData?.currentStep ?? 0,
    userPrincipal: initialData?.userPrincipal ?? userPrincipal,
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };

  // Set as current draft
  $currentDraftId.set(draft.id);

  // Only persist if requested (for avoiding empty/orphan drafts)
  if (persistImmediately) {
    const drafts = $drafts.get();
    const newDrafts = { ...drafts, [draft.id]: draft };
    if (safeSaveDrafts(newDrafts)) {
      $drafts.set(newDrafts);
      $lastSavedAt.set(now);
    }
  }

  $saveError.set(null);
  return draft;
}

/**
 * Update an existing draft
 *
 * @param id - Draft ID to update
 * @param updates - Partial updates to apply
 * @returns The updated draft or null if not found
 */
export function updateDraft(
  id: string,
  updates: Partial<Omit<ProposalDraft, 'id' | 'createdAt'>>
): ProposalDraft | null {
  const drafts = $drafts.get();
  const existing = drafts[id];

  if (!existing) {
    console.warn(`Draft not found: ${id}`);
    return null;
  }

  $isSaving.set(true);
  $saveError.set(null);

  const updated: ProposalDraft = {
    ...migrateDraftSchema(existing, id),
    ...updates,
    updatedAt: Date.now(),
    schemaVersion: DRAFT_SCHEMA_VERSION,
  };

  // Try to save with quota handling
  const draftsToSave = { ...drafts, [id]: updated };
  const saved = safeSaveDrafts(draftsToSave);

  if (saved) {
    $drafts.set(draftsToSave);
    $lastSavedAt.set(updated.updatedAt);
    $hasPendingChanges.set(false);
  }

  $isSaving.set(false);
  return saved ? updated : null;
}

/**
 * Update draft with debounced save (for auto-save)
 * Story 9-1-6: Now sets pending state and supports flush
 *
 * @param id - Draft ID to update
 * @param updates - Partial updates to apply
 */
export function updateDraftDebounced(
  id: string,
  updates: Partial<Omit<ProposalDraft, 'id' | 'createdAt'>>
): void {
  // Clear existing timer
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  // Store pending updates for flush
  pendingDraftId = id;
  pendingUpdates = pendingUpdates ? { ...pendingUpdates, ...updates } : updates;
  $hasPendingChanges.set(true);

  // Schedule save
  saveDebounceTimer = setTimeout(() => {
    if (pendingDraftId && pendingUpdates) {
      updateDraft(pendingDraftId, pendingUpdates);
      pendingDraftId = null;
      pendingUpdates = null;
    }
    saveDebounceTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Flush any pending debounced save immediately
 * Story 9-1-6: Call this on component unmount to prevent data loss
 */
export function flushPendingSave(): void {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = null;
  }

  if (pendingDraftId && pendingUpdates) {
    updateDraft(pendingDraftId, pendingUpdates);
    pendingDraftId = null;
    pendingUpdates = null;
  }
}

/**
 * Delete a draft
 *
 * @param id - Draft ID to delete
 * @returns true if deleted, false if not found
 */
export function deleteDraft(id: string): boolean {
  const drafts = $drafts.get();

  if (!drafts[id]) {
    return false;
  }

  // Create new object without the deleted draft
  const { [id]: _, ...remaining } = drafts;
  $drafts.set(remaining);

  // Clear current draft if it was the deleted one
  if ($currentDraftId.get() === id) {
    $currentDraftId.set('');
  }

  return true;
}

/**
 * Set the current draft by ID
 *
 * @param id - Draft ID to set as current, or null to clear
 */
export function setCurrentDraft(id: string | null): void {
  $currentDraftId.set(id ?? '');
}

/**
 * Get a draft by ID
 *
 * @param id - Draft ID
 * @returns The draft or null if not found
 */
export function getDraft(id: string): ProposalDraft | null {
  const draft = $drafts.get()[id];
  return draft ? migrateDraftSchema(draft, id) : null;
}

/**
 * Get a draft by ID with ownership check
 * Story 9-1-6: Prevents loading drafts belonging to other users
 *
 * @param id - Draft ID
 * @param userPrincipal - Current user's principal
 * @returns The draft if found and owned by user, null otherwise
 */
export function getDraftForUser(id: string, userPrincipal: string): ProposalDraft | null {
  const draft = getDraft(id);
  if (!draft) return null;

  // Allow if no userPrincipal set (legacy drafts) or if matches current user
  if (!draft.userPrincipal || draft.userPrincipal === userPrincipal) {
    return draft;
  }

  console.warn(`Draft ${id} belongs to another user`);
  return null;
}

/**
 * Get drafts filtered by user principal
 * Story 9-1-6: Returns only drafts belonging to the specified user
 *
 * @param userPrincipal - User's principal ID
 * @returns List of drafts belonging to the user
 */
export function getDraftsForUser(userPrincipal: string): ProposalDraft[] {
  return $draftsList.get().filter(
    (draft) => !draft.userPrincipal || draft.userPrincipal === userPrincipal
  );
}

// ============================================================================
// Section Editing
// ============================================================================

/**
 * Mark a section as manually edited
 *
 * @param draftId - Draft ID
 * @param section - Section that was edited
 */
export function markSectionEdited(draftId: string, section: keyof ThinkTankOutput): void {
  const draft = getDraft(draftId);
  if (!draft) return;

  if (!draft.editedSections.includes(section)) {
    updateDraft(draftId, {
      editedSections: [...draft.editedSections, section],
    });
  }
}

/**
 * Check if a section has been manually edited
 *
 * @param draftId - Draft ID
 * @param section - Section to check
 * @returns true if the section was manually edited
 */
export function isSectionEdited(draftId: string, section: keyof ThinkTankOutput): boolean {
  const draft = getDraft(draftId);
  return draft?.editedSections.includes(section) ?? false;
}

/**
 * Update a specific section of the Think Tank output
 *
 * @param draftId - Draft ID
 * @param section - Section to update
 * @param value - New value for the section
 */
export function updateOutputSection<K extends keyof ThinkTankOutput>(
  draftId: string,
  section: K,
  value: ThinkTankOutput[K]
): void {
  const draft = getDraft(draftId);
  if (!draft || !draft.thinkTankOutput) return;

  updateDraftDebounced(draftId, {
    thinkTankOutput: {
      ...draft.thinkTankOutput,
      [section]: value,
    },
  });

  // Mark as manually edited
  markSectionEdited(draftId, section);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clear all drafts (useful for testing or user action)
 */
export function clearAllDrafts(): void {
  $drafts.set({});
  $currentDraftId.set('');
  $lastSavedAt.set(null);
  $hasPendingChanges.set(false);
  $saveError.set(null);
}

/**
 * Clear save error
 */
export function clearSaveError(): void {
  $saveError.set(null);
}

/**
 * Persist a draft that was created with persistImmediately=false
 * Story 9-1-6: Called after first meaningful input
 */
export function persistDraft(draft: ProposalDraft): boolean {
  if ($draftsCount.get() >= MAX_DRAFTS) {
    $saveError.set(`Maximum of ${MAX_DRAFTS} drafts reached. Please delete some drafts.`);
    return false;
  }

  const drafts = $drafts.get();
  const newDrafts = { ...drafts, [draft.id]: draft };
  if (safeSaveDrafts(newDrafts)) {
    $drafts.set(newDrafts);
    $lastSavedAt.set(Date.now());
    return true;
  }
  return false;
}

// ============================================================================
// Cross-Tab Sync
// ============================================================================

/**
 * Set up cross-tab sync for drafts
 * Story 9-1-6: Listens for storage events from other tabs
 *
 * @returns Cleanup function to remove listener
 */
export function setupDraftsCrossTabSync(): () => void {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === DRAFTS_STORAGE_KEY && e.newValue !== null) {
      try {
        const newDrafts = JSON.parse(e.newValue) as Record<string, Partial<ProposalDraft>>;
        // Migrate and update
        const migrated: Record<string, ProposalDraft> = {};
        for (const [key, draft] of Object.entries(newDrafts)) {
          migrated[key] = migrateDraftSchema(draft, key);
        }
        $drafts.set(migrated);
      } catch (error) {
        console.error('Failed to sync drafts from other tab:', error);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}

// ============================================================================
// Sorting and Filtering
// ============================================================================

/**
 * Sort drafts by the specified criteria
 * Story 9-1-6: Supports sorting by recent or title
 */
export function sortDrafts(drafts: ProposalDraft[], sortBy: DraftSort): ProposalDraft[] {
  return [...drafts].sort((a, b) => {
    if (sortBy === 'title') {
      return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
    }
    // Default: recent (newest first)
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * Filter drafts by search term (matches title)
 * Story 9-1-6: Case-insensitive title search
 */
export function filterDraftsBySearch(drafts: ProposalDraft[], search: string): ProposalDraft[] {
  if (!search.trim()) return drafts;
  const term = search.toLowerCase().trim();
  return drafts.filter(
    (draft) =>
      (draft.title || 'Untitled').toLowerCase().includes(term) ||
      draft.prompt.toLowerCase().includes(term)
  );
}

// ============================================================================
// Export Actions Object
// ============================================================================

export const draftActions = {
  create: createDraft,
  update: updateDraft,
  updateDebounced: updateDraftDebounced,
  flushPending: flushPendingSave,
  delete: deleteDraft,
  setCurrent: setCurrentDraft,
  get: getDraft,
  getForUser: getDraftForUser,
  getDraftsForUser,
  markSectionEdited,
  isSectionEdited,
  updateOutputSection,
  clearAll: clearAllDrafts,
  clearError: clearSaveError,
  persist: persistDraft,
  setupCrossTabSync: setupDraftsCrossTabSync,
  sort: sortDrafts,
  filter: filterDraftsBySearch,
};
