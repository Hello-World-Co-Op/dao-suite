/**
 * PostHog Analytics Utilities
 *
 * Wrapper for PostHog analytics tracking with type safety and convenience methods.
 * Re-exports common tracking patterns for use across the application.
 *
 * Story: 9-1-6-draft-proposal-management (analytics)
 */

/**
 * Type-safe property value types for analytics events
 */
type EventPropertyValue = string | number | boolean | null | undefined | string[];
type EventProperties = Record<string, EventPropertyValue>;

/**
 * Capture a custom analytics event via PostHog
 *
 * @param eventName - Name of the event to track
 * @param properties - Optional properties to attach to the event
 */
export function captureEvent(eventName: string, properties?: EventProperties): void {
  // Log to console in development
  if (import.meta.env.DEV) {
    console.log('[Analytics]', eventName, properties);
  }

  // PostHog capture
  if (typeof window !== 'undefined' && window.posthog) {
    window.posthog.capture(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// Draft Management Events (Story 9-1-6)
// ============================================================================

/**
 * Track when a new draft is created
 */
export function trackDraftCreated(draftId: string): void {
  captureEvent('draft_created', { draft_id: draftId });
}

/**
 * Track when a draft is manually saved
 */
export function trackDraftSaved(draftId: string, step: number): void {
  captureEvent('draft_saved', { draft_id: draftId, step });
}

/**
 * Track when a draft is resumed
 */
export function trackDraftResumed(draftId: string): void {
  captureEvent('draft_resumed', { draft_id: draftId });
}

/**
 * Track when a draft is deleted
 */
export function trackDraftDeleted(draftId: string): void {
  captureEvent('draft_deleted', { draft_id: draftId });
}

/**
 * Track when a draft is submitted for review
 */
export function trackDraftSubmitted(draftId: string): void {
  captureEvent('draft_submitted', { draft_id: draftId });
}

// ============================================================================
// Proposal Creation Events
// ============================================================================

/**
 * Track when Think Tank generation starts
 */
export function trackGenerationStarted(draftId: string, vertical: string, scale: string): void {
  captureEvent('generation_started', { draft_id: draftId, vertical, scale });
}

/**
 * Track when Think Tank generation completes
 */
export function trackGenerationCompleted(draftId: string, duration: number): void {
  captureEvent('generation_completed', { draft_id: draftId, duration_ms: duration });
}

/**
 * Track when Think Tank generation fails
 */
export function trackGenerationFailed(draftId: string, error: string): void {
  captureEvent('generation_failed', { draft_id: draftId, error });
}

/**
 * Track when a proposal section is refined
 */
export function trackSectionRefined(draftId: string, section: string): void {
  captureEvent('section_refined', { draft_id: draftId, section });
}

/**
 * Track when a proposal section is manually edited
 */
export function trackSectionEdited(draftId: string, section: string): void {
  captureEvent('section_edited', { draft_id: draftId, section });
}
