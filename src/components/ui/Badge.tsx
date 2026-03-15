import { cn } from '@/lib/utils';

interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

const variantStyles = {
  success: 'border-success/25 bg-success/[0.14] text-success',
  warning: 'border-warning/25 bg-warning/[0.14] text-warning',
  error: 'border-destructive/25 bg-destructive/[0.14] text-destructive',
  info: 'border-accent/25 bg-accent/[0.14] text-accent',
  neutral: 'border-border/80 bg-surface-raised/70 text-text-secondary',
};

export default function Badge({ variant, children, pulse, className = '' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]',
        variantStyles[variant],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', pulse ? 'animate-pulse-dot' : '')} />
      {children}
    </span>
  );
}
