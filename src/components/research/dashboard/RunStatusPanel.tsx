'use client';

import { Alert, Badge } from '@/components/ui';
import type { ResearchRunSummary } from '@/lib/research';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';

const statusBadgeMap: Record<ResearchRunSummary['status'], { variant: 'warning' | 'info' | 'success' | 'error'; label: string }> = {
  queued: { variant: 'warning', label: 'Queued' },
  processing: { variant: 'info', label: 'Processing' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'error', label: 'Failed' },
  cancelled: { variant: 'warning', label: 'Cancelled' },
};

interface RunStatusPanelProps {
  run: ResearchRunSummary | undefined;
  isLoading: boolean;
  onCancel?: () => void;
  isCancelling?: boolean;
}

export default function RunStatusPanel({ run, isLoading, onCancel, isCancelling }: RunStatusPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-surface p-5 shadow-elevation-1 animate-pulse">
        <div className="h-4 w-32 rounded bg-surface-raised" />
        <div className="mt-3 h-3 w-48 rounded bg-surface-raised" />
      </div>
    );
  }

  if (!run) {
    return (
      <Alert variant="info" title="No active run">
        Select a run from history or create a new research run to see progress.
      </Alert>
    );
  }

  const badge = statusBadgeMap[run.status] || { variant: 'warning' as const, label: run.status };

  return (
    <div className={cn(
      'rounded-xl border p-5 shadow-elevation-1 transition-all',
      run.status === 'processing' ? 'border-accent/25 bg-surface' : 'border-border/60 bg-surface',
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <div>
            <p className="text-body-sm font-semibold text-text-primary">
              {run.status === 'completed' ? 'Research complete' :
               run.status === 'failed' ? 'Run failed' :
               run.status === 'processing' ? 'Research in progress…' :
               run.status === 'queued' ? 'Waiting to start…' :
               'Run cancelled'}
            </p>
            <p className="text-caption text-text-muted">
              Started {formatRelative(run.queuedAt)} · target {run.targetRows} keywords
            </p>
          </div>
        </div>

        {run.status === 'processing' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelling}
            className="rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-1.5 text-body-sm font-medium text-destructive hover:bg-destructive/[0.12] transition-colors disabled:opacity-50"
          >
            {isCancelling ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
      </div>

      {run.status === 'failed' && (
        <div className="mt-3 rounded-lg border border-destructive/15 bg-destructive/[0.04] px-3 py-2">
          <p className="text-body-sm text-destructive">{run.errorMessage || 'An unknown error occurred.'}</p>
        </div>
      )}

      {run.status === 'processing' && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-inset">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-accent" />
        </div>
      )}
    </div>
  );
}
