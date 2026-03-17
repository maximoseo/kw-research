'use client';

import type { ComponentType } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
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
import type { ResearchRunDetail } from '@/lib/research';
import { deriveResearchProcess, type ResearchProcessStepId } from '@/lib/research-progress';
import { cn } from '@/lib/utils';

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

export default function ResearchProcessTracker({ run }: { run: ResearchRunDetail }) {
  const process = deriveResearchProcess(run);

  return (
    <div className="rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,hsl(var(--surface-raised))/0.78,hsl(var(--surface))/0.92)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">Research progress</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">{process.headline}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{process.helperText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="toolbar-chip border-border/60">
            {process.completedCount} / {process.totalSteps} steps complete
          </span>
          {run.status === 'processing' ? (
            <span className="toolbar-chip border-accent/20 bg-accent/[0.08] text-accent">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Active
            </span>
          ) : null}
          {run.status === 'completed' ? (
            <span className="toolbar-chip border-success/20 bg-success/[0.08] text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Workbook ready
            </span>
          ) : null}
          {run.status === 'failed' ? (
            <span className="toolbar-chip border-destructive/20 bg-destructive/[0.08] text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Needs attention
            </span>
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
                  : 'bg-[linear-gradient(90deg,#7c5cff,#60a5fa)]',
            )}
            style={{ width: `${process.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {process.steps.map((step) => {
          const Icon = stepIcons[step.id];

          return (
            <div
              key={step.id}
              className={cn(
                'rounded-[22px] border px-4 py-4 overflow-hidden min-w-0',
                step.state === 'complete' && 'border-success/20 bg-success/[0.08]',
                step.state === 'current' && 'border-accent/25 bg-accent/[0.08] shadow-[0_18px_36px_-28px_rgba(124,92,255,0.7)]',
                step.state === 'failed' && 'border-destructive/25 bg-destructive/[0.08]',
                step.state === 'upcoming' && 'border-border/60 bg-background/35',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl border',
                    step.state === 'complete' && 'border-success/25 bg-success/[0.12] text-success',
                    step.state === 'current' && 'border-accent/20 bg-accent/[0.14] text-accent',
                    step.state === 'failed' && 'border-destructive/20 bg-destructive/[0.12] text-destructive',
                    step.state === 'upcoming' && 'border-border/60 bg-surface-raised/60 text-text-muted',
                  )}
                >
                  <Icon className={cn('h-5 w-5', step.state === 'current' && 'animate-pulse')} />
                </span>
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                    step.state === 'complete' && 'border-success/20 bg-success/[0.08] text-success',
                    step.state === 'current' && 'border-accent/20 bg-accent/[0.08] text-accent',
                    step.state === 'failed' && 'border-destructive/20 bg-destructive/[0.08] text-destructive',
                    step.state === 'upcoming' && 'border-border/60 text-text-muted',
                  )}
                >
                  {step.state === 'complete'
                    ? 'Done'
                    : step.state === 'current'
                      ? 'Current'
                      : step.state === 'failed'
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
    </div>
  );
}
