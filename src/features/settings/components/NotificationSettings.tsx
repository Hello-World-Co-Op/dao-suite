/**
 * Notification Settings Component
 *
 * Allows users to configure notification preferences for governance events.
 * Persists preferences to localStorage via the notifications state atom.
 *
 * Story: 9-1-7-governance-notifications
 * AC: 4
 */

import React from 'react';
import { useStore } from '@nanostores/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, AlertCircle } from 'lucide-react';
import {
  $notificationPreferences,
  $notificationSaveError,
  updateNotificationPreferences,
  resetNotificationPreferences,
  clearNotificationSaveError,
  type NotificationPreferences,
} from '@/stores';

// ============================================================================
// Toggle Switch Component
// ============================================================================

interface ToggleSwitchProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleSwitchProps): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex-1">
        <label
          htmlFor={id}
          className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}
        >
          {label}
        </label>
        {description && (
          <p className={`text-xs mt-0.5 ${disabled ? 'text-gray-300' : 'text-gray-500'}`}>
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
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
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface NotificationSettingsProps {
  /** Optional className for container */
  className?: string;
}

export function NotificationSettings({
  className = '',
}: NotificationSettingsProps): React.ReactElement {
  const preferences = useStore($notificationPreferences);
  const saveError = useStore($notificationSaveError);

  // Handle master toggle
  const handleMasterToggle = (enabled: boolean) => {
    updateNotificationPreferences({ enabled });
  };

  // Handle individual preference toggles
  const handlePreferenceToggle = (
    key: keyof Omit<NotificationPreferences, 'enabled' | 'hide_titles'>
  ) => {
    return (checked: boolean) => {
      updateNotificationPreferences({ [key]: checked });
    };
  };

  // Handle privacy toggle
  const handlePrivacyToggle = (checked: boolean) => {
    updateNotificationPreferences({ hideProposalTitles: checked });
  };

  // Handle reset to defaults
  const handleReset = () => {
    resetNotificationPreferences();
  };

  // Dismiss error
  const handleDismissError = () => {
    clearNotificationSaveError();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Configure which governance notifications you want to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Alert */}
        {saveError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{saveError}</span>
              <button onClick={handleDismissError} className="text-xs underline hover:no-underline">
                Dismiss
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* Master Toggle */}
        <div className="pb-4 border-b border-gray-100">
          <ToggleSwitch
            id="notifications-enabled"
            label="Enable Notifications"
            description="Turn all governance notifications on or off"
            checked={preferences.enabled}
            onChange={handleMasterToggle}
          />
        </div>

        {/* Individual Notification Types */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Notification Types</h4>

          <ToggleSwitch
            id="vote-results"
            label="Vote Results"
            description="Get notified when proposals you voted on pass or fail"
            checked={preferences.vote_result}
            onChange={handlePreferenceToggle('vote_result')}
            disabled={!preferences.enabled}
          />

          <ToggleSwitch
            id="new-proposals"
            label="New Proposals"
            description="Get notified when new proposals are created"
            checked={preferences.new_proposal}
            onChange={handlePreferenceToggle('new_proposal')}
            disabled={!preferences.enabled}
          />

          <ToggleSwitch
            id="voting-ending"
            label="Voting Deadlines"
            description="Get reminders when voting windows are ending (24h and 1h)"
            checked={preferences.voting_ending}
            onChange={handlePreferenceToggle('voting_ending')}
            disabled={!preferences.enabled}
          />
        </div>

        {/* Privacy Options */}
        <div className="pt-4 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Privacy</h4>

          <ToggleSwitch
            id="hide-titles"
            label="Hide Proposal Titles"
            description="Show generic messages instead of proposal titles in notifications"
            checked={preferences.hideProposalTitles}
            onChange={handlePrivacyToggle}
            disabled={!preferences.enabled}
          />
        </div>

        {/* Reset Button */}
        <div className="pt-4 border-t border-gray-100">
          <button
            onClick={handleReset}
            className="
              text-sm text-gray-500 hover:text-gray-700
              underline hover:no-underline
              focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2
              rounded
            "
          >
            Reset to defaults
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationSettings;
