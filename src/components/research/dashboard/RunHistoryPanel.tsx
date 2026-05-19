'use client';

import { History, ArrowLeftRight, RefreshCcw, Trash2, UploadCloud } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Metric } from '@/components/ui';
import { cn } from '@/lib/utils';
import { buildProjectRunPath } from '@/lib/project-context';
import type { ResearchRunSummary } from '@/lib/research';

const statusBadgeMap: Record<ResearchRunSummary['status'], { variant: 'warning' | 'info' | 'success' | 'error'; label: string }> = {
  queued: { variant: 'warning', label: 'Queued' },
  processing: { variant: 'info', label: 'Processing' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'error', label: 'Failed' },
  cancelled: { variant: 'warning', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: ResearchRunSummary['status'] }) {
  const meta = statusBadgeMap[status] ?? { variant: 'info' as const, label: status };

  return (
    <Badge variant={meta.variant}>
      {meta.label}
    </Badge>
  );
}

export interface RunHistoryPanelProps {
  runs: ResearchRunSummary[];
  selectedRunId: string | null;
  setSelectedRunId: (id: string) => void;
  deletingRunId: string | null;
  setDeletingRunId: (id: string | null) => void;
  handleDeleteRun: (runId: string) => void;
  project: { id: string };
  formatDateTimeLabel: (value: string | number | Date | null | undefined, fallback?: string) => string;
  formatRelativeLabel: (value: string | number | Date | null | undefined, fallback?: string) => string;
  router: { push: (path: string) => void };
  addToast: (msg: string, type: 'error' | 'success') => void;
  queryClient: { invalidateQueries: (opts: { queryKey: unknown[] }) => Promise<void> };
  setShowListCompare: (value: boolean) => void;
  setShowBulkImport: (value: boolean) => void;
  onRerunFromHistory: (run: ResearchRunSummary) => Promise<void>;
}

export default function RunHistoryPanel({
  runs,
  selectedRunId,
  setSelectedRunId,
  deletingRunId,
  setDeletingRunId,
  handleDeleteRun,
  project,
  formatDateTimeLabel,
  formatRelativeLabel,
  router,
  addToast,
  queryClient,
  setShowListCompare,
  setShowBulkImport,
  onRerunFromHistory,
}: RunHistoryPanelProps) {
  return (
    <section id="history" className="animate-enter-delayed-2 section-shell space-y-5">
      <div className="section-header">
        <div>
          <p className="eyebrow">Workspace history</p>
          <h2 className="section-subtitle mt-2">Previous research runs</h2>
          <p className="section-copy mt-1.5">Reopen past results, review progress, and download completed workbooks.</p>
        </div>
        <div className="toolbar-chip flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          {runs.length} tracked
        </div>
        <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
          onClick={() => setShowListCompare(true)}
        >
          Compare Lists
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<UploadCloud className="h-3.5 w-3.5" />}
          onClick={() => setShowBulkImport(true)}
        >
          Import Keywords
        </Button>
        </div>
      </div>
      {!runs.length ? (
        <EmptyState
          icon={<History className="h-8 w-8 text-text-muted" />}
          title="No research runs yet"
          description="Queue your first run above to get started."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {runs.map((run) => (
            <article
              key={run.id}
              className={cn(
                'list-card cursor-pointer',
                selectedRunId === run.id
                  ? 'border-accent/30 bg-accent/[0.03] ring-1 ring-accent/12'
                  : 'hover:border-accent/15 hover:-translate-y-px hover:shadow-elevation-2',
              )}
              onClick={() => setSelectedRunId(run.id)}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-heading-3 text-text-primary">{run.projectName}</p>
                  <p className="mt-1 text-caption uppercase tracking-[0.18em] text-text-muted">
                    {run.brandName} · {run.language} · {run.market}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={run.status} />
                  <button
                    type="button"
                    className="rounded p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setDeletingRunId(run.id); }}
                    title="Delete run"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {deletingRunId === run.id && (
                <div className="mt-2 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm" onClick={(e) => e.stopPropagation()}>
                  <span className="flex-1 text-text-secondary">Delete this run?</span>
                  <button type="button" className="text-text-muted hover:text-text-primary" onClick={() => setDeletingRunId(null)}>Cancel</button>
                  <button type="button" className="font-medium text-red-500 hover:text-red-600" onClick={() => handleDeleteRun(run.id)}>Delete</button>
                </div>
              )}
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <Metric label="Queued" value={formatDateTimeLabel(run.queuedAt)} helper={formatRelativeLabel(run.queuedAt)} compact />
                <Metric label="Workbook" value={run.workbookName || 'Pending'} helper={run.errorMessage || run.step || 'No errors'} compact />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <Button type="button" variant={selectedRunId === run.id ? 'primary' : 'secondary'} size="sm" className="w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); setSelectedRunId(run.id); }}>
                    {selectedRunId === run.id ? 'Selected' : 'Open in workspace'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<RefreshCcw className="h-3.5 w-3.5" />}
                    className="w-full sm:w-auto"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await onRerunFromHistory(run);
                    }}
                  >
                    Rerun
                  </Button>
                </div>
                <button
                  type="button"
                  className="text-caption font-medium text-text-muted transition-colors hover:text-accent cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); router.push(buildProjectRunPath(project.id, run.id)); }}
                >
                  Full page view
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
