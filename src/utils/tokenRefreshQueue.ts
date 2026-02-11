/**
 * Token Refresh Queue - Mutex pattern for concurrent refresh prevention
 *
 * FOS-5.6.6: Frontend Token Security
 * Implements a queue/mutex pattern to prevent race conditions when multiple
 * concurrent requests trigger token refresh simultaneously.
 *
 * @see AC-5.6.6.4 - Token refresh uses mutex/queue to prevent race conditions
 * @see FE-FOS-7 (security-audit-frontend-auth.md) - Token refresh race condition
 *
 * Problem:
 * When multiple API calls detect an expired token and all try to refresh
 * simultaneously, we get:
 * - Multiple refresh requests to the server (wasted resources)
 * - Race conditions where one refresh may invalidate another
 * - Potential token desync issues
 *
 * Solution:
 * Queue all refresh requests behind a single promise. The first caller
 * performs the actual refresh, and all subsequent callers receive the
 * same result.
 *
 * @example
 * ```typescript
 * const queue = new TokenRefreshQueue();
 *
 * // Multiple concurrent calls will only trigger ONE actual refresh
 * const [result1, result2] = await Promise.all([
 *   queue.refresh(async () => {
 *     // This only runs once
 *     return await authService.refreshTokens();
 *   }),
 *   queue.refresh(async () => {
 *     // This callback is ignored; returns same result as first
 *     return await authService.refreshTokens();
 *   }),
 * ]);
 *
 * // result1 === result2 (same object reference)
 * ```
 */

export interface RefreshResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Token Refresh Queue with mutex pattern
 *
 * Ensures only one refresh operation runs at a time.
 * All concurrent calls wait for and share the result of the active refresh.
 */
export class TokenRefreshQueue<T = void> {
  /** The currently active refresh promise, if any */
  private refreshPromise: Promise<RefreshResult<T>> | null = null;

  /** Timestamp when the current refresh started */
  private refreshStartedAt: number = 0;

  /** Maximum time a refresh can take before we consider it stale */
  private readonly maxRefreshDuration: number;

  /**
   * Create a new TokenRefreshQueue
   *
   * @param maxRefreshDurationMs - Maximum time (ms) before a refresh is considered stale.
   *                               Default: 10000 (10 seconds). Increase for slow networks.
   */
  constructor(maxRefreshDurationMs: number = 10000) {
    this.maxRefreshDuration = maxRefreshDurationMs;
  }

  /**
   * Request a token refresh
   *
   * If a refresh is already in progress, returns the existing promise.
   * If no refresh is active, starts a new one.
   *
   * @param refreshFn - The actual refresh function to call
   * @returns The result of the refresh operation
   */
  async refresh(refreshFn: () => Promise<T>): Promise<RefreshResult<T>> {
    // Check if there's an active refresh that's not stale
    if (this.refreshPromise) {
      const elapsed = Date.now() - this.refreshStartedAt;
      if (elapsed < this.maxRefreshDuration) {
        // Return existing promise - all callers get the same result
        return this.refreshPromise;
      }
      // Refresh is stale, clear it and start fresh
      console.warn('[TokenRefreshQueue] Previous refresh timed out, starting new one');
      this.refreshPromise = null;
    }

    // Start new refresh
    this.refreshStartedAt = Date.now();
    this.refreshPromise = this.doRefresh(refreshFn);

    try {
      return await this.refreshPromise;
    } finally {
      // Clear the promise after it completes (success or failure)
      // This allows future refreshes to proceed
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual refresh and wrap result
   */
  private async doRefresh(refreshFn: () => Promise<T>): Promise<RefreshResult<T>> {
    try {
      const data = await refreshFn();
      return { success: true, data };
    } catch (error) {
      console.error('[TokenRefreshQueue] Refresh failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Check if a refresh is currently in progress
   */
  isRefreshing(): boolean {
    return this.refreshPromise !== null;
  }

  /**
   * Clear any pending refresh (for testing or logout)
   */
  reset(): void {
    this.refreshPromise = null;
    this.refreshStartedAt = 0;
  }
}

/**
 * Global singleton instance for the auth token refresh queue
 *
 * Use this for the main auth flow to ensure only one refresh
 * happens at a time across the entire application.
 */
export const authRefreshQueue = new TokenRefreshQueue<void>();

/**
 * Wrapper function for refreshing tokens with error handling
 *
 * @deprecated Use `authRefreshQueue.refresh()` directly for mutex protection.
 * This function creates a new queue instance per call, so it does NOT provide
 * mutex protection across different call sites. It's only useful for wrapping
 * a refresh function with error handling.
 *
 * For proper mutex protection, use the singleton:
 * ```typescript
 * import { authRefreshQueue } from './tokenRefreshQueue';
 *
 * // All calls share the same queue - true mutex protection
 * const result = await authRefreshQueue.refresh(() => refreshTokens());
 * ```
 *
 * @param refreshFn - The actual refresh function
 * @returns Result of the refresh operation
 */
export async function refreshWithMutex<T>(
  refreshFn: () => Promise<T>
): Promise<RefreshResult<T>> {
  // NOTE: This creates a new queue per call - no cross-call mutex protection!
  // Use authRefreshQueue singleton for app-wide deduplication.
  const queue = new TokenRefreshQueue<T>();
  return queue.refresh(refreshFn);
}
