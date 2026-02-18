/**
 * CategoryToggleRow Component
 *
 * A row for a notification category with email and in-app toggle switches.
 * Used in the NotificationPreferences component.
 *
 * Story: BL-022.2
 * ACs: 5, 8
 */

import React from 'react';

// ============================================================================
// Toggle Switch (extracted from NotificationSettings.tsx pattern)
// ============================================================================

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  title?: string;
  'data-testid'?: string;
}

function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled = false,
  title,
  'data-testid': dataTestId,
  ...props
}: ToggleSwitchProps): React.ReactElement {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={props['aria-label']}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      title={title}
      data-testid={dataTestId}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer
        rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        ${checked ? 'bg-teal-600' : 'bg-gray-200'}
      `}
    >
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block h-5 w-5
          rounded-full bg-white shadow ring-0
          transition duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}

// ============================================================================
// CategoryToggleRow
// ============================================================================

export interface CategoryToggleRowProps {
  /** Optional icon element */
  icon?: React.ReactNode;
  /** Category name for display */
  categoryName: string;
  /** Description text */
  description: string;
  /** Whether email toggle is on */
  emailEnabled: boolean;
  /** Whether in-app toggle is on */
  inAppEnabled: boolean;
  /** Callback when email toggle changes */
  onEmailChange: (v: boolean) => void;
  /** Callback when in-app toggle changes */
  onInAppChange: (v: boolean) => void;
  /** Whether the email toggle should be disabled (master email off) */
  emailDisabled?: boolean;
  /** Whether the in-app toggle should be disabled */
  inAppDisabled?: boolean;
}

export function CategoryToggleRow({
  icon,
  categoryName,
  description,
  emailEnabled,
  inAppEnabled,
  onEmailChange,
  onInAppChange,
  emailDisabled = false,
  inAppDisabled = false,
}: CategoryToggleRowProps): React.ReactElement {
  const categoryKey = categoryName.toLowerCase();

  return (
    <div
      className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-b-0"
      data-testid={`category-row-${categoryKey}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{categoryName}</p>
          <p className="text-xs text-gray-500 truncate">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Email</span>
          <ToggleSwitch
            id={`email-toggle-${categoryKey}`}
            checked={emailEnabled}
            onChange={onEmailChange}
            disabled={emailDisabled}
            aria-label={`Email notifications for ${categoryName}`}
            title={emailDisabled ? 'Email notifications are disabled' : undefined}
            data-testid={`email-toggle-${categoryKey}`}
          />
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider">In-app</span>
          <ToggleSwitch
            id={`inapp-toggle-${categoryKey}`}
            checked={inAppEnabled}
            onChange={onInAppChange}
            disabled={inAppDisabled}
            aria-label={`In-app notifications for ${categoryName}`}
            data-testid={`inapp-toggle-${categoryKey}`}
          />
        </div>
      </div>
    </div>
  );
}

export default CategoryToggleRow;
