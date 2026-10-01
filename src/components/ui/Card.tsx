import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-lg border border-line bg-surface p-5 ${className}`}>
      {children}
    </div>
  );
}
