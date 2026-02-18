/**
 * NotificationPreferences Component
 *
 * Canister-backed notification preferences UI for dao-suite Settings page.
 * Loads from and saves to oracle-bridge, with localStorage migration support.
 *
 * Story: BL-022.2
 * ACs: 1, 2, 3, 4, 5, 6, 7, 8, 9
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { CategoryToggleRow } from './CategoryToggleRow';
import {
  getNotificationPreferences,
  updateCanisterNotificationPreferences,
  DEFAULT_CANISTER_PREFERENCES,
  type CanisterNotificationPreferences,
  type CanisterNotificationCategories,
} from '@/services/notificationPreferencesService';
import { updateNotificationPreferences as updateLocalStoragePreferences } from '@/stores';

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  proposals: 'New proposals created, proposal updates',
  votes: 'Voting results, voting deadline reminders',
  mentions: 'When someone mentions you in a discussion',
  system: 'Platform announcements, maintenance notices',
  treasury: 'Milestone approvals, fund releases, disputes',
  membership: 'Renewal reminders, membership status changes',
};

const CATEGORY_LABELS: Record<string, string> = {
  proposals: 'Proposals',
  votes: 'Votes',
  mentions: 'Mentions',
  system: 'System',
  treasury: 'Treasury',
  membership: 'Membership',
};

const LOCAL_STORAGE_PREFS_KEY = 'hwdao:notification-preferences-v1';

/** Success toast auto-dismiss time in ms */
const SUCCESS_DISMISS_MS = 3000;

// ============================================================================
// Helpers
// ============================================================================

interface LocalStorageGovernancePrefs {
  enabled: boolean;
  vote_result: boolean;
  new_proposal: boolean;
  voting_ending: boolean;
  hideProposalTitles: boolean;
  schemaVersion: number;
}

function getLocalStorageGovernancePrefs(): LocalStorageGovernancePrefs | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalStorageGovernancePrefs;
  } catch {
    return null;
  }
}

function areCanisterPrefsAllDefault(prefs: CanisterNotificationPreferences): boolean {
  return (
    prefs.email_enabled === true &&
    prefs.push_enabled === true &&
    prefs.in_app_toasts === true &&
    prefs.categories.proposals === true &&
    prefs.categories.votes === true &&
    prefs.categories.mentions === true &&
    prefs.categories.system === true &&
    prefs.categories.treasury === true &&
    prefs.categories.membership === true
  );
}

// ============================================================================
// Toggle Switch (same as existing pattern)
// ============================================================================

interface ToggleSwitchProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}

function ToggleSwitch({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  badge,
}: ToggleSwitchProps): React.ReactElement {
  return (
    <div className={`flex items-start justify-between gap-4 py-3 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex-1">
        <label
          htmlFor={id}
          className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}
        >
          {label}
          {badge}
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
        aria-label={label}
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

export function NotificationPreferences(): React.ReactElement {
  // State
  const [preferences, setPreferences] = useState<CanisterNotificationPreferences>(
    DEFAULT_CANISTER_PREFERENCES
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [migrationBannerVisible, setMigrationBannerVisible] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const prefs = await getNotificationPreferences();
        if (!mounted) return;
        setPreferences(prefs);

        // Check for localStorage migration opportunity
        const localPrefs = getLocalStorageGovernancePrefs();
        if (localPrefs && areCanisterPrefsAllDefault(prefs)) {
          // localStorage has governance prefs and canister is at defaults
          // Check if local prefs differ from defaults
          const localDiffers =
            localPrefs.enabled !== true ||
            localPrefs.vote_result !== true ||
            localPrefs.new_proposal !== true ||
            localPrefs.voting_ending !== true;

          if (localDiffers) {
            setMigrationBannerVisible(true);
          }
        }
      } catch {
        if (!mounted) return;
        // On error, keep defaults — user can still interact with the form
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-dismiss success message
  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  // Handlers
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateCanisterNotificationPreferences(preferences);

      // Sync in_app_toasts to localStorage governance atom (Task 5)
      updateLocalStoragePreferences({ enabled: preferences.in_app_toasts });

      setSaveSuccess(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save preferences';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  const handleMigrateFromLocalStorage = useCallback(async () => {
    const localPrefs = getLocalStorageGovernancePrefs();
    if (!localPrefs) return;

    // Map localStorage governance prefs to canister fields
    const votesEnabled = localPrefs.vote_result || localPrefs.voting_ending;

    const mergedPrefs: CanisterNotificationPreferences = {
      ...preferences,
      in_app_toasts: localPrefs.enabled,
      categories: {
        ...preferences.categories,
        proposals: localPrefs.new_proposal,
        votes: votesEnabled,
      },
    };

    setSaving(true);
    setSaveError(null);

    try {
      await updateCanisterNotificationPreferences(mergedPrefs);
      setPreferences(mergedPrefs);
      setMigrationBannerVisible(false);

      // Sync to localStorage governance atom
      updateLocalStoragePreferences({ enabled: mergedPrefs.in_app_toasts });

      setSaveSuccess(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync preferences';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  // Category toggle handlers
  const handleCategoryEmailChange = useCallback(
    (category: keyof CanisterNotificationCategories) => (value: boolean) => {
      setPreferences((prev) => ({
        ...prev,
        categories: { ...prev.categories, [category]: value },
      }));
    },
    []
  );

  const handleCategoryInAppChange = useCallback(
    (category: keyof CanisterNotificationCategories) => (value: boolean) => {
      setPreferences((prev) => ({
        ...prev,
        categories: { ...prev.categories, [category]: value },
      }));
    },
    []
  );

  // Render
  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" data-testid="loading-spinner" />
        </CardContent>
      </Card>
    );
  }

  const categoryKeys = Object.keys(CATEGORY_LABELS) as Array<
    keyof typeof preferences.categories
  >;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Control which notifications you receive across email and in-app channels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Migration Banner (AC9) */}
        {migrationBannerVisible && (
          <Alert className="bg-blue-50 border-blue-200" data-testid="migration-banner">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <p className="mb-2">
                Sync your existing notification preferences to your account?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleMigrateFromLocalStorage}
                  disabled={saving}
                  data-testid="migration-sync-btn"
                >
                  Sync
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMigrationBannerVisible(false)}
                  data-testid="migration-dismiss-btn"
                >
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Save Error (AC7) */}
        {saveError && (
          <Alert variant="destructive" data-testid="save-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{saveError}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={saving}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Save Success (AC7) */}
        {saveSuccess && (
          <Alert className="bg-green-50 border-green-200" data-testid="save-success">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Preferences saved successfully.
            </AlertDescription>
          </Alert>
        )}

        {/* Master Toggles Section (AC2, AC3, AC4) */}
        <div className="space-y-1 pb-4 border-b border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">General</h4>

          {/* Email master toggle (AC2) */}
          <ToggleSwitch
            id="email-master-toggle"
            label="Email notifications"
            description="Receive notifications via email"
            checked={preferences.email_enabled}
            onChange={(checked) =>
              setPreferences((prev) => ({ ...prev, email_enabled: checked }))
            }
          />

          {/* In-app toast master toggle (AC3) */}
          <ToggleSwitch
            id="inapp-master-toggle"
            label="In-app toast notifications"
            description="Show toast popup notifications in the app"
            checked={preferences.in_app_toasts}
            onChange={(checked) =>
              setPreferences((prev) => ({ ...prev, in_app_toasts: checked }))
            }
          />

          {/* Push notifications - disabled with "Coming soon" badge (AC4) */}
          <div className="flex items-start justify-between gap-4 py-3 opacity-60">
            <div className="flex-1">
              <label
                htmlFor="push-master-toggle"
                className="text-sm font-medium text-gray-400"
              >
                Push notifications
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                  Coming soon
                </span>
              </label>
              <p className="text-xs mt-0.5 text-gray-300">
                Browser push notifications for urgent updates
              </p>
            </div>
            <button
              id="push-master-toggle"
              type="button"
              role="switch"
              aria-checked={false}
              disabled
              className="relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-gray-200 opacity-50"
              aria-label="Push notifications coming soon"
              data-testid="push-master-toggle"
            >
              <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow translate-x-0" />
            </button>
          </div>
        </div>

        {/* Per-Category Toggles Section (AC5, AC8) */}
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Categories</h4>

          {categoryKeys.map((category) => (
            <CategoryToggleRow
              key={category}
              categoryName={CATEGORY_LABELS[category]}
              description={CATEGORY_DESCRIPTIONS[category]}
              emailEnabled={preferences.categories[category]}
              inAppEnabled={preferences.categories[category]}
              onEmailChange={handleCategoryEmailChange(category)}
              onInAppChange={handleCategoryInAppChange(category)}
              emailDisabled={!preferences.email_enabled}
            />
          ))}
        </div>

        {/* Save Button (AC7) */}
        <div className="pt-4 border-t border-gray-100">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
            data-testid="save-preferences-btn"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationPreferences;
