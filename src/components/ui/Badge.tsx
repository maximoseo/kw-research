import { cn } from '@/lib/utils';

interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: React.ReactNode;
  pulse?: boolean;
  dot?: boolean;
  className?: string;
}

const variantStyles = {
  success: 'border-success/20 bg-success/[0.08] text-success',
  warning: 'border-warning/20 bg-warning/[0.08] text-warning',
  error: 'border-destructive/20 bg-destructive/[0.08] text-destructive',
  info: 'border-accent/20 bg-accent/[0.06] text-accent',
  neutral: 'border-border/50 bg-surface-raised text-text-muted',
};

export default function Badge({ variant, children, pulse, dot = true, className = '' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold',
        variantStyles[variant],
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full bg-current shrink-0', pulse ? 'animate-pulse-dot' : '')} /> : null}
      {children}
    </span>
  );
}
