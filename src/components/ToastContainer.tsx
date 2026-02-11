/**
 * Toast Container Component
 *
 * Renders and manages a stack of toast notifications with animations.
 * Should be rendered once at the app root level.
 *
 * Story: 9-1-5-error-handling-recovery
 * AC: 5
 */

import React from 'react';
import { useStore } from '@nanostores/react';
import { $visibleToasts } from '@/stores';
import { Toast } from './Toast';

// ============================================================================
// Props
// ============================================================================

export interface ToastContainerProps {
  /** Position of the toast stack */
  position?:
    | 'top-right'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'bottom-center';
}

// ============================================================================
// Position Styles
// ============================================================================

const positionStyles: Record<NonNullable<ToastContainerProps['position']>, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

// ============================================================================
// Component
// ============================================================================

export function ToastContainer({
  position = 'top-right',
}: ToastContainerProps): React.ReactElement {
  const toasts = useStore($visibleToasts);

  // Always render the container (helps with debugging and ensures stable DOM)
  // Note: Using role="log" allows aria-label while maintaining aria-live behavior
  return (
    <div
      role="log"
      aria-label="Notifications"
      aria-live="polite"
      data-testid="toast-container"
      className={`
        fixed z-[100] flex flex-col gap-3
        ${positionStyles[position]}
        pointer-events-none
      `}
    >
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="pointer-events-auto w-80 max-w-[calc(100vw-2rem)]"
          style={{
            // Stagger animation delay for entrance
            animationDelay: `${index * 50}ms`,
          }}
        >
          <Toast toast={toast} />
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
