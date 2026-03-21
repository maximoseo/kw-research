'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary:
    'border border-accent/40 bg-accent text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_-2px_rgba(var(--accent-rgb),0.35)] hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(0,0,0,0.12),0_8px_20px_-4px_rgba(var(--accent-rgb),0.4)]',
  secondary:
    'border border-border/70 bg-surface-raised text-text-primary shadow-elevation-1 hover:border-accent/20 hover:bg-surface hover:shadow-elevation-2',
  ghost:
    'border border-border/40 bg-transparent text-text-secondary hover:border-border/70 hover:bg-surface-raised hover:text-text-primary',
  danger:
    'border border-destructive/25 bg-destructive/[0.06] text-destructive shadow-elevation-1 hover:bg-destructive/[0.12]',
};

const sizeStyles = {
  sm: 'min-h-[38px] px-3.5 py-2 text-body-sm',
  md: 'min-h-[42px] px-4.5 py-2.5 text-body',
  lg: 'min-h-[48px] px-6 py-3 text-body',
};

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, disabled, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold tracking-[-0.01em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none',
          sizeStyles[size],
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {loading ? <Spinner /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
