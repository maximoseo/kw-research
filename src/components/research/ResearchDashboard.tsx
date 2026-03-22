'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, History, Loader2, Radar, RefreshCcw, Search, TableProperties, Trash2, TrendingUp, UploadCloud } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, EmptyState, Field, Metric, Tabs } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { buildProjectRunPath } from '@/lib/project-context';
import type { ResearchProjectDetail, ResearchRunDetail, ResearchRunSummary } from '@/lib/research';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { createProjectRunFormSchema, type CreateProjectRunFormInput } from '@/lib/validation';
import ResearchProcessTracker from './ResearchProcessTracker';

type CompetitorDiscoveryState = {
  status: 'idle' | 'success' | 'empty' | 'error';
  message?: string;
  metadata?: { methods?: string[]; totalCandidates?: number; [key: string]: unknown };
};

function buildRunsUrl(projectId: string) {
  return `/api/runs?projectId=${encodeURIComponent(projectId)}`;
}

function buildRunUrl(projectId: string, runId: string) {
  return `/api/runs/${runId}?projectId=${encodeURIComponent(projectId)}`;
}

function buildDefaultValues(project: ResearchProjectDetail): CreateProjectRunFormInput {
  return {
    competitorUrls: project.competitorUrls.join('\n'),
    notes: project.notes || '',
    mode: 'fresh',
    targetRows: 220,
  };
}

const statusBadgeMap: Record<ResearchRunSummary['status'], { variant: 'warning' | 'info' | 'success' | 'error'; label: string }> = {
  queued: { variant: 'warning', label: 'Queued' },
  processing: { variant: 'info', label: 'Processing' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'error', label: 'Failed' },
};

/** Trigger a file download without opening a new tab (avoids popup blockers). */
function triggerDownload(runId: string, addToast: (msg: string, type: 'error' | 'success') => void, setDownloading: (v: boolean) => void) {
  setDownloading(true);
  fetch(`/api/runs/${runId}/download`)
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Download failed.');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
      const filename = match ? decodeURIComponent(match[1]) : 'keyword-research.xlsx';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      addToast('Workbook downloaded successfully.', 'success');
    })
    .catch((err) => {
      addToast(err instanceof Error ? err.message : 'Download failed.', 'error');
    })
    .finally(() => setDownloading(false));
}

export default function ResearchDashboard({ project, initialRunId }: { project: ResearchProjectDetail; initialRunId?: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState(initialRunId || null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'logs' | 'summary'>('preview');
  const [isPending, startTransition] = useTransition();
  const [isDiscoveringCompetitors, startCompetitorDiscovery] = useTransition();
  const [isDownloading, setIsDownloading] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [competitorDiscovery, setCompetitorDiscovery] = useState<CompetitorDiscoveryState>({
    status: 'idle',
  });
  const form = useForm<CreateProjectRunFormInput>({
    resolver: zodResolver(createProjectRunFormSchema),
    defaultValues: buildDefaultValues(project),
  });

  const runsQuery = useQuery({
    queryKey: ['runs', project.id],
    queryFn: async () => {
      const response = await fetch(buildRunsUrl(project.id));
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load runs.');
      }
      return payload.runs as ResearchRunSummary[];
    },
    refetchInterval: (query) => {
      const runs = (query.state.data || []) as ResearchRunSummary[];
      return runs.some((run) => run.status === 'queued' || run.status === 'processing') ? 4000 : false;
    },
  });

  const runQuery = useQuery({
    queryKey: ['run', project.id, selectedRunId],
    queryFn: async () => {
      const response = await fetch(buildRunUrl(project.id, selectedRunId!));
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load the run.');
      }
      return payload.run as ResearchRunDetail;
    },
    enabled: Boolean(selectedRunId),
    refetchInterval: (query) => {
      const run = query.state.data as ResearchRunDetail | undefined;
      return run && (run.status === 'queued' || run.status === 'processing') ? 3000 : false;
    },
  });

  useEffect(() => {
    if (!selectedRunId && runsQuery.data?.length) {
      setSelectedRunId(runsQuery.data[0].id);
    }
  }, [runsQuery.data, selectedRunId]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const selectedRun = runQuery.data;

  const [previewPage, setPreviewPage] = useState(0);
  const [previewPageSize, setPreviewPageSize] = useState<number>(50);

  const allRows = useMemo(() => selectedRun?.rows ?? [], [selectedRun?.rows]);
  const totalPages = Math.max(1, Math.ceil(allRows.length / previewPageSize));
  const previewRows = useMemo(
    () => allRows.slice(previewPage * previewPageSize, (previewPage + 1) * previewPageSize),
    [allRows, previewPage, previewPageSize],
  );

  useEffect(() => { setPreviewPage(0); }, [selectedRunId]);
  const formatDateTimeLabel = (value: string | number | Date | null | undefined, fallback = 'Syncing time...') =>
    hasMounted ? formatDateTime(value, fallback) : fallback;
  const formatRelativeLabel = (value: string | number | Date | null | undefined, fallback = 'Syncing...') =>
    hasMounted ? formatRelative(value, fallback) : fallback;

  const handleDownload = useCallback(() => {
    if (!selectedRun?.workbookName) return;
    triggerDownload(selectedRun.id, addToast, setIsDownloading);
  }, [selectedRun?.id, selectedRun?.workbookName, addToast]);

  const handleSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = new FormData();
      payload.set('projectId', project.id);
      payload.set('competitorUrls', values.competitorUrls);
      payload.set('notes', values.notes || '');
      payload.set('mode', values.mode);
      payload.set('targetRows', String(values.targetRows));
      if (uploadedFile) {
        payload.set('existingResearch', uploadedFile);
      }

      const response = await fetch('/api/runs', { method: 'POST', body: payload });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        addToast(result?.error || 'Unable to start the research run.', 'error');
        return;
      }

      addToast('Research run queued successfully.', 'success');
      setSelectedRunId(result.runId);
      setUploadedFile(null);
      setCompetitorDiscovery({ status: 'idle' });
      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['run', project.id, result.runId] });
    });
  });

  const handleAutoFindCompetitors = () => {
    startCompetitorDiscovery(async () => {
      try {
        const values = form.getValues();
        const response = await fetch('/api/competitors/discover', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            homepageUrl: project.homepageUrl,
            aboutUrl: project.aboutUrl,
            sitemapUrl: project.sitemapUrl,
            brandName: project.brandName,
            language: project.language,
            market: project.market,
            competitorUrls: values.competitorUrls,
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          const message = result?.error || 'Unable to discover competitors automatically.';
          setCompetitorDiscovery({ status: 'error', message });
          addToast(message, 'error');
          return;
        }
        const discoveredUrls = (result?.competitors || []).map((competitor: { url: string }) => competitor.url);
        const nextValue = [...new Set([...values.competitorUrls.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean), ...discoveredUrls])].join('\n');
        form.setValue('competitorUrls', nextValue, { shouldDirty: true, shouldValidate: true });
        const discoveryMeta = result?.metadata ?? result?.discoveryMeta ?? undefined;
        setCompetitorDiscovery({
          status: discoveredUrls.length ? 'success' : 'empty',
          message: discoveredUrls.length
            ? `Found ${discoveredUrls.length} competitor${discoveredUrls.length === 1 ? '' : 's'} and added to the list.`
            : 'No strong competitors found. The system tried multiple discovery approaches but couldn\u2019t find relevant competitors for this niche.',
          metadata: discoveryMeta,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to discover competitors automatically.';
        setCompetitorDiscovery({ status: 'error', message });
        addToast(message, 'error');
      }
    });
  };

  const handleDeleteRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      if (selectedRunId === runId) setSelectedRunId(null);
      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
      addToast('Run deleted successfully.', 'success');
    } catch {
      addToast('Failed to delete run.', 'error');
    } finally {
      setDeletingRunId(null);
    }
  };

  return (
    <div className="page-stack">
      {/* ── Hero section ── */}
      <section className="animate-enter grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <Card variant="hero" className="space-y-5">
          <div>
            <p className="eyebrow">Selected workspace</p>
            <h1 className="mt-2 text-heading-1 sm:text-2xl">{project.name}</h1>
            <p className="mt-2 max-w-xl text-body leading-relaxed text-text-secondary">
              This workspace is scoped to {project.brandName}. Every run, log, preview, and export stays attached to this site.
            </p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Metric label="Brand" value={project.brandName} helper={`${project.language} · ${project.market}`} />
            <Metric label="Runs" value={String(project.runCount)} helper={runsQuery.data?.[0] ? `Latest ${formatRelativeLabel(runsQuery.data[0].queuedAt)}` : 'No runs yet'} />
            <Metric label="Sitemap" value="Validated" helper={project.sitemapUrl} />
          </div>
        </Card>
        <Card className="space-y-5">
          <div>
            <p className="eyebrow">Website profile</p>
            <h2 className="mt-2 section-subtitle">Locked profile inputs</h2>
            <p className="mt-1.5 section-copy">Fixed for this workspace. Change them in the project selector if needed.</p>
          </div>
          <div className="space-y-2">
            <InfoRow label="Homepage" value={project.homepageUrl} />
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoRow label="About page" value={project.aboutUrl} />
              <InfoRow label="Sitemap" value={project.sitemapUrl} />
            </div>
            {project.notes ? <InfoRow label="Notes" value={project.notes} multiline /> : null}
          </div>
        </Card>
      </section>

      {/* ── New run + Live run ── */}
      <section id="new-research" className="animate-enter-delayed grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.03fr_0.97fr]">
        <Card className="space-y-5">
          <div className="section-header">
            <div>
              <p className="eyebrow">New run</p>
              <h2 className="section-subtitle mt-2">Launch a research run</h2>
              <p className="section-copy mt-1.5">Update competitors, notes, mode, and output size.</p>
            </div>
            <div className="toolbar-chip flex flex-wrap items-center gap-1.5 max-w-[12rem] sm:max-w-[14rem]">
              <UploadCloud className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="truncate min-w-0 text-caption">{uploadedFile ? uploadedFile.name : 'No workbook'}</span>
            </div>
          </div>
          <form id="new-run-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Mode" error={form.formState.errors.mode?.message}>
                <select className="field-select" {...form.register('mode')}>
                  <option value="fresh">Create completely fresh research</option>
                  <option value="expand">Expand existing research</option>
                </select>
              </Field>
              <Field label="Target rows" error={form.formState.errors.targetRows?.message}>
                <input className="field-input" type="number" min={120} max={320} step={5} {...form.register('targetRows', { valueAsNumber: true })} />
              </Field>
            </div>
            <Field label="Competitor URLs" error={form.formState.errors.competitorUrls?.message as string | undefined} hint="One per line, or auto-discover.">
              <div className="form-section space-y-3">
                <div className="action-row sm:justify-between">
                  <div className="max-w-2xl min-w-0">
                    <p className="text-body font-medium text-text-primary">Auto-discover competitors</p>
                    <p className="mt-0.5 text-body-sm text-text-secondary">Scan your site profile and find relevant competitors.</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Radar className="h-3.5 w-3.5" />}
                    loading={isDiscoveringCompetitors}
                    disabled={isDiscoveringCompetitors}
                    onClick={handleAutoFindCompetitors}
                    className="w-full shrink-0 sm:w-auto"
                  >
                    Find Competitors
                  </Button>
                </div>
                {competitorDiscovery.status === 'success' ? (
                  <Alert variant="success" title="Discovery complete">
                    <p>{competitorDiscovery.message}</p>
                    {competitorDiscovery.metadata?.methods && (
                      <p className="mt-1 text-body-sm text-text-secondary">
                        Methods used: {competitorDiscovery.metadata.methods.join(', ')}
                        {competitorDiscovery.metadata.totalCandidates != null && (
                          <> &middot; {competitorDiscovery.metadata.totalCandidates} candidates evaluated</>
                        )}
                      </p>
                    )}
                  </Alert>
                ) : competitorDiscovery.status === 'empty' ? (
                  <Alert variant="warning" title="No results">
                    {competitorDiscovery.message}
                  </Alert>
                ) : competitorDiscovery.status === 'error' ? (
                  <Alert variant="error" title="Discovery failed">
                    {competitorDiscovery.message}
                  </Alert>
                ) : null}
                <textarea
                  className="field-textarea"
                  placeholder="https://competitor-one.com&#10;https://competitor-two.com"
                  {...form.register('competitorUrls')}
                />
              </div>
            </Field>
            <Field label="Notes / instructions" error={form.formState.errors.notes?.message} hint="Optional.">
              <textarea className="field-textarea" placeholder="Add any research constraints, exclusions, or audience notes" {...form.register('notes')} />
            </Field>
            <Field label="Existing workbook" hint="Upload to seed expansion mode.">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 bg-surface-raised/50 px-4 py-3 text-body text-text-secondary transition-all hover:border-accent/20 hover:bg-surface">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">{uploadedFile ? uploadedFile.name : 'Upload optional workbook'}</p>
                  <p className="mt-0.5 text-caption text-text-muted">.xlsx, .xls, or .csv up to 10 MB</p>
                </div>
                <span className="toolbar-chip shrink-0 border-accent/15 bg-accent/[0.05] text-accent">{uploadedFile ? 'Replace' : 'Choose file'}</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => setUploadedFile(event.target.files?.[0] || null)} />
              </label>
            </Field>
            <div className="action-row border-t border-border/40 pt-4">
              <Button type="submit" size="md" loading={isPending} className="w-full sm:w-auto">
                Run research
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                className="w-full sm:w-auto"
                onClick={() => {
                  form.reset(buildDefaultValues(project));
                  setCompetitorDiscovery({ status: 'idle' });
                  setUploadedFile(null);
                }}
              >
                Reset form
              </Button>
            </div>
          </form>
        </Card>

        <Card className="space-y-5">
          <div className="section-header">
            <div>
              <p className="eyebrow">Live run</p>
              <h2 className="section-subtitle mt-2">Status, logs, preview, and export</h2>
            </div>
            {selectedRun ? (
              <Badge variant={statusBadgeMap[selectedRun.status].variant}>
                {statusBadgeMap[selectedRun.status].label}
              </Badge>
            ) : (
              <Badge variant="neutral">
                No run selected
              </Badge>
            )}
          </div>
          {!selectedRun ? (
            <EmptyState
              icon={<FileSpreadsheet className="h-8 w-8 text-text-muted" />}
              title="No run selected"
              description="Queue a new research run or select from history below."
              action={{
                label: 'Start a run',
                onClick: () => {
                  const newRunSection = document.getElementById('new-run-form');
                  newRunSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                },
              }}
            />
          ) : (
            <div className="space-y-4">
              {/* Success banner */}
              {selectedRun.status === 'completed' && selectedRun.workbookName ? (
                <div className="action-row rounded-lg border border-success/20 bg-success/[0.04] p-4 sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-success/15 bg-success/[0.08]">
                      <CheckCircle2 className="h-4.5 w-4.5 text-success" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-text-primary">Research complete</p>
                      <p className="mt-0.5 text-body-sm text-text-secondary truncate">{selectedRun.rows.length} rows &middot; {selectedRun.workbookName}</p>
                    </div>
                  </div>
                  <Button type="button" variant="primary" size="sm" icon={<Download className="h-3.5 w-3.5" />} loading={isDownloading} onClick={handleDownload} className="w-full shrink-0 sm:w-auto">
                    Download XLSX
                  </Button>
                </div>
              ) : null}

              {/* Failed banner */}
              {selectedRun.status === 'failed' ? (
                <Alert variant="error" title="Run failed">
                  {selectedRun.errorMessage || 'An unexpected error occurred during processing. You can retry this run.'}
                </Alert>
              ) : null}

              <div className="grid gap-2.5 sm:grid-cols-2">
                <Metric label="Brand" value={selectedRun.brandName} helper={`${selectedRun.language} · ${selectedRun.market}`} />
                <Metric label="Queued" value={formatDateTimeLabel(selectedRun.queuedAt)} helper={selectedRun.step || 'Awaiting updates'} />
              </div>
              <ResearchProcessTracker run={selectedRun} />
              <div className="action-row">
                <Button type="button" variant="primary" size="sm" icon={<Download className="h-3.5 w-3.5" />} disabled={!selectedRun.workbookName} loading={isDownloading} onClick={handleDownload} className="w-full sm:w-auto">
                   Download XLSX
                </Button>
                <Button type="button" variant="secondary" size="sm" icon={<RefreshCcw className="h-3.5 w-3.5" />} loading={runQuery.isRefetching} onClick={() => runQuery.refetch()} className="w-full sm:w-auto">
                  Refresh
                </Button>
                {selectedRun.status !== 'processing' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<RefreshCcw className="h-3.5 w-3.5" />}
                    className="w-full sm:w-auto"
                    onClick={async () => {
                      const response = await fetch(`/api/runs/${selectedRun.id}/retry`, { method: 'POST' });
                      if (!response.ok) {
                        addToast('Unable to retry the run.', 'error');
                        return;
                      }
                      addToast('Run queued for retry.', 'success');
                      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
                      await runQuery.refetch();
                    }}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
              <Tabs
                activeTab={activeTab}
                onChange={(value) => setActiveTab(value as typeof activeTab)}
                tabs={[
                  { id: 'preview', label: 'Preview', hasContent: previewRows.length > 0 },
                  { id: 'logs', label: 'Logs', hasContent: Boolean(selectedRun.logs.length) },
                  { id: 'summary', label: 'Summary', hasContent: Boolean(selectedRun.resultSummary) },
                ]}
              />
              {activeTab === 'preview' ? (
                <PreviewTable
                  previewRows={previewRows}
                  rowCount={allRows.length}
                  status={selectedRun.status}
                  currentPage={previewPage}
                  totalPages={totalPages}
                  pageSize={previewPageSize}
                  onPageChange={setPreviewPage}
                  onPageSizeChange={(size) => { setPreviewPageSize(size); setPreviewPage(0); }}
                />
              ) : null}
              {activeTab === 'logs' ? (
                <RunLogs entries={selectedRun.logs} status={selectedRun.status} formatRelativeLabel={formatRelativeLabel} />
              ) : null}
              {activeTab === 'summary' ? (
                selectedRun.synthesisSnapshot ? (
                  <ReportSynthesisView synthesis={selectedRun.synthesisSnapshot} />
                ) : (
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <Metric label="Run status" value={selectedRun.status} helper={selectedRun.step || 'No step reported'} />
                    <Metric label="Workbook" value={selectedRun.workbookName || 'Pending'} helper={selectedRun.completedAt ? `Completed ${formatRelativeLabel(selectedRun.completedAt)}` : 'Not finished yet'} />
                    <Metric label="Rows" value={String(selectedRun.rows.length || 0)} helper="Generated research rows" />
                    <Metric label="Mode" value={selectedRun.mode === 'expand' ? 'Expand existing' : 'Fresh research'} helper={`Target ${selectedRun.targetRows} rows`} />
                  </div>
                )
              ) : null}
            </div>
          )}
        </Card>
      </section>

      {/* ── History ── */}
      <section id="history" className="animate-enter-delayed-2 section-shell space-y-5">
        <div className="section-header">
          <div>
            <p className="eyebrow">Workspace history</p>
            <h2 className="section-subtitle mt-2">Previous research runs</h2>
            <p className="section-copy mt-1.5">Reopen past results, review progress, and download completed workbooks.</p>
          </div>
          <div className="toolbar-chip flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            {runsQuery.data?.length || 0} tracked
          </div>
        </div>
        {!runsQuery.data?.length ? (
          <EmptyState
            icon={<History className="h-8 w-8 text-text-muted" />}
            title="No research runs yet"
            description="Queue your first run above to get started."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {runsQuery.data.map((run) => (
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
                <div className="mt-3 action-row">
                  <Button type="button" variant={selectedRunId === run.id ? 'primary' : 'secondary'} size="sm" className="w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); setSelectedRunId(run.id); }}>
                    {selectedRunId === run.id ? 'Selected' : 'Open in workspace'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCcw className="h-3.5 w-3.5" />}
                    className="w-full sm:w-auto"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const payload = new FormData();
                      payload.set('projectId', project.id);
                      payload.set('competitorUrls', project.competitorUrls.join('\n'));
                      payload.set('notes', project.notes || '');
                      payload.set('mode', 'fresh');
                      payload.set('targetRows', String(run.targetRows));
                      const response = await fetch('/api/runs', { method: 'POST', body: payload });
                      const result = await response.json().catch(() => null);
                      if (!response.ok) {
                        addToast(result?.error || 'Unable to start rerun.', 'error');
                        return;
                      }
                      addToast('Rerun queued successfully.', 'success');
                      setSelectedRunId(result.runId);
                      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
                    }}
                  >
                    Rerun
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); router.push(buildProjectRunPath(project.id, run.id)); }}>
                    Full page
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InfoRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="subtle-surface px-4 py-2.5">
      <p className="eyebrow">{label}</p>
      {multiline ? <p className="mt-1.5 text-body leading-relaxed text-text-secondary break-words">{value}</p> : (
        <a href={value} target="_blank" rel="noreferrer" className="mt-1.5 block truncate text-body text-accent hover:underline" title={value}>
          {value}
        </a>
      )}
    </div>
  );
}

function PreviewTable({
  previewRows,
  rowCount,
  status,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  previewRows: ResearchRunDetail['rows'];
  rowCount: number;
  status: ResearchRunDetail['status'];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}){
  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-raised/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
        <div className="flex items-center gap-2 text-body font-semibold text-text-primary">
          <TableProperties className="h-4 w-4 text-accent" />
          Output preview
        </div>
        <span className="text-caption text-text-muted">
          Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, rowCount)} of {rowCount} rows
        </span>
      </div>
      <div className="max-h-[480px] overflow-x-auto overflow-y-auto">
        {!previewRows.length ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <TableProperties className="h-7 w-7 text-text-muted/40 mb-2" />
            <p className="text-body font-medium text-text-primary">
              {status === 'completed' ? 'No preview rows were stored.' : 'Waiting for results'}
            </p>
            <p className="mt-1 text-caption text-text-muted">
              {status === 'completed' ? '' : 'Preview will appear once the run reaches the generation phase.'}
            </p>
          </div>
        ) : (
          <table className="min-w-full text-left">
            <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
              <tr className="text-text-muted">
                {['Parent Page', 'Pillar', 'Cluster', 'Intent', 'Primary Keyword', 'Volume', 'CPC', 'Keywords'].map((label) => (
                  <th key={label} className="px-3.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {previewRows.map((row, index) => (
                <tr key={`${row.cluster}-${index}`} className={cn('align-top transition-colors hover:bg-accent/[0.02]', index % 2 === 1 && 'bg-surface-inset/30')}>
                  <td className="max-w-[200px] truncate px-3.5 py-2.5 text-body-sm text-text-secondary" title={row.existingParentPage}>
                    {row.existingParentPage}
                  </td>
                  <td className="max-w-[160px] truncate px-3.5 py-2.5 font-medium text-body-sm" title={row.pillar}>
                    {row.pillar}
                  </td>
                  <td className="max-w-[160px] truncate px-3.5 py-2.5 text-body-sm text-text-secondary" title={row.cluster}>
                    {row.cluster}
                  </td>
                  <td className="px-3.5 py-2.5" title={row.intent}>
                    <span className={cn(
                      'inline-block rounded-md px-2 py-0.5 text-caption font-medium',
                      row.intent === 'Informational' && 'bg-info/[0.08] text-info',
                      row.intent === 'Commercial' && 'bg-warning/[0.08] text-warning',
                      row.intent === 'Transactional' && 'bg-success/[0.08] text-success',
                      row.intent === 'Navigational' && 'bg-accent/[0.08] text-accent',
                    )}>
                      {row.intent}
                    </span>
                  </td>
                  <td className="max-w-[160px] truncate px-3.5 py-2.5 font-medium text-body-sm" title={row.primaryKeyword}>
                    {row.primaryKeyword}
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-mono text-body-sm text-text-secondary" title={row.searchVolume != null ? String(row.searchVolume) : 'N/A'}>
                    {row.searchVolume != null ? row.searchVolume.toLocaleString() : '—'}
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-mono text-body-sm text-text-secondary" title={row.cpc != null ? String(row.cpc) : 'N/A'}>
                    {row.cpc != null ? `$${row.cpc.toFixed(2)}` : '—'}
                  </td>
                  <td className="max-w-[200px] truncate px-3.5 py-2.5 text-body-sm text-text-secondary" title={row.keywords.join(', ')}>
                    {row.keywords.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {previewRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-caption text-text-muted">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md border border-border/50 bg-surface-raised px-2 py-1 text-caption text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-caption text-text-muted">
              Page {currentPage + 1} of {totalPages} ({rowCount} rows)
            </span>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RunLogs({
  entries,
  status,
  formatRelativeLabel,
}: {
  entries: ResearchRunDetail['logs'];
  status: ResearchRunDetail['status'];
  formatRelativeLabel: (value: string | number | Date | null | undefined, fallback?: string) => string;
}) {
  if (!entries.length) {
    return (
      <Alert variant="info" title="Waiting for logs">
        Logs will stream here as the worker advances through stages.
      </Alert>
    );
  }

  const lastEntry = entries[entries.length - 1];

  return (
    <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={cn('rounded-lg border border-border/40 bg-surface-raised/60 px-4 py-2.5', entry === lastEntry && status === 'processing' ? 'ring-1 ring-info/20' : null)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-body-sm font-medium text-text-primary">
              {status === 'processing' && entry === lastEntry ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-info" /> : <Search className="h-3.5 w-3.5 shrink-0 text-accent" />}
              <span className="truncate">{entry.message}</span>
            </div>
            <span className="shrink-0 text-caption text-text-muted">{formatRelativeLabel(entry.createdAt)}</span>
          </div>
          <p className="mt-1 eyebrow">{entry.stage}</p>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchRunSummary['status'] | ResearchRunDetail['status'] }) {
  const meta = statusBadgeMap[status];

  return (
    <Badge variant={meta.variant}>
      {meta.label}
    </Badge>
  );
}

type SynthesisSnapshot = Record<string, unknown>;

function ReportSynthesisView({ synthesis }: { synthesis: SynthesisSnapshot }) {
  const executiveSummary = synthesis.executiveSummary as SynthesisSnapshot | undefined;
  const metricsAnalysis = synthesis.metricsAnalysis as SynthesisSnapshot | undefined;
  const mainKeywordsTable = (synthesis.mainKeywordsTable as Array<SynthesisSnapshot> | undefined) ?? [];
  const keyInsights = (synthesis.keyInsights as string[] | undefined) ?? [];
  const contentStrategy = synthesis.contentStrategy as SynthesisSnapshot | undefined;
  const intentDistribution = synthesis.intentDistribution as SynthesisSnapshot | undefined;

  const volumeDist = (metricsAnalysis?.volumeDistribution as SynthesisSnapshot | undefined);
  const highVolumeCount = typeof volumeDist?.high === 'number' ? volumeDist.high : 0;
  const totalVolume = metricsAnalysis?.totalMonthlyVolume as number | undefined;
  const avgCpc = metricsAnalysis?.avgCpc as number | undefined;
  const highestVolKw = metricsAnalysis?.highestVolumeKeyword as string | undefined;
  const highestCpcKw = metricsAnalysis?.highestCpcKeyword as string | undefined;

  return (
    <div className="space-y-4">
      {executiveSummary && (
        <div className="rounded-lg border border-border/50 bg-surface-raised/60 p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-heading-3 text-text-primary">{String(executiveSummary.title ?? 'Keyword Research Report')}</h3>
          </div>
          <p className="text-body text-text-secondary">{String(executiveSummary.subtitle ?? '')}</p>
          <div className="mt-2.5 flex flex-wrap gap-3 text-caption text-text-muted">
            <span>{String(executiveSummary.brandName ?? '')}</span>
            <span>·</span>
            <span>{String(executiveSummary.language ?? '')} · {String(executiveSummary.market ?? '')}</span>
            <span>·</span>
            <span>{String(executiveSummary.pillarCount ?? 0)} pillars</span>
            <span>·</span>
            <span>{String(executiveSummary.clusterCount ?? 0)} clusters</span>
          </div>
        </div>
      )}

      {metricsAnalysis && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {totalVolume != null ? totalVolume.toLocaleString() : '-'}
            </p>
            <p className="mt-1 text-caption text-text-muted">Total Monthly Volume</p>
            {highestVolKw && <p className="mt-1 text-caption text-text-secondary truncate" title={highestVolKw}>Top: {highestVolKw}</p>}
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {avgCpc != null ? `$${avgCpc.toFixed(2)}` : '-'}
            </p>
            <p className="mt-1 text-caption text-text-muted">Average CPC</p>
            {highestCpcKw && <p className="mt-1 text-caption text-text-secondary truncate" title={highestCpcKw}>Top: {highestCpcKw}</p>}
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {highVolumeCount > 0 ? highVolumeCount : '-'}
            </p>
            <p className="mt-1 text-caption text-text-muted">High-Volume Keywords</p>
            <p className="mt-1 text-caption text-text-secondary">&gt;1K monthly searches</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {mainKeywordsTable.length}
            </p>
            <p className="mt-1 text-caption text-text-muted">Tracked Keywords</p>
            <p className="mt-1 text-caption text-text-secondary">with real volume &amp; CPC</p>
          </Card>
        </div>
      )}

      {mainKeywordsTable.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-raised/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2 text-body font-semibold text-text-primary">
              <TableProperties className="h-4 w-4 text-accent" />
              Main Keywords — Volume &amp; CPC
            </div>
            <span className="text-caption text-text-muted">{mainKeywordsTable.length} keywords</span>
          </div>
          <div className="max-h-[400px] overflow-x-auto overflow-y-auto">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
                <tr className="text-text-muted">
                  {['Keyword', 'Volume', 'CPC', 'Intent', 'Pillar', 'Priority'].map((label) => (
                    <th key={label} className="px-3.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {mainKeywordsTable.slice(0, 30).map((row, index) => (
                  <tr key={`${String(row.keyword)}-${index}`} className={cn('align-top transition-colors hover:bg-accent/[0.02]', index % 2 === 1 && 'bg-surface-inset/30')}>
                    <td className="px-3.5 py-2.5 font-medium text-text-primary" title={String(row.keyword ?? '')}>
                      {String(row.keyword ?? '')}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-body-sm text-text-secondary tabular-nums">
                      {row.searchVolume != null ? Number(row.searchVolume).toLocaleString() : '-'}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-body-sm text-text-secondary tabular-nums">
                      {row.cpc != null ? `$${Number(row.cpc).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className={cn(
                        'inline-block rounded-md px-2 py-0.5 text-caption font-medium',
                        String(row.intent) === 'Informational' && 'bg-info/[0.08] text-info',
                        String(row.intent) === 'Commercial' && 'bg-warning/[0.08] text-warning',
                        String(row.intent) === 'Transactional' && 'bg-success/[0.08] text-success',
                        String(row.intent) === 'Navigational' && 'bg-accent/[0.08] text-accent',
                      )}>
                        {String(row.intent ?? '')}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-body-sm text-text-secondary">{String(row.pillar ?? '')}</td>
                    <td className="px-3.5 py-2.5 text-body-sm text-text-secondary">{String(row.priority ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {keyInsights.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-surface-raised/60 p-5">
          <h3 className="text-heading-3 text-text-primary mb-3">Key Insights</h3>
          <ul className="space-y-2">
            {keyInsights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2 text-body text-text-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {contentStrategy && (
        <div className="rounded-lg border border-border/50 bg-surface-raised/60 p-5">
          <h3 className="text-heading-3 text-text-primary mb-3">Content Strategy</h3>
          <p className="text-body text-text-secondary">{String(contentStrategy.overview ?? '')}</p>
        </div>
      )}

      {intentDistribution && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(intentDistribution).map(([intent, count]) => (
            <div key={intent} className="rounded-lg border border-border/50 bg-surface-raised/60 p-3 text-center">
              <p className="text-heading-3 text-accent tabular-nums">{String(count)}</p>
              <p className="mt-0.5 text-caption text-text-muted">{intent}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
