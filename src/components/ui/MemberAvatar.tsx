/**
 * Member Avatar Component
 *
 * Reusable avatar component for member profiles.
 * Displays an image avatar or a gradient circle with initials.
 *
 * Extracted from MemberDirectory.tsx for reuse in MemberProfile.tsx.
 * Story: BL-023.2 (extraction), originally BL-021.2
 */

import React from 'react';
import { getInitials } from '@/stores';

export interface MemberAvatarProps {
  displayName: string | null;
  avatar?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
};

export function MemberAvatar({
  displayName,
  avatar,
  size = 'md',
}: MemberAvatarProps): React.ReactElement {
  const name = displayName || 'Anonymous Member';

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={`${name}'s avatar`}
        className={`${sizeClasses[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full
        bg-gradient-to-br from-teal-400 to-teal-600
        flex items-center justify-center
        text-white font-medium
      `}
      aria-label={`${name}'s initials`}
    >
      {getInitials(name)}
    </div>
  );
}

export default MemberAvatar;
