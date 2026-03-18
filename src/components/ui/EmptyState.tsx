import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

function DefaultIcon() {
  return (
    <svg className="w-10 h-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-border/75 bg-surface-overlay/[0.5] px-5 py-10 text-center sm:px-6 sm:py-14', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border/70 bg-surface-raised/80 shadow-elevation-1 sm:h-16 sm:w-16">
        {icon || <DefaultIcon />}
      </div>
      <p className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="secondary" className="mt-5">
          {action.label}
        </Button>
      )}
    </div>
  );
}
