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
    'border border-accent/30 bg-gradient-to-b from-accent to-[hsl(254_85%_58%)] text-white shadow-[0_12px_32px_-8px_rgba(var(--accent-rgb),0.55),0_4px_8px_-2px_rgba(var(--accent-rgb),0.2)] hover:-translate-y-0.5 hover:from-accent-hover hover:to-[hsl(254_90%_54%)] hover:shadow-[0_18px_42px_-8px_rgba(var(--accent-rgb),0.65),0_6px_12px_-2px_rgba(var(--accent-rgb),0.25)]',
  secondary:
    'border border-accent/15 bg-surface-raised/[0.88] text-text-primary shadow-elevation-1 hover:-translate-y-0.5 hover:border-accent/28 hover:bg-surface hover:shadow-[0_8px_20px_-6px_rgba(var(--accent-rgb),0.12)]',
  ghost:
    'border border-transparent bg-transparent text-text-secondary hover:border-accent/12 hover:bg-accent/[0.05] hover:text-text-primary',
  danger:
    'border border-destructive/30 bg-destructive/10 text-destructive shadow-elevation-1 hover:-translate-y-0.5 hover:bg-destructive/15',
};

const sizeStyles = {
  sm: 'min-h-[40px] px-4 py-2 text-[0.8125rem]',
  md: 'min-h-[44px] px-5 py-2.5 text-sm',
  lg: 'min-h-[50px] px-6 py-3 text-[0.95rem]',
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
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none',
          sizeStyles[size],
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        {loading ? <Spinner /> : icon}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
