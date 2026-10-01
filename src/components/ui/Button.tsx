'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
}

// 'gold' is the brand-coloured main action; 'primary' is the neutral dark one.
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white border-ink hover:bg-ink/85',
  secondary: 'bg-surface text-ink border-line hover:border-ink/40',
  danger: 'bg-surface text-brand-dark border-brand/40 hover:bg-brand-tint',
  ghost: 'bg-transparent text-muted border-transparent hover:text-ink hover:bg-ink/5',
  gold: 'bg-brand text-white border-brand hover:bg-brand-dark hover:border-brand-dark',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  icon,
  className = '',
  disabled,
  onClick,
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`
        inline-flex items-center justify-center rounded-md border font-medium
        transition-colors cursor-pointer active:translate-y-px
        disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={disabled}
      onClick={onClick}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
