import { cn } from '@/lib/utils';

interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: React.ReactNode;
  pulse?: boolean;
  dot?: boolean;
  className?: string;
}

const variantStyles = {
  success: 'border-success/25 bg-success/[0.08] text-success',
  warning: 'border-warning/25 bg-warning/[0.08] text-warning',
  error: 'border-destructive/25 bg-destructive/[0.08] text-destructive',
  info: 'border-accent/25 bg-accent/[0.08] text-accent',
  neutral: 'border-border/60 bg-surface-raised text-text-secondary',
};

export default function Badge({ variant, children, pulse, dot = true, className = '' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        variantStyles[variant],
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full bg-current', pulse ? 'animate-pulse-dot' : '')} /> : null}
      {children}
    </span>
  );
}
