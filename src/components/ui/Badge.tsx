import { cn } from '@/lib/utils';

interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: React.ReactNode;
  pulse?: boolean;
  dot?: boolean;
  className?: string;
}

const variantStyles = {
  success: 'border-success/30 bg-success/[0.12] text-success shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
  warning: 'border-warning/30 bg-warning/[0.12] text-warning shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
  error: 'border-destructive/30 bg-destructive/[0.12] text-destructive shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
  info: 'border-accent/30 bg-accent/[0.12] text-accent shadow-[0_1px_4px_rgba(var(--accent-rgb),0.08)]',
  neutral: 'border-accent/10 bg-surface-raised/70 text-text-secondary shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
};

export default function Badge({ variant, children, pulse, dot = true, className = '' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]',
        variantStyles[variant],
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full bg-current', pulse ? 'animate-pulse-dot' : '')} /> : null}
      {children}
    </span>
  );
}
