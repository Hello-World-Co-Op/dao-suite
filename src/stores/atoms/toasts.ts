/**
 * Toast Notification State
 *
 * Manages toast notifications across the application using nanostores.
 * Toasts are ephemeral (don't persist across page refresh).
 *
 * Story: 9-1-5-error-handling-recovery
 * AC: 5
 */

import { atom, computed } from 'nanostores';

// ============================================================================
// Types
// ============================================================================

/**
 * Toast notification type/severity
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast action button configuration
 */
export interface ToastAction {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
}

/**
 * Toast notification configuration
 */
export interface Toast {
  /** Unique identifier */
  id: string;
  /** Toast type/severity */
  type: ToastType;
  /** Message to display */
  message: string;
  /** Optional title/heading */
  title?: string;
  /** Duration in ms (0 = no auto-dismiss) */
  duration: number;
  /** Optional action button */
  action?: ToastAction;
  /** Timestamp when toast was created */
  createdAt: number;
}

/**
 * Options for creating a toast
 */
export interface ToastOptions {
  /** Toast type/severity (default: 'info') */
  type?: ToastType;
  /** Optional title/heading */
  title?: string;
  /** Duration in ms (default: 5000, 0 = no auto-dismiss) */
  duration?: number;
  /** Optional action button */
  action?: ToastAction;
}

// ============================================================================
// Configuration
// ============================================================================

/** Default duration for toasts in milliseconds */
export const DEFAULT_TOAST_DURATION = 5000;

/** Maximum number of toasts to show at once */
export const MAX_VISIBLE_TOASTS = 5;

// ============================================================================
// State Atoms
// ============================================================================

/**
 * Main toasts store - array of active toasts
 */
export const $toasts = atom<Toast[]>([]);

/**
 * Computed: Visible toasts (limited to MAX_VISIBLE_TOASTS)
 */
export const $visibleToasts = computed($toasts, (toasts) => {
  // Sort by createdAt descending (newest first) and limit
  return [...toasts]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_VISIBLE_TOASTS);
});

/**
 * Computed: Count of toasts
 */
export const $toastCount = computed($toasts, (toasts) => toasts.length);

// ============================================================================
// Actions
// ============================================================================

/**
 * Generate unique toast ID
 */
function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a toast notification
 * @param message - The message to display
 * @param options - Toast configuration options
 * @returns The toast ID
 */
export function addToast(message: string, options: ToastOptions = {}): string {
  const id = generateToastId();
  const toast: Toast = {
    id,
    message,
    type: options.type || 'info',
    title: options.title,
    duration: options.duration ?? DEFAULT_TOAST_DURATION,
    action: options.action,
    createdAt: Date.now(),
  };

  $toasts.set([...$toasts.get(), toast]);

  // Schedule auto-dismiss if duration > 0
  if (toast.duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, toast.duration);
  }

  return id;
}

/**
 * Remove a toast by ID
 * @param id - Toast ID to remove
 */
export function removeToast(id: string): void {
  $toasts.set($toasts.get().filter((t) => t.id !== id));
}

/**
 * Clear all toasts
 */
export function clearAllToasts(): void {
  $toasts.set([]);
}

/**
 * Update an existing toast
 * @param id - Toast ID to update
 * @param updates - Partial toast properties to update
 */
export function updateToast(id: string, updates: Partial<Omit<Toast, 'id' | 'createdAt'>>): void {
  $toasts.set(
    $toasts.get().map((t) =>
      t.id === id ? { ...t, ...updates } : t
    )
  );
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Show a success toast
 */
export function showSuccess(message: string, options?: Omit<ToastOptions, 'type'>): string {
  return addToast(message, { ...options, type: 'success' });
}

/**
 * Show an error toast
 */
export function showError(message: string, options?: Omit<ToastOptions, 'type'>): string {
  return addToast(message, { ...options, type: 'error' });
}

/**
 * Show a warning toast
 */
export function showWarning(message: string, options?: Omit<ToastOptions, 'type'>): string {
  return addToast(message, { ...options, type: 'warning' });
}

/**
 * Show an info toast
 */
export function showInfo(message: string, options?: Omit<ToastOptions, 'type'>): string {
  return addToast(message, { ...options, type: 'info' });
}

// ============================================================================
// Export Actions Object
// ============================================================================

export const toastActions = {
  add: addToast,
  remove: removeToast,
  clear: clearAllToasts,
  update: updateToast,
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
};
