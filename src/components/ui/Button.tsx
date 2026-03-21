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
    'border-0 bg-gradient-to-b from-accent to-[hsl(254_80%_56%)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.15),0_6px_16px_-3px_rgba(var(--accent-rgb),0.30),inset_0_1px_0_rgba(255,255,255,0.12)] hover:from-accent-hover hover:to-[hsl(254_85%_52%)] hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(0,0,0,0.18),0_10px_24px_-4px_rgba(var(--accent-rgb),0.30),inset_0_1px_0_rgba(255,255,255,0.2)]',
  secondary:
    'border border-border bg-surface text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-accent/30 hover:bg-accent/[0.04] hover:shadow-[0_2px_8px_-2px_rgba(var(--accent-rgb),0.1)]',
  ghost:
    'border border-transparent bg-transparent text-text-secondary hover:border-border/60 hover:bg-surface-raised hover:text-text-primary',
  danger:
    'border border-destructive/25 bg-destructive/[0.06] text-destructive hover:bg-destructive/[0.12] hover:border-destructive/40',
};

const sizeStyles = {
  sm: 'h-9 min-h-[36px] px-3.5 py-1.5 text-[13px]',
  md: 'h-10 min-h-[40px] px-4 py-2 text-sm',
  lg: 'h-11 min-h-[44px] px-5 py-2.5 text-sm',
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
          'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none',
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
