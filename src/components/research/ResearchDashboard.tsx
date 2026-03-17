'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Download, History, Loader2, Radar, RefreshCcw, Search, TableProperties, UploadCloud } from 'lucide-react';
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

export default function ResearchDashboard({ project, initialRunId }: { project: ResearchProjectDetail; initialRunId?: string | null }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState(initialRunId || null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'logs' | 'summary'>('preview');
  const [isPending, startTransition] = useTransition();
  const [isDiscoveringCompetitors, startCompetitorDiscovery] = useTransition();
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
  const previewRows = useMemo(() => selectedRun?.rows.slice(0, 50) || [], [selectedRun?.rows]);
  const formatDateTimeLabel = (value: string | number | Date | null | undefined, fallback = 'Syncing time...') =>
    hasMounted ? formatDateTime(value, fallback) : fallback;
  const formatRelativeLabel = (value: string | number | Date | null | undefined, fallback = 'Syncing...') =>
    hasMounted ? formatRelative(value, fallback) : fallback;

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
        setCompetitorDiscovery({
          status: discoveredUrls.length ? 'success' : 'empty',
          message: discoveredUrls.length
            ? `Added ${discoveredUrls.length} discovered competitor URLs.`
            : 'No high-confidence competitors were found automatically.',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to discover competitors automatically.';
        setCompetitorDiscovery({ status: 'error', message });
        addToast(message, 'error');
      }
    });
  };

  return (
    <div className="page-stack">
      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <Card variant="hero" className="space-y-5">
          <div>
            <p className="eyebrow">Selected workspace</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
              This workspace is scoped to a single validated site. Every run, log, preview, and export stays attached to {project.brandName}.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Brand" value={project.brandName} helper={`${project.language} · ${project.market}`} />
            <Metric label="Runs tracked" value={String(project.runCount)} helper={runsQuery.data?.[0] ? `Latest ${formatRelativeLabel(runsQuery.data[0].queuedAt)}` : 'No runs yet'} />
            <Metric label="Sitemap" value="Validated" helper={project.sitemapUrl} />
          </div>
        </Card>
        <Card className="space-y-5">
          <div>
            <p className="eyebrow">Website profile</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Locked profile inputs</h2>
            <p className="mt-2 section-copy">These values are fixed for this workspace. Change them in the project selector if needed.</p>
          </div>
          <div className="space-y-3">
            <InfoRow label="Homepage" value={project.homepageUrl} />
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="About page" value={project.aboutUrl} />
              <InfoRow label="Sitemap" value={project.sitemapUrl} />
            </div>
            {project.notes ? <InfoRow label="Notes" value={project.notes} multiline /> : null}
          </div>
        </Card>
      </section>

      <section id="new-research" className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.03fr_0.97fr]">
        <Card className="space-y-6">
          <div className="section-header">
            <div>
              <p className="eyebrow">New run for this site</p>
              <h2 className="section-subtitle mt-2">Launch a project-scoped research run</h2>
              <p className="section-copy mt-2">Update competitors, notes, mode, and output size, then queue a new run.</p>
            </div>
            <div className="toolbar-chip flex flex-wrap items-center gap-2">
              <UploadCloud className="h-3.5 w-3.5 text-text-muted" />
              <span className="truncate max-w-44 sm:max-w-52">{uploadedFile ? uploadedFile.name : 'No workbook uploaded'}</span>
            </div>
          </div>
          <form id="new-run-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
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
            <Field label="Competitor URLs" error={form.formState.errors.competitorUrls?.message as string | undefined} hint="Add one competitor per line or use discovery below. This workspace scope is used for all lookups.">
              <div className="space-y-4 rounded-xl border border-border/70 bg-surface-raised/55 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-sm font-medium text-text-primary">Discovery for this workspace</p>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">Find relevant competitors from your current site profile and add them in one step.</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    icon={<Radar className="h-4 w-4" />}
                    loading={isDiscoveringCompetitors}
                    onClick={handleAutoFindCompetitors}
                    className="w-full sm:w-auto"
                  >
                    Find Competitors
                  </Button>
                </div>
                {competitorDiscovery.status === 'success' ? (
                  <Alert variant="success" title="Discovery complete">
                    {competitorDiscovery.message}
                  </Alert>
                ) : competitorDiscovery.status === 'empty' ? (
                  <Alert variant="warning" title="Discovery did not return results">
                    {competitorDiscovery.message}
                  </Alert>
                ) : competitorDiscovery.status === 'error' ? (
                  <Alert variant="error" title="Discovery issue">
                    {competitorDiscovery.message}
                  </Alert>
                ) : null}
                <textarea
                  className="field-textarea"
                  placeholder="https://competitor-one.com
https://competitor-two.com"
                  {...form.register('competitorUrls')}
                />
              </div>
            </Field>
            <Field label="Notes / instructions" error={form.formState.errors.notes?.message} hint="Optional instructions to influence coverage and output tone.">
              <textarea className="field-textarea" placeholder="Add any research constraints, exclusions, or audience notes" {...form.register('notes')} />
            </Field>
            <Field label="Existing keyword research workbook" hint="Upload to seed expansion mode or provide context for follow-up runs.">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border/80 bg-surface-raised/50 px-4 py-3.5 text-sm text-text-secondary transition-all hover:border-accent/25 hover:bg-surface">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">{uploadedFile ? uploadedFile.name : 'Upload optional workbook'}</p>
                  <p className="mt-1 text-xs text-text-muted">.xlsx, .xls, or .csv up to 10 MB</p>
                </div>
                <span className="toolbar-chip border-accent/20 bg-accent/[0.08] text-accent">{uploadedFile ? 'Replace' : 'Choose file'}</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => setUploadedFile(event.target.files?.[0] || null)} />
              </label>
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg" loading={isPending}>
                Run research
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  form.reset(buildDefaultValues(project));
                  setCompetitorDiscovery({ status: 'idle' });
                  setUploadedFile(null);
                }}
              >
                Reset run form
              </Button>
            </div>
          </form>
        </Card>

        <Card className="space-y-6">
          <div className="section-header">
            <div>
              <p className="eyebrow">Live run</p>
              <h2 className="section-subtitle mt-2">Status, logs, preview, and export</h2>
            </div>
            {selectedRun ? (
              <Badge variant={statusBadgeMap[selectedRun.status].variant} className="rounded-full">
                {statusBadgeMap[selectedRun.status].label}
              </Badge>
            ) : (
              <Badge variant="neutral" className="rounded-full">
                No run selected
              </Badge>
            )}
          </div>
          {!selectedRun ? (
            <EmptyState
              title="No run selected"
              description="Queue a run for this workspace or pick a historical run from this view."
              action={{
                label: 'Start a run',
                onClick: () => {
                  const newRunSection = document.getElementById('new-run-form');
                  newRunSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                },
              }}
            />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Brand" value={selectedRun.brandName} helper={`${selectedRun.language} · ${selectedRun.market}`} />
                <Metric label="Queued" value={formatDateTimeLabel(selectedRun.queuedAt)} helper={selectedRun.step || 'Awaiting updates'} />
              </div>
              <ResearchProcessTracker run={selectedRun} />
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="primary" icon={<Download className="h-4 w-4" />} disabled={!selectedRun.workbookName} onClick={() => window.open(`/api/runs/${selectedRun.id}/download`, '_blank')}>
                  Download XLSX
                </Button>
                <Button type="button" variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} loading={runQuery.isRefetching} onClick={() => runQuery.refetch()}>
                  Refresh status
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  icon={<RefreshCcw className="h-4 w-4" />}
                  disabled={selectedRun.status === 'processing'}
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
                  Retry run
                </Button>
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
                <PreviewTable previewRows={previewRows} rowCount={selectedRun.rows.length} status={selectedRun.status} />
              ) : null}
              {activeTab === 'logs' ? (
                <RunLogs entries={selectedRun.logs} status={selectedRun.status} formatRelativeLabel={formatRelativeLabel} />
              ) : null}
              {activeTab === 'summary' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Metric label="Run status" value={selectedRun.status} helper={selectedRun.step || 'No step reported'} />
                  <Metric label="Workbook" value={selectedRun.workbookName || 'Pending'} helper={selectedRun.completedAt ? `Completed ${formatRelativeLabel(selectedRun.completedAt)}` : 'Not finished yet'} />
                  <Metric label="Rows" value={String(selectedRun.rows.length || 0)} helper="Generated research rows" />
                  <Metric label="Mode" value={selectedRun.mode === 'expand' ? 'Expand existing research' : 'Fresh research'} helper={`Target ${selectedRun.targetRows} rows`} />
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </section>

      <section id="history" className="section-shell space-y-4">
        <div className="section-header">
          <div>
            <p className="eyebrow">Workspace history</p>
            <h2 className="section-subtitle mt-2">Previous research runs for this site</h2>
            <p className="section-copy mt-2">Reopen past results, review progress, and download completed workbooks again.</p>
          </div>
          <div className="toolbar-chip flex items-center gap-2">
            <History className="h-4 w-4" />
            {runsQuery.data?.length || 0} tracked
          </div>
        </div>
        {!runsQuery.data?.length ? (
          <EmptyState title="No research runs yet" description="This website workspace has not queued any research yet." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {runsQuery.data.map((run) => (
              <article
                key={run.id}
                className={cn(
                  'list-card transition-all',
                  selectedRunId === run.id
                    ? 'border-accent/35 bg-accent/[0.06]'
                    : 'hover:border-accent/20 hover:-translate-y-0.5 hover:bg-surface',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tracking-tight text-text-primary">{run.projectName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-text-muted">
                      {run.brandName} · {run.language} · {run.market}
                    </p>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Metric label="Queued" value={formatDateTimeLabel(run.queuedAt)} helper={formatRelativeLabel(run.queuedAt)} compact />
                  <Metric label="Workbook" value={run.workbookName || 'Pending'} helper={run.errorMessage || run.step || 'No errors'} compact />
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button type="button" variant={selectedRunId === run.id ? 'primary' : 'secondary'} size="sm" onClick={() => setSelectedRunId(run.id)}>
                    Open in workspace
                  </Button>
                  <Link href={buildProjectRunPath(project.id, run.id)}>
                    <Button type="button" variant="secondary" size="sm">
                      Dedicated run page
                    </Button>
                  </Link>
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
    <div className="subtle-surface px-4 py-3">
      <p className="eyebrow">{label}</p>
      {multiline ? <p className="mt-2 text-sm leading-6 text-text-secondary break-words">{value}</p> : (
        <a href={value} target="_blank" rel="noreferrer" className="mt-2 block truncate text-sm text-accent hover:underline" title={value}>
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
}: {
  previewRows: ResearchRunDetail['rows'];
  rowCount: number;
  status: ResearchRunDetail['status'];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-surface-raised/55">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <TableProperties className="h-4 w-4 text-accent" />
          Output preview
        </div>
        <span className="text-xs text-text-muted">{rowCount} rows generated</span>
      </div>
      <div className="overflow-x-auto">
        {!previewRows.length ? (
          <p className="px-4 py-8 text-sm text-text-secondary">
            {status === 'completed' ? 'No preview rows were stored.' : 'Preview will appear once the run reaches the generation phase.'}
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border/70 text-text-muted">
                {['Existing Parent Page', 'Pillar', 'Cluster', 'Intent', 'Primary Keyword', 'Keywords'].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium whitespace-nowrap">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={`${row.cluster}-${index}`} className="border-b border-border/50 align-top">
                  <td className="max-w-[220px] px-4 py-3 text-text-secondary" title={row.existingParentPage}>
                    {row.existingParentPage}
                  </td>
                  <td className="max-w-[170px] px-4 py-3" title={row.pillar}>
                    {row.pillar}
                  </td>
                  <td className="max-w-[170px] px-4 py-3" title={row.cluster}>
                    {row.cluster}
                  </td>
                  <td className="max-w-[110px] px-4 py-3" title={row.intent}>
                    {row.intent}
                  </td>
                  <td className="max-w-[170px] px-4 py-3" title={row.primaryKeyword}>
                    {row.primaryKeyword}
                  </td>
                  <td className="max-w-[250px] px-4 py-3 text-text-secondary" title={row.keywords.join(', ')}>
                    {row.keywords.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
      <Alert variant="info" title="Log stream waiting">
        Logs will stream here as the worker advances through crawl, analysis, generation, and export stages.
      </Alert>
    );
  }

  const lastEntry = entries[entries.length - 1];

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={cn('rounded-lg border border-border/70 bg-surface-raised/55 px-4 py-3', entry === lastEntry && status === 'processing' ? 'ring-1 ring-info/30' : null)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary">
              {status === 'processing' && entry === lastEntry ? <Loader2 className="h-4 w-4 animate-spin text-info" /> : <Search className="h-4 w-4 text-accent" />}
              <span className="truncate">{entry.message}</span>
            </div>
            <span className="text-xs text-text-muted">{formatRelativeLabel(entry.createdAt)}</span>
          </div>
          <p className="mt-1.5 eyebrow">{entry.stage}</p>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchRunSummary['status'] | ResearchRunDetail['status'] }) {
  const copy = { queued: 'Queued', processing: 'Processing', completed: 'Completed', failed: 'Failed' }[status];
  const meta = statusBadgeMap[status];

  return (
    <Badge variant={meta.variant} className="rounded-full">
      {copy}
    </Badge>
  );
}

