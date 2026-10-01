'use client';

import React from 'react';

type BadgeVariant = 'default' | 'winner' | 'disqualified' | 'redrawn' | 'pending' | 'gold' | 'emerald';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-ink/5 text-muted',
  winner: 'bg-leaf-tint text-leaf',
  disqualified: 'bg-brand-tint text-brand-dark',
  redrawn: 'bg-amber-100 text-amber-800',
  pending: 'bg-ink/5 text-muted',
  gold: 'bg-brand-tint text-brand-dark',
  emerald: 'bg-leaf-tint text-leaf',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
