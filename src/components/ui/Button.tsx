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
    'border border-accent/25 bg-accent text-white shadow-[0_12px_28px_-8px_rgba(var(--accent-rgb),0.5)] hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_16px_36px_-8px_rgba(var(--accent-rgb),0.6)]',
  secondary:
    'border border-border/80 bg-surface-raised/[0.84] text-text-primary hover:-translate-y-0.5 hover:border-accent/18 hover:bg-surface',
  ghost:
    'border border-transparent bg-transparent text-text-secondary hover:border-border/70 hover:bg-surface-raised/[0.72] hover:text-text-primary',
  danger:
    'border border-destructive/30 bg-destructive/10 text-destructive hover:-translate-y-0.5 hover:bg-destructive/15',
};

const sizeStyles = {
  sm: 'min-h-[40px] px-3.5 py-2 text-xs',
  md: 'min-h-[44px] px-4.5 py-2.5 text-sm',
  lg: 'min-h-[48px] px-5.5 py-3 text-[0.95rem]',
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
          'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
          sizeStyles[size],
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {loading ? <Spinner /> : icon}
        <span className="truncate">{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
