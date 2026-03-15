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
    <svg className="w-12 h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-[28px] border border-dashed border-border/80 bg-surface-overlay/60 px-5 py-16 text-center', className)}>
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-border/70 bg-surface-raised/80 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.3)]">
        {icon || <DefaultIcon />}
      </div>
      <p className="text-lg font-semibold tracking-tight text-text-primary">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="secondary" className="mt-5">
          {action.label}
        </Button>
      )}
    </div>
  );
}
