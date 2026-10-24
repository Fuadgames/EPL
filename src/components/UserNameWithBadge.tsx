import React from 'react';
import VerifiedBadge from './VerifiedBadge';

interface UserNameWithBadgeProps {
  name: string;
  isVerified?: boolean;
  className?: string;
  badgeSize?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function UserNameWithBadge({ name, isVerified, className, badgeSize = 'sm' }: UserNameWithBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${className || ''}`}>
      {isVerified && <VerifiedBadge size={badgeSize} />}
      <span>{name}</span>
    </span>
  );
}
