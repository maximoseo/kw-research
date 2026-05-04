'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import {
  Clock3,
  FileSpreadsheet,
  GitBranchPlus,
  Globe2,
  Loader2,
  Radar,
  Rows4,
  ScanSearch,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import type { ResearchRunDetail, ResearchRunSummary } from '@/lib/research';
import { deriveResearchProcess, type ResearchProcessStepId } from '@/lib/research-progress';
import { cn } from '@/lib/utils';

type StepState = 'complete' | 'current' | 'upcoming' | 'failed';

const stepIcons: Record<ResearchProcessStepId, ComponentType<{ className?: string }>> = {
  queued: Clock3,
  crawl: Globe2,
  analysis: ScanSearch,
  competitors: Radar,
  pillars: Rows4,
  clusters: GitBranchPlus,
  qa: ShieldCheck,
  export: FileSpreadsheet,
};

const statusMeta: Record<ResearchRunDetail['status'] | 'cancelled', { variant: 'info' | 'success' | 'warning' | 'error'; title: string }> = {
  queued: { variant: 'warning', title: 'Queued' },
  processing: { variant: 'info', title: 'In progress' },
  completed: { variant: 'success', title: 'Ready' },
  failed: { variant: 'error', title: 'Needs attention' },
  cancelled: { variant: 'warning', title: 'Cancelled' },
};

const stepStateStyles: Record<StepState, string> = {
  complete: 'border-success/20 bg-success/[0.04]',
  current: 'border-info/20 bg-info/[0.04]',
  failed: 'border-destructive/20 bg-destructive/[0.04]',
  upcoming: 'border-border/40 bg-surface-inset/30',
};

interface LiveProgress {
  progress: number;
  step: string;
  resultCount?: number;
  status: string;
}

export default function ResearchProcessTracker({
  run,
  onCancel,
  isCancelling,
}: {
  run: ResearchRunDetail;
  onCancel?: () => void;
  isCancelling?: boolean;
}) {
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const lastHeartbeatRef = useRef<LiveProgress | null>(null);

  const effectiveRun = {
    ...run,
    step: liveProgress?.step || run.step,
    status: (liveProgress?.status || run.status) as ResearchRunSummary['status'],
  };

  const process = deriveResearchProcess(effectiveRun);
  const status = statusMeta[effectiveRun.status as keyof typeof statusMeta] ?? statusMeta.queued;

  // Display progress: prefer live SSE value, fallback to derivation
  const displayProgress = liveProgress
    ? liveProgress.progress
    : process.progressPercent;

  const isRunning = run.status === 'queued' || run.status === 'processing';

  useEffect(() => {
    if (!isRunning) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      eventSource = new EventSource(`/api/runs/${run.id}/progress`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as LiveProgress;
          lastHeartbeatRef.current = data;
          setLiveProgress(data);

          // If the job finished (completed/failed/cancelled), close SSE
          if (data.status !== 'processing' && data.status !== 'queued') {
            eventSource?.close();
          }
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Reconnect after a short delay
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimer);
    };
  }, [run.id, isRunning]);

  const resultCount = liveProgress?.resultCount ?? run.rows.length;

  return (
    <Card className="pt-4 sm:pt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="eyebrow">Research progress</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="neutral">
                {process.completedCount}/{process.totalSteps}
              </Badge>
              <Badge variant={status.variant}>
                {status.title}
              </Badge>
              {effectiveRun.status === 'processing' ? (
                <Badge variant="info" pulse>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Active
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-body-sm leading-relaxed text-text-secondary">
            {effectiveRun.status === 'processing' && resultCount > 0
              ? `${resultCount} keyword${resultCount === 1 ? '' : 's'} found so far...`
              : process.helperText}
          </p>
        </div>
        {(run.status === 'queued' || run.status === 'processing') && onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<XCircle className="h-3.5 w-3.5" />}
            loading={isCancelling}
            className="shrink-0 text-destructive hover:text-destructive"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-caption text-text-muted">
            {effectiveRun.status === 'processing' ? liveProgress?.step || run.step || 'Processing...' : null}
          </span>
          <span className="text-caption font-mono tabular-nums text-text-muted">
            {displayProgress}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-inset/60">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              effectiveRun.status === 'failed'
                ? 'bg-destructive'
                : effectiveRun.status === 'cancelled'
                  ? 'bg-warning'
                  : effectiveRun.status === 'completed'
                    ? 'bg-success'
                    : 'bg-accent',
            )}
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-4">
        {process.steps.map((step) => {
          const Icon = stepIcons[step.id];
          const currentState = step.state as StepState;
          const state = effectiveRun.status === 'failed' && currentState === 'current' ? 'failed' : currentState;

          return (
            <div
              key={step.id}
              className={cn(
                'rounded-lg border px-3.5 py-3 overflow-hidden min-w-0 min-h-[120px] flex flex-col transition-all',
                stepStateStyles[state],
                state === 'current' ? 'ring-1 ring-info/15' : null,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border',
                    state === 'complete' && 'border-success/20 bg-success/[0.08] text-success',
                    state === 'current' && 'border-info/15 bg-info/[0.08] text-info',
                    state === 'failed' && 'border-destructive/20 bg-destructive/[0.08] text-destructive',
                    state === 'upcoming' && 'border-border/40 bg-surface-raised text-text-muted',
                  )}
                >
                  {state === 'current' && effectiveRun.status === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <span
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]',
                    state === 'complete' && 'border-success/15 bg-success/[0.06] text-success',
                    state === 'current' && 'border-info/15 bg-info/[0.06] text-info',
                    state === 'failed' && 'border-destructive/15 bg-destructive/[0.06] text-destructive',
                    state === 'upcoming' && 'border-border/40 text-text-muted',
                  )}
                >
                  {state === 'complete'
                    ? 'Done'
                    : state === 'current'
                      ? 'Current'
                      : state === 'failed'
                        ? 'Failed'
                        : 'Upcoming'}
                </span>
              </div>
              <p className="mt-2 text-body-sm font-semibold text-text-primary leading-snug line-clamp-2">{step.label}</p>
              <p className="mt-0.5 text-caption leading-relaxed text-text-secondary line-clamp-2">{step.description}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
