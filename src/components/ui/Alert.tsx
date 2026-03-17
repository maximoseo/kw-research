import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const variantStyles: Record<AlertVariant, string> = {
  success: 'border-success/25 bg-success/[0.1] text-text-primary',
  error: 'border-destructive/25 bg-destructive/[0.1] text-text-primary',
  warning: 'border-warning/25 bg-warning/[0.1] text-text-primary',
  info: 'border-info/25 bg-info/[0.08] text-text-primary',
};

const iconStyles: Record<AlertVariant, string> = {
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
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
      <span className={cn('mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-md border border-current/15 bg-current/[0.08]', iconStyles[variant])}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        {title ? <p className="text-sm font-semibold text-text-primary">{title}</p> : null}
        <div className={cn('text-sm leading-6 text-text-secondary', title ? 'mt-0.5' : '')}>{children}</div>
      </div>
    </div>
  );
}
