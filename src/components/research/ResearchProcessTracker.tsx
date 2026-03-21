'use client';

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
} from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import type { ResearchRunDetail } from '@/lib/research';
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

const statusMeta: Record<ResearchRunDetail['status'], { variant: 'info' | 'success' | 'warning' | 'error'; title: string }> = {
  queued: { variant: 'warning', title: 'Queued' },
  processing: { variant: 'info', title: 'In progress' },
  completed: { variant: 'success', title: 'Ready' },
  failed: { variant: 'error', title: 'Needs attention' },
};

const stepStateStyles: Record<StepState, string> = {
  complete: 'border-success/20 bg-success/[0.04]',
  current: 'border-info/20 bg-info/[0.04]',
  failed: 'border-destructive/20 bg-destructive/[0.04]',
  upcoming: 'border-border/40 bg-surface-inset/30',
};

export default function ResearchProcessTracker({ run }: { run: ResearchRunDetail }) {
  const process = deriveResearchProcess(run);
  const status = statusMeta[run.status];

  return (
    <Card className="pt-4 sm:pt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">Research progress</p>
          <h3 className="mt-1.5 text-heading-2 text-text-primary">{process.headline}</h3>
          <p className="mt-1.5 max-w-2xl text-body-sm leading-relaxed text-text-secondary">{process.helperText}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="neutral">
            {process.completedCount} / {process.totalSteps} steps
          </Badge>
          <Badge variant={status.variant}>
            {status.title}
          </Badge>
          {run.status === 'processing' ? (
            <Badge variant="info">
              <Loader2 className="h-3 w-3 animate-spin" />
              Active
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-surface-inset/60">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              run.status === 'failed'
                ? 'bg-destructive'
                : run.status === 'completed'
                  ? 'bg-success'
                  : 'bg-accent',
            )}
            style={{ width: `${process.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {process.steps.map((step) => {
          const Icon = stepIcons[step.id];
          const currentState = step.state as StepState;
          const state = run.status === 'failed' && currentState === 'current' ? 'failed' : currentState;

          return (
            <div
              key={step.id}
              className={cn(
                'rounded-lg border px-3.5 py-3 overflow-hidden min-w-0 transition-all',
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
                  {state === 'current' && run.status === 'processing' ? (
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
              <p className="mt-3 text-body font-semibold text-text-primary leading-snug line-clamp-2">{step.label}</p>
              <p className="mt-1 text-body-sm leading-relaxed text-text-secondary line-clamp-2">{step.description}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
