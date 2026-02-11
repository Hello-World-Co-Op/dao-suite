/**
 * Centralized Error Handling Service
 *
 * Provides unified error handling, user-friendly messages, retry logic,
 * and analytics integration for the governance dashboard.
 *
 * Story: 9-1-5-error-handling-recovery
 * ACs: 1, 2, 3
 */

import { trackEvent } from '../utils/analytics';

// ============================================================================
// Error Types and Categories
// ============================================================================

/**
 * Error categories for classification and handling
 */
export type ErrorCategory =
  | 'network' // Connection issues (offline, timeout, DNS)
  | 'canister' // ICP canister errors (unavailable, rejected)
  | 'think_tank' // Think Tank API errors
  | 'validation' // User input validation errors
  | 'auth' // Authentication/authorization errors
  | 'unknown'; // Unclassified errors

/**
 * Standardized application error structure
 */
export interface AppError {
  /** Error category for routing and display */
  category: ErrorCategory;
  /** Error code for programmatic handling */
  code: string;
  /** User-friendly message for display */
  message: string;
  /** Technical details for logging (not shown to users) */
  technicalMessage?: string;
  /** Whether this error can be retried */
  retryable: boolean;
  /** Suggested delay before retry in milliseconds */
  retryDelay?: number;
  /** Original error object for debugging */
  originalError?: unknown;
}

/**
 * Retry configuration for operations
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay between retries in ms */
  baseDelay: number;
  /** Maximum delay between retries in ms */
  maxDelay: number;
  /** Backoff multiplier (e.g., 2 for exponential) */
  backoffMultiplier: number;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  attempts: number;
}

// ============================================================================
// Error Messages Mapping
// ============================================================================

/**
 * User-friendly error messages by category and code
 */
export const ERROR_MESSAGES: Record<string, Record<string, string>> = {
  network: {
    OFFLINE: 'You appear to be offline. Please check your internet connection.',
    TIMEOUT: 'The request took too long. Please try again.',
    DNS_ERROR: 'Unable to connect to the server. Please check your connection.',
    FETCH_FAILED: 'Unable to reach the server. Please try again later.',
    DEFAULT: 'A network error occurred. Please check your connection and try again.',
  },
  canister: {
    UNAVAILABLE: 'The governance service is temporarily unavailable. Please try again later.',
    REJECTED: 'Your request was rejected. Please try again.',
    RATE_LIMITED: 'Too many requests. Please wait a moment before trying again.',
    NOT_FOUND: 'The requested resource was not found.',
    UPGRADE_IN_PROGRESS: 'System maintenance in progress. Please try again in a few minutes.',
    DEFAULT: 'A service error occurred. Please try again later.',
  },
  think_tank: {
    RATE_LIMITED: 'Daily limit reached. Try again tomorrow.',
    TIMEOUT: 'AI generation took too long. Please try again.',
    AI_UNAVAILABLE: 'Think Tank service unavailable. Please try again later.',
    INVALID_INPUT: 'Please check your input and try again.',
    DEFAULT: 'An error occurred with the AI service. Please try again.',
  },
  validation: {
    REQUIRED_FIELD: 'Please fill in all required fields.',
    INVALID_FORMAT: 'Please check the format of your input.',
    TOO_SHORT: 'Your input is too short. Please provide more detail.',
    TOO_LONG: 'Your input is too long. Please shorten it.',
    DEFAULT: 'Please check your input and try again.',
  },
  auth: {
    NOT_AUTHENTICATED: 'Please sign in to continue.',
    NOT_MEMBER: 'Membership required to perform this action.',
    SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
    PERMISSION_DENIED: 'You do not have permission to perform this action.',
    DEFAULT: 'Authentication error. Please sign in again.',
  },
  unknown: {
    DEFAULT: 'An unexpected error occurred. Please try again.',
  },
};

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classify an unknown error into an AppError
 */
export function classifyError(error: unknown, context?: string): AppError {
  // Already an AppError
  if (isAppError(error)) {
    return error;
  }

  // Network/fetch errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return createError('network', 'FETCH_FAILED', error);
  }

  // Check for offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return createError('network', 'OFFLINE', error);
  }

  // DOMException for AbortController timeout
  if (error instanceof DOMException && error.name === 'AbortError') {
    return createError('network', 'TIMEOUT', error);
  }

  // Error objects with specific messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network-related errors
    if (message.includes('network') || message.includes('connection')) {
      return createError('network', 'DEFAULT', error);
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return createError('network', 'TIMEOUT', error);
    }

    // Canister-related errors
    if (message.includes('canister') || message.includes('replica')) {
      if (message.includes('rate') || message.includes('limit')) {
        return createError('canister', 'RATE_LIMITED', error);
      }
      if (message.includes('unavailable') || message.includes('unreachable')) {
        return createError('canister', 'UNAVAILABLE', error);
      }
      if (message.includes('reject')) {
        return createError('canister', 'REJECTED', error);
      }
      return createError('canister', 'DEFAULT', error);
    }

    // Auth-related errors
    if (message.includes('unauthorized') || message.includes('401')) {
      return createError('auth', 'NOT_AUTHENTICATED', error);
    }
    if (message.includes('forbidden') || message.includes('403')) {
      return createError('auth', 'PERMISSION_DENIED', error);
    }
    if (message.includes('session') && message.includes('expired')) {
      return createError('auth', 'SESSION_EXPIRED', error);
    }
  }

  // Default to unknown
  return createError('unknown', 'DEFAULT', error, context);
}

/**
 * Type guard for AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'category' in error &&
    'code' in error &&
    'message' in error &&
    'retryable' in error
  );
}

/**
 * Create a standardized AppError
 */
export function createError(
  category: ErrorCategory,
  code: string,
  originalError?: unknown,
  technicalMessage?: string
): AppError {
  const messages = ERROR_MESSAGES[category] || ERROR_MESSAGES.unknown;
  const message = messages[code] || messages.DEFAULT || ERROR_MESSAGES.unknown.DEFAULT;

  const retryable = isRetryableError(category, code);
  const retryDelay = getRetryDelay(category, code);

  return {
    category,
    code,
    message,
    technicalMessage:
      technicalMessage ||
      (originalError instanceof Error ? originalError.message : String(originalError)),
    retryable,
    retryDelay,
    originalError,
  };
}

/**
 * Determine if an error is retryable based on category and code
 */
export function isRetryableError(category: ErrorCategory, code: string): boolean {
  // Non-retryable categories
  if (category === 'validation') return false;
  if (category === 'auth' && code !== 'SESSION_EXPIRED') return false;

  // Non-retryable codes
  const nonRetryableCodes = [
    'RATE_LIMITED', // Wait required
    'NOT_MEMBER', // Requires membership
    'PERMISSION_DENIED', // Requires authorization
    'NOT_FOUND', // Resource doesn't exist
  ];

  return !nonRetryableCodes.includes(code);
}

/**
 * Get suggested retry delay for an error
 */
export function getRetryDelay(category: ErrorCategory, code: string): number {
  // Rate limited - longer delay
  if (code === 'RATE_LIMITED') {
    return 60000; // 1 minute
  }

  // Canister issues - moderate delay
  if (category === 'canister') {
    return 5000; // 5 seconds
  }

  // Network issues - short delay
  if (category === 'network') {
    return 2000; // 2 seconds
  }

  // Default delay
  return 1000;
}

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

/**
 * Calculate delay for a given attempt using exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  // Add jitter (up to 10% variance) to prevent thundering herd
  const jitter = delay * 0.1 * Math.random();
  return Math.min(delay + jitter, config.maxDelay);
}

/**
 * Execute an async operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: AppError | undefined;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      const data = await operation();
      return { success: true, data, attempts: attempt };
    } catch (error) {
      lastError = classifyError(error);

      // Don't retry non-retryable errors
      if (!lastError.retryable) {
        logError(lastError, { attempt, maxAttempts: retryConfig.maxAttempts });
        return { success: false, error: lastError, attempts: attempt };
      }

      // Log retry attempt
      logError(lastError, {
        attempt,
        maxAttempts: retryConfig.maxAttempts,
        willRetry: attempt < retryConfig.maxAttempts,
      });

      // Wait before next attempt (unless this was the last attempt)
      if (attempt < retryConfig.maxAttempts) {
        const delay = calculateBackoffDelay(attempt, retryConfig);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: lastError || createError('unknown', 'DEFAULT'),
    attempts: retryConfig.maxAttempts,
  };
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Error Logging and Analytics
// ============================================================================

/**
 * Log an error to analytics and console
 */
export function logError(error: AppError, context?: Record<string, unknown>): void {
  // Track to PostHog/analytics
  trackEvent('error_occurred', {
    error_category: error.category,
    error_code: error.code,
    error_message: error.message,
    error_retryable: error.retryable,
    page_url: typeof window !== 'undefined' ? window.location.href : undefined,
    ...context,
  });

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('🚨 Error:', {
      category: error.category,
      code: error.code,
      message: error.message,
      technicalMessage: error.technicalMessage,
      retryable: error.retryable,
      ...context,
    });
  }
}

/**
 * Log a retry event
 */
export function logRetry(
  error: AppError,
  attempt: number,
  maxAttempts: number,
  delay: number
): void {
  trackEvent('error_retry', {
    error_category: error.category,
    error_code: error.code,
    attempt,
    max_attempts: maxAttempts,
    delay_ms: delay,
    page_url: typeof window !== 'undefined' ? window.location.href : undefined,
  });

  if (import.meta.env.DEV) {
    console.log(`🔄 Retry attempt ${attempt}/${maxAttempts} in ${delay}ms`, {
      category: error.category,
      code: error.code,
    });
  }
}

/**
 * Log a successful recovery after errors
 */
export function logRecovery(category: ErrorCategory, code: string, attemptsTaken: number): void {
  trackEvent('error_recovered', {
    error_category: category,
    error_code: code,
    attempts_taken: attemptsTaken,
    page_url: typeof window !== 'undefined' ? window.location.href : undefined,
  });

  if (import.meta.env.DEV) {
    console.log(`✅ Recovered from ${category}/${code} after ${attemptsTaken} attempts`);
  }
}

// ============================================================================
// Error Handler Service Export
// ============================================================================

export const errorHandler = {
  classify: classifyError,
  create: createError,
  isAppError,
  isRetryable: isRetryableError,
  getRetryDelay,
  withRetry,
  calculateBackoffDelay,
  log: logError,
  logRetry,
  logRecovery,
  ERROR_MESSAGES,
  DEFAULT_RETRY_CONFIG,
};

export default errorHandler;
