import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export default function VerifiedBadge({ size = 'sm', className }: VerifiedBadgeProps) {
  const iconSize = size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-4.5 h-4.5' : 'w-5 h-5';
  return (
    <span title="Верифицированный пользователь" className="inline-flex items-center shrink-0">
      <BadgeCheck
        className={clsx(
          "inline-block shrink-0 text-blue-400 fill-blue-500/25 align-middle",
          iconSize,
          className
        )}
      />
    </span>
  );
}
