'use client';

import { ArrowRight, BarChart3, FileText, Radar, RefreshCcw, AlertTriangle } from 'lucide-react';
import { Button, Card, Metric } from '@/components/ui';
import type { ResearchProjectDetail, ResearchRunSummary } from '@/lib/research';
import { useProjectRuns } from '@/hooks/research/useProjectRuns';
import ProjectActivityFeed from '../activity/ProjectActivityFeed';

interface ProjectOverviewProps {
  project: ResearchProjectDetail;
  onCreateRun: () => void;
  onSelectRun: (runId: string) => void;
}

export default function ProjectOverview({ project, onCreateRun, onSelectRun }: ProjectOverviewProps) {
  const runsQuery = useProjectRuns(project.id);
  const runs: ResearchRunSummary[] = runsQuery.data || [];
  const latestRun = runs[0];
  const completedRuns = runs.filter((r) => r.status === 'completed');
  const failedRuns = runs.filter((r) => r.status === 'failed');
  const processingRuns = runs.filter((r) => r.status === 'queued' || r.status === 'processing');

  const totalKeywords = completedRuns.reduce((sum, r) => sum + (r.targetRows || 0), 0);

  return (
    <div className="min-w-0 space-y-5">
      {/* Health summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="md" className="space-y-1">
          <p className="text-caption text-text-muted">Total runs</p>
          <Metric value={String(runs.length)} />
        </Card>
        <Card padding="md" className="space-y-1">
          <p className="text-caption text-text-muted">Keywords found</p>
          <Metric value={String(totalKeywords)} />
        </Card>
        <Card padding="md" className="space-y-1">
          <p className="text-caption text-text-muted">Completed</p>
          <div className="flex items-center gap-2">
            <span className="text-heading-1 text-success">{completedRuns.length}</span>
            {failedRuns.length > 0 && (
              <span className="text-body-sm text-destructive">{failedRuns.length} failed</span>
            )}
          </div>
        </Card>
        <Card padding="md" className="space-y-1">
          <p className="text-caption text-text-muted">In progress</p>
          <Metric value={String(processingRuns.length)} />
        </Card>
      </div>

      {/* Next actions */}
      <Card padding="lg" className="space-y-4">
        <h3 className="text-heading-2 text-text-primary flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-accent" />
          Next actions
        </h3>
        <div className="flex flex-wrap gap-3">
          {!runs.length ? (
            <Button size="lg" onClick={onCreateRun} icon={<Radar className="h-4 w-4" />}>
              Start first research run
            </Button>
          ) : failedRuns.length > 0 ? (
            <Button size="lg" onClick={() => onSelectRun(failedRuns[0].id)} icon={<RefreshCcw className="h-4 w-4" />}>
              Review failed run
            </Button>
          ) : processingRuns.length > 0 ? (
            <Button size="lg" onClick={() => onSelectRun(processingRuns[0].id)} icon={<BarChart3 className="h-4 w-4" />}>
              View progress
            </Button>
          ) : completedRuns.length > 0 ? (
            <>
              <Button size="lg" onClick={() => onSelectRun(completedRuns[0].id)} icon={<BarChart3 className="h-4 w-4" />}>
                Review latest results
              </Button>
              <Button size="lg" variant="secondary" onClick={onCreateRun} icon={<Radar className="h-4 w-4" />}>
                New run
              </Button>
            </>
          ) : null}
        </div>

        {latestRun && (
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-raised/50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/15 bg-accent/[0.06]">
              {latestRun.status === 'failed' ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : latestRun.status === 'completed' ? (
                <FileText className="h-4 w-4 text-success" />
              ) : (
                <BarChart3 className="h-4 w-4 text-accent" />
              )}
            </div>
            <div>
              <p className="text-body-sm font-semibold text-text-primary">
                Latest run: {latestRun.status}
              </p>
              <p className="text-caption text-text-muted">
                {latestRun.targetRows || 0} keywords · {project.brandName}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => onSelectRun(latestRun.id)}
            >
              Open
            </Button>
          </div>
        )}
      </Card>

      {/* Activity feed */}
      <Card padding="lg" className="space-y-4">
        <h3 className="text-heading-2 text-text-primary">Recent activity</h3>
        <ProjectActivityFeed projectId={project.id} limit={8} />
      </Card>
    </div>
  );
}
