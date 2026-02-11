/**
 * Retry Button Component
 *
 * Button with loading state and attempt counter for retrying failed operations.
 *
 * Story: 9-1-5-error-handling-recovery
 * ACs: 2, 3
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';

// ============================================================================
// Props
// ============================================================================

export interface RetryButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Whether a retry is in progress */
  isLoading?: boolean;
  /** Current attempt number */
  attempt?: number;
  /** Maximum attempts (for display) */
  maxAttempts?: number;
  /** Button label (default: "Try Again") */
  label?: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'text';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
  /** Whether button is disabled */
  disabled?: boolean;
}

// ============================================================================
// Styling Configuration
// ============================================================================

const variantStyles = {
  primary: `
    bg-blue-600 text-white
    hover:bg-blue-700
    focus:ring-blue-500
    disabled:bg-blue-300
  `,
  secondary: `
    bg-white text-gray-700 border border-gray-300
    hover:bg-gray-50
    focus:ring-gray-400
    disabled:bg-gray-100 disabled:text-gray-400
  `,
  text: `
    bg-transparent text-blue-600
    hover:text-blue-700 hover:underline
    focus:ring-blue-500
    disabled:text-gray-400
  `,
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

// ============================================================================
// Component
// ============================================================================

export function RetryButton({
  onClick,
  isLoading = false,
  attempt,
  maxAttempts,
  label = 'Try Again',
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
}: RetryButtonProps): React.ReactElement {
  const showAttemptCounter = attempt !== undefined && maxAttempts !== undefined && attempt > 1;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-md
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      aria-busy={isLoading}
      aria-label={isLoading ? 'Retrying...' : label}
    >
      {/* Icon */}
      <RefreshCw
        className={`
          h-4 w-4
          ${isLoading ? 'animate-spin' : ''}
        `}
        aria-hidden="true"
      />

      {/* Label */}
      <span>{isLoading ? 'Retrying...' : label}</span>

      {/* Attempt counter */}
      {showAttemptCounter && !isLoading && (
        <span className="text-xs opacity-75">
          (Attempt {attempt}/{maxAttempts})
        </span>
      )}
    </button>
  );
}

export default RetryButton;
