import React from 'react';
import { clsx } from 'clsx';

interface GradientProps {
  className?: string;
  variant?: 'emerald' | 'purple' | 'blue';
}

export default function Gradient({ className, variant = 'emerald', absolute = true }: GradientProps & { absolute?: boolean }) {
  const colors = {
    emerald: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
    purple: 'bg-purple-500/10 group-hover:bg-purple-500/20',
    blue: 'bg-blue-500/10 group-hover:bg-blue-500/20',
  };

  return (
    <div 
      className={clsx(
        "blur-[80px] rounded-full transition-colors",
        absolute && "absolute",
        colors[variant],
        className
      )} 
    />
  );
}
