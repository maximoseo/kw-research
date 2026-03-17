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
  complete: 'border-success/25 bg-success/[0.09]',
  current: 'border-info/25 bg-info/[0.09] shadow-[0_16px_38px_-30px_rgba(var(--accent-rgb),0.35)]',
  failed: 'border-destructive/30 bg-destructive/[0.09]',
  upcoming: 'border-border/70 bg-background/35',
};

export default function ResearchProcessTracker({ run }: { run: ResearchRunDetail }) {
  const process = deriveResearchProcess(run);
  const status = statusMeta[run.status];

  return (
    <Card className="pt-4 sm:pt-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">Research progress</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">{process.headline}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{process.helperText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral" className="rounded-full">
            {process.completedCount} / {process.totalSteps} steps complete
          </Badge>
          <Badge variant={status.variant} className="rounded-full">
            {status.title}
          </Badge>
          {run.status === 'processing' ? (
            <Badge variant="info" className="rounded-full">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Active
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-background/70">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              run.status === 'failed'
                ? 'bg-destructive'
                : run.status === 'completed'
                  ? 'bg-success'
                  : 'bg-[linear-gradient(90deg,hsl(var(--accent)),hsl(var(--info)))]',
            )}
            style={{ width: `${process.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {process.steps.map((step) => {
          const Icon = stepIcons[step.id];
          const currentState = step.state as StepState;
          const state = run.status === 'failed' && currentState === 'current' ? 'failed' : currentState;

          return (
            <div
              key={step.id}
              className={cn(
                'rounded-xl border px-4 py-4 overflow-hidden min-w-0 transition-all',
                stepStateStyles[state],
                state === 'current' ? 'ring-1 ring-info/20' : null,
                state === 'upcoming' ? 'hover:border-info/20 hover:bg-info/[0.03]' : null,
                state === 'failed' ? 'hover:shadow-elevation-1' : null,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl border',
                    state === 'complete' && 'border-success/25 bg-success/[0.12] text-success',
                    state === 'current' && 'border-info/20 bg-info/[0.14] text-info',
                    state === 'failed' && 'border-destructive/25 bg-destructive/[0.12] text-destructive',
                    state === 'upcoming' && 'border-border/60 bg-surface-raised/60 text-text-muted',
                  )}
                >
                  {state === 'current' && run.status === 'processing' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Icon className={cn('h-5 w-5', state === 'current' ? 'text-info' : state === 'upcoming' ? 'text-text-muted' : '')} />
                  )}
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                    state === 'complete' && 'border-success/20 bg-success/[0.08] text-success',
                    state === 'current' && 'border-info/20 bg-info/[0.08] text-info',
                    state === 'failed' && 'border-destructive/20 bg-destructive/[0.08] text-destructive',
                    state === 'upcoming' && 'border-border/60 text-text-muted',
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
              <p className="mt-4 text-base font-semibold text-text-primary break-words">{step.label}</p>
              <p className="mt-2 text-sm leading-6 text-text-secondary line-clamp-3">{step.description}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
