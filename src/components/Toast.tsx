/**
 * Toast Notification Component
 *
 * Individual toast notification with support for different types,
 * auto-dismiss, and action buttons.
 *
 * Story: 9-1-5-error-handling-recovery
 * AC: 5
 */

import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { type Toast as ToastType, type ToastType as ToastVariant, removeToast } from '@/stores';

// ============================================================================
// Props
// ============================================================================

export interface ToastProps {
  /** Toast data */
  toast: ToastType;
  /** Optional callback when toast is removed */
  onRemove?: (id: string) => void;
}

// ============================================================================
// Styling Configuration
// ============================================================================

const toastStyles: Record<
  ToastVariant,
  { bg: string; border: string; icon: string; iconBg: string }
> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    iconBg: 'bg-green-100',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    iconBg: 'bg-red-100',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
};

const toastIcons: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

// ============================================================================
// Component
// ============================================================================

export function Toast({ toast, onRemove }: ToastProps): React.ReactElement {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const styles = toastStyles[toast.type];
  const Icon = toastIcons[toast.type];

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    // Wait for animation to complete before removing
    setTimeout(() => {
      removeToast(toast.id);
      onRemove?.(toast.id);
    }, 200);
  }, [toast.id, onRemove]);

  // Progress bar animation for auto-dismiss
  useEffect(() => {
    if (toast.duration <= 0) return;

    const startTime = toast.createdAt;
    const endTime = startTime + toast.duration;

    const updateProgress = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const percent = (remaining / toast.duration) * 100;
      setProgress(percent);

      if (percent > 0) {
        window.requestAnimationFrame(updateProgress);
      }
    };

    const animationId = window.requestAnimationFrame(updateProgress);
    return () => window.cancelAnimationFrame(animationId);
  }, [toast.duration, toast.createdAt]);

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`
        relative overflow-hidden rounded-lg border shadow-lg
        ${styles.bg} ${styles.border}
        transform transition-all duration-200 ease-out
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 rounded-full p-1 ${styles.iconBg}`}>
            <Icon className={`h-5 w-5 ${styles.icon}`} aria-hidden="true" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {toast.title && (
              <h4 className="text-sm font-semibold text-gray-900 mb-1">{toast.title}</h4>
            )}
            <p className="text-sm text-gray-700">{toast.message}</p>

            {/* Action button */}
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick();
                  handleDismiss();
                }}
                className={`
                  mt-2 text-sm font-medium underline
                  hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${styles.icon} focus:ring-current
                `}
              >
                {toast.action.label}
              </button>
            )}
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="
              flex-shrink-0 rounded-md p-1.5
              text-gray-400 hover:text-gray-600
              hover:bg-gray-100/50
              focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
              transition-colors duration-150
            "
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Progress bar for auto-dismiss */}
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200/50">
          <div
            className={`h-full transition-none ${styles.icon.replace('text-', 'bg-')}`}
            style={{ width: `${progress}%` }}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

export default Toast;
