/**
 * Visibility Settings Component
 *
 * Allows users to control their profile visibility in the member directory.
 * Supports three visibility levels: Public, MembersOnly, and Private.
 * Calls oracle-bridge API to persist visibility setting.
 *
 * Story: 9-3-1-member-directory, BL-021.2
 * AC: 9 - Profile visibility controls wired to real API
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Users, Globe, Lock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  $userVisibility,
  setUserVisibility,
  type Visibility,
  getVisibilityLabel,
  getVisibilityDescription,
} from '@/stores';
import { getOwnVisibility, setOwnVisibility } from '@/services/memberService';
import { useStore } from '@nanostores/react';
import { trackEvent } from '@/utils/analytics';

/**
 * Map oracle-bridge visibility string to local Visibility type.
 */
function toLocalVisibility(apiVisibility: string): Visibility {
  switch (apiVisibility) {
    case 'Public':
      return 'public';
    case 'MembersOnly':
      return 'members-only';
    case 'Private':
      return 'private';
    default:
      return 'private';
  }
}

/**
 * Map local Visibility type to oracle-bridge API string.
 */
function toApiVisibility(local: Visibility): string {
  switch (local) {
    case 'public':
      return 'Public';
    case 'members-only':
      return 'MembersOnly';
    case 'private':
      return 'Private';
    default:
      return 'Private';
  }
}

// Visibility option configuration
const VISIBILITY_OPTIONS: {
  value: Visibility;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}[] = [
  {
    value: 'public',
    icon: Globe,
    colorClass: 'text-green-600',
    bgClass: 'bg-green-50 border-green-200',
  },
  {
    value: 'members-only',
    icon: Users,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50 border-blue-200',
  },
  {
    value: 'private',
    icon: Lock,
    colorClass: 'text-gray-600',
    bgClass: 'bg-gray-50 border-gray-200',
  },
];

export interface VisibilitySettingsProps {
  /** Optional class name for styling */
  className?: string;
  /** User principal for analytics tracking */
  userPrincipal?: string;
}

export function VisibilitySettings({
  className = '',
  userPrincipal,
}: VisibilitySettingsProps): React.ReactElement {
  const currentVisibility = useStore($userVisibility);
  const [selectedVisibility, setSelectedVisibility] = useState<Visibility>(currentVisibility);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingVisibility, setIsLoadingVisibility] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load current visibility from oracle-bridge on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoadingVisibility(true);

    getOwnVisibility()
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.visibility) {
          const localVis = toLocalVisibility(result.visibility);
          setUserVisibility(localVis);
          setSelectedVisibility(localVis);
        }
      })
      .catch(() => {
        // Silently fall back to local state
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVisibility(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync selected with current when current changes
  useEffect(() => {
    setSelectedVisibility(currentVisibility);
  }, [currentVisibility]);

  // Track changes
  useEffect(() => {
    setHasChanges(selectedVisibility !== currentVisibility);
  }, [selectedVisibility, currentVisibility]);

  /**
   * Handle visibility selection
   */
  const handleSelect = useCallback((visibility: Visibility) => {
    setSelectedVisibility(visibility);
    setMessage(null);
  }, []);

  /**
   * Save visibility to oracle-bridge API
   */
  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const apiVisibility = toApiVisibility(selectedVisibility);
      const result = await setOwnVisibility(apiVisibility);

      if (result.success) {
        // Update local state
        setUserVisibility(selectedVisibility);

        // Track analytics
        trackEvent('visibility_settings_changed', {
          previous_visibility: currentVisibility,
          new_visibility: selectedVisibility,
          user_principal: userPrincipal,
        });

        setMessage({
          type: 'success',
          text: `Profile visibility updated to "${getVisibilityLabel(selectedVisibility)}"`,
        });
        setHasChanges(false);
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to update visibility',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessage({
        type: 'error',
        text: `Failed to update visibility: ${errorMessage}`,
      });
    } finally {
      setIsSaving(false);
    }
  }, [hasChanges, selectedVisibility, currentVisibility, userPrincipal]);

  /**
   * Reset to current visibility
   */
  const handleReset = useCallback(() => {
    setSelectedVisibility(currentVisibility);
    setMessage(null);
  }, [currentVisibility]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Profile Visibility
        </CardTitle>
        <CardDescription>Control who can see your profile in the member directory</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Message */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Loading indicator for initial visibility fetch */}
        {isLoadingVisibility && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading current visibility...
          </div>
        )}

        {/* Current Status */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Current Visibility</p>
              <p className="text-sm text-gray-600">{getVisibilityDescription(currentVisibility)}</p>
            </div>
            <div>
              {currentVisibility === 'private' ? (
                <EyeOff className="h-8 w-8 text-gray-400" />
              ) : (
                <Eye className="h-8 w-8 text-green-600" />
              )}
            </div>
          </div>
        </div>

        {/* Visibility Options */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Select visibility level:</p>

          {VISIBILITY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedVisibility === option.value;

            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full p-4 rounded-lg border-2 text-left transition-all
                  ${isSelected ? option.bgClass + ' border-current' : 'bg-white border-gray-200 hover:border-gray-300'}
                `}
                aria-pressed={isSelected}
                aria-label={`Set visibility to ${getVisibilityLabel(option.value)}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${isSelected ? option.colorClass : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <p
                      className={`font-medium ${isSelected ? option.colorClass : 'text-gray-700'}`}
                    >
                      {getVisibilityLabel(option.value)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {getVisibilityDescription(option.value)}
                    </p>
                  </div>
                  {isSelected && <CheckCircle2 className={`h-5 w-5 ${option.colorClass}`} />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex gap-3">
          <Button onClick={handleSave} disabled={!hasChanges || isSaving} className="flex-1">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>

          {hasChanges && (
            <Button variant="outline" onClick={handleReset} disabled={isSaving}>
              Reset
            </Button>
          )}
        </div>

        {/* Preview Note */}
        <p className="text-xs text-gray-500 text-center pt-2">
          Changes take effect immediately after saving. Other members will see your updated
          visibility in the directory.
        </p>
      </CardContent>
    </Card>
  );
}

export default VisibilitySettings;
