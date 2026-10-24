import React from 'react';
import { 
  Terminal, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  ShoppingBag, 
  BadgeCheck, 
  Sparkles, 
  Crown, 
  Code2, 
  Zap, 
  Star,
  Flame,
  Award
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
  className
}: UserRoleBadgeProps) {
  const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const subIconSize = size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const badgePadding = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  if (!role || role === 'user') {
    if (isVerifiedAuthor) {
      return (
        <span
          title="Verified Creator & Author"
          className={clsx(
            "inline-flex items-center gap-1 rounded-md font-bold tracking-wide uppercase transition-transform select-none",
            "bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-xs",
            badgePadding,
            className
          )}
        >
          <BadgeCheck className={clsx(iconSize, "text-blue-400 fill-blue-500/20")} />
          <Star className={clsx(subIconSize, "text-cyan-400 fill-cyan-400/30")} />
          {showLabel && <span>Verified</span>}
        </span>
      );
    }
    return null;
  }

  if (role === 'developer') {
    return (
      <span
        title="Developer • Lead System Engineer"
        className={clsx(
          "inline-flex items-center gap-1 rounded-md font-extrabold tracking-wide uppercase transition-all select-none",
          "bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-cyan-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10",
          badgePadding,
          className
        )}
      >
        <Terminal className={clsx(iconSize, "text-purple-400")} />
        <Code2 className={clsx(subIconSize, "text-cyan-400")} />
        <Sparkles className={clsx(subIconSize, "text-amber-300 animate-pulse")} />
        {showLabel && <span className="ml-0.5">Dev</span>}
      </span>
    );
  }

  if (role === 'admin') {
    return (
      <span
        title="Administrator • System Authority"
        className={clsx(
          "inline-flex items-center gap-1 rounded-md font-extrabold tracking-wide uppercase transition-all select-none",
          "bg-gradient-to-r from-red-500/20 via-rose-500/20 to-amber-500/20 text-red-300 border border-red-500/40 shadow-sm shadow-red-500/10",
          badgePadding,
          className
        )}
      >
        <ShieldCheck className={clsx(iconSize, "text-red-400 fill-red-500/20")} />
        <Crown className={clsx(subIconSize, "text-amber-400 fill-amber-400/30")} />
        <Zap className={clsx(subIconSize, "text-orange-400 fill-orange-400/20")} />
        {showLabel && <span className="ml-0.5">Admin</span>}
      </span>
    );
  }

  if (role === 'moderator') {
    return (
      <span
        title="Moderator • Community Guard"
        className={clsx(
          "inline-flex items-center gap-1 rounded-md font-extrabold tracking-wide uppercase transition-all select-none",
          "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10",
          badgePadding,
          className
        )}
      >
        <ShieldAlert className={clsx(iconSize, "text-emerald-400 fill-emerald-500/20")} />
        <Award className={clsx(subIconSize, "text-teal-300")} />
        {showLabel && <span className="ml-0.5">Mod</span>}
      </span>
    );
  }

  if (role === 'shopkeeper') {
    return (
      <span
        title="Shopkeeper • Official Merchant"
        className={clsx(
          "inline-flex items-center gap-1 rounded-md font-bold tracking-wide uppercase transition-all select-none",
          "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/40 shadow-sm",
          badgePadding,
          className
        )}
      >
        <ShoppingBag className={clsx(iconSize, "text-amber-400")} />
        <Sparkles className={clsx(subIconSize, "text-yellow-300")} />
        {showLabel && <span className="ml-0.5">Shop</span>}
      </span>
    );
  }

  if (role === 'vip' || role === 'premium') {
    return (
      <span
        title="VIP Premium Member"
        className={clsx(
          "inline-flex items-center gap-1 rounded-md font-bold tracking-wide uppercase transition-all select-none",
          "bg-gradient-to-r from-amber-500/25 via-yellow-500/25 to-orange-500/25 text-amber-300 border border-amber-400/50 shadow-sm shadow-amber-500/20",
          badgePadding,
          className
        )}
      >
        <Crown className={clsx(iconSize, "text-amber-400 fill-amber-400/30")} />
        <Sparkles className={clsx(subIconSize, "text-amber-300 animate-pulse")} />
        {showLabel && <span className="ml-0.5">VIP</span>}
      </span>
    );
  }

  return null;
}
