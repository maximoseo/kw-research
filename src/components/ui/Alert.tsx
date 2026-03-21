import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const variantStyles: Record<AlertVariant, string> = {
  success: 'border-success/20 bg-success/[0.06] text-text-primary',
  error: 'border-destructive/20 bg-destructive/[0.06] text-text-primary',
  warning: 'border-warning/20 bg-warning/[0.06] text-text-primary',
  info: 'border-accent/15 bg-accent/[0.04] text-text-primary',
};

const iconStyles: Record<AlertVariant, string> = {
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-accent',
};

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

export default function Alert({
  variant,
  title,
  children,
  className,
}: {
  variant: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icons[variant];

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3.5', variantStyles[variant], className)}>
      <span className={cn('mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md', iconStyles[variant])}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        {title ? <p className="text-body font-semibold text-text-primary">{title}</p> : null}
        <div className={cn('text-body leading-relaxed text-text-secondary', title ? 'mt-0.5' : '')}>{children}</div>
      </div>
    </div>
  );
}
