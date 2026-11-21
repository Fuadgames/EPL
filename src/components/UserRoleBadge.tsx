import React from 'react';
import {
  Terminal,
  ShieldCheck,
  Shield,
  ShoppingBag,
  BadgeCheck,
  Crown,
} from 'lucide-react';
import { clsx } from 'clsx';
import { UserRole } from '../store/useStore';

interface UserRoleBadgeProps {
  role?: UserRole | string;
  isVerifiedAuthor?: boolean;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export default function UserRoleBadge({
  role,
  isVerifiedAuthor,
  size = 'sm',
  showLabel = false,
  className,
}: UserRoleBadgeProps) {
  const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const badgePadding =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px]'
      : size === 'sm'
      ? 'px-2 py-0.5 text-[11px]'
      : 'px-2.5 py-1 text-xs';

  const baseClass =
    'inline-flex items-center gap-1 rounded font-mono font-semibold uppercase tracking-wider select-none border whitespace-nowrap shrink-0';

  if (!role || role === 'user') {
    if (isVerifiedAuthor) {
      return (
        <span
          title="Verified Creator"
          className={clsx(
            baseClass,
            'bg-sky-500/10 text-sky-500 border-sky-500/30',
            badgePadding,
            className
          )}
        >
          <BadgeCheck className={iconSize} />
          {showLabel && <span>Verified</span>}
        </span>
      );
    }
    return null;
  }

  if (role === 'developer') {
    return (
      <span
        title="Developer"
        className={clsx(
          baseClass,
          'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
          badgePadding,
          className
        )}
      >
        <Terminal className={iconSize} />
        {showLabel && <span>Dev</span>}
      </span>
    );
  }

  if (role === 'admin') {
    return (
      <span
        title="Administrator"
        className={clsx(
          baseClass,
          'bg-red-500/10 text-red-500 border-red-500/30',
          badgePadding,
          className
        )}
      >
        <ShieldCheck className={iconSize} />
        {showLabel && <span>Admin</span>}
      </span>
    );
  }

  if (role === 'moderator') {
    return (
      <span
        title="Moderator"
        className={clsx(
          baseClass,
          'bg-amber-500/10 text-amber-500 border-amber-500/30',
          badgePadding,
          className
        )}
      >
        <Shield className={iconSize} />
        {showLabel && <span>Mod</span>}
      </span>
    );
  }

  if (role === 'shopkeeper') {
    return (
      <span
        title="Shopkeeper"
        className={clsx(
          baseClass,
          'bg-sky-500/10 text-sky-500 border-sky-500/30',
          badgePadding,
          className
        )}
      >
        <ShoppingBag className={iconSize} />
        {showLabel && <span>Shop</span>}
      </span>
    );
  }

  if (role === 'vip' || role === 'premium') {
    return (
      <span
        title="Premium"
        className={clsx(
          baseClass,
          'bg-amber-500/10 text-amber-500 border-amber-500/30',
          badgePadding,
          className
        )}
      >
        <Crown className={iconSize} />
        {showLabel && <span>VIP</span>}
      </span>
    );
  }

  return null;
}
