'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Download, History, Loader2, Radar, RefreshCcw, Search, TableProperties, UploadCloud } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, EmptyState, Tabs } from '@/components/ui';
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

export default function ResearchDashboard({
  project,
  initialRunId,
}: {
  project: ResearchProjectDetail;
  initialRunId?: string | null;
}) {
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
          message: discoveredUrls.length ? `Added ${discoveredUrls.length} discovered competitor URLs.` : 'No high-confidence competitors were found automatically.',
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
      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="rounded-[32px] border-border/70">
          <p className="eyebrow">Selected website workspace</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">{project.brandName} keyword research cockpit</h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary">
            This workspace is now scoped to a single validated website profile. Runs, competitor discovery, logs, and exports stay attached to this site instead of a global dashboard.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Metric label="Workspace" value={project.name} helper={`${project.language} · ${project.market}`} />
            <Metric label="Runs tracked" value={String(project.runCount)} helper={runsQuery.data?.[0] ? `Latest ${formatRelativeLabel(runsQuery.data[0].queuedAt)}` : 'No runs yet'} />
            <Metric label="Sitemap" value="Validated" helper={project.sitemapUrl} />
          </div>
        </Card>
        <Card className="rounded-[32px] border-border/70">
          <p className="eyebrow">Website inputs</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Locked profile data</h2>
          <div className="mt-6 space-y-4 text-sm text-text-secondary">
            <InfoRow label="Homepage" value={project.homepageUrl} />
            <InfoRow label="About page" value={project.aboutUrl} />
            <InfoRow label="Sitemap" value={project.sitemapUrl} />
            {project.notes ? <InfoRow label="Notes" value={project.notes} multiline /> : null}
          </div>
        </Card>
      </section>

      <section id="new-research" className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="rounded-[30px] border-border/70">
          <div className="section-header">
            <div>
              <p className="eyebrow">New run for this site</p>
              <h2 className="section-subtitle mt-3">Launch a project-scoped research run</h2>
              <p className="section-copy mt-3">The site profile is already selected. Adjust competitors, notes, mode, and output size, then queue a new run.</p>
            </div>
            <div className="toolbar-chip">{uploadedFile ? uploadedFile.name : 'No workbook uploaded'}</div>
          </div>
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
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
            <Field label="Competitor URLs" error={form.formState.errors.competitorUrls?.message as string | undefined}>
              <div className="rounded-[24px] border border-border/70 bg-surface-raised/45 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-sm font-medium text-text-primary">Manual list or automatic discovery</p>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">Discovery now runs against the currently selected site profile so it cannot leak results across projects.</p>
                  </div>
                  <Button type="button" variant="secondary" icon={<Radar className="h-4 w-4" />} loading={isDiscoveringCompetitors} onClick={handleAutoFindCompetitors} className="w-full sm:w-auto">
                    Find Competitors Automatically
                  </Button>
                </div>
                {competitorDiscovery.status !== 'idle' ? <p className="mt-4 rounded-[20px] border border-border/70 bg-surface-raised/60 px-4 py-3 text-sm text-text-secondary">{competitorDiscovery.message}</p> : null}
                <textarea className="field-textarea mt-4" placeholder="https://competitor-one.com, https://competitor-two.com" {...form.register('competitorUrls')} />
              </div>
            </Field>
            <Field label="Notes / instructions" error={form.formState.errors.notes?.message}>
              <textarea className="field-textarea" placeholder="Optional guidance for this run" {...form.register('notes')} />
            </Field>
            <Field label="Existing keyword research workbook">
              <label className="flex cursor-pointer items-center justify-between rounded-[24px] border border-dashed border-border/80 bg-surface-raised/50 px-4 py-4 text-sm text-text-secondary transition-all hover:border-accent/25 hover:bg-surface">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-accent/15 bg-accent/[0.08] text-accent">
                    <UploadCloud className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium text-text-primary">{uploadedFile ? uploadedFile.name : 'Upload optional workbook'}</p>
                    <p className="mt-1 text-xs text-text-muted">`.xlsx`, `.xls`, or `.csv` up to 10 MB</p>
                  </div>
                </div>
                <span className="toolbar-chip">{uploadedFile ? 'Replace' : 'Choose file'}</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => setUploadedFile(event.target.files?.[0] || null)} />
              </label>
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg" loading={isPending}>Run research</Button>
              <Button type="button" variant="secondary" size="lg" onClick={() => {
                form.reset(buildDefaultValues(project));
                setCompetitorDiscovery({ status: 'idle' });
                setUploadedFile(null);
              }}>
                Reset run form
              </Button>
            </div>
          </form>
        </Card>
        <Card className="rounded-[30px] border-border/70">
          <div className="section-header">
            <div>
              <p className="eyebrow">Live run</p>
              <h2 className="section-subtitle mt-3">Status, logs, preview, and download</h2>
            </div>
            {selectedRun ? <StatusBadge status={selectedRun.status} /> : null}
          </div>
          {!selectedRun ? (
            <div className="mt-6">
              <EmptyState title="No run selected" description="Queue a run for this site or pick one from this workspace history." />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <Metric label="Brand" value={selectedRun.brandName} helper={`${selectedRun.language} · ${selectedRun.market}`} />
                <Metric label="Queued" value={formatDateTimeLabel(selectedRun.queuedAt)} helper={selectedRun.step || 'Awaiting updates'} />
              </div>
              <ResearchProcessTracker run={selectedRun} />
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} loading={runQuery.isRefetching} onClick={() => runQuery.refetch()}>Refresh</Button>
                <Button type="button" variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!selectedRun.workbookName} onClick={() => window.open(`/api/runs/${selectedRun.id}/download`, '_blank')}>Download XLSX</Button>
                <Button type="button" variant="ghost" icon={<RefreshCcw className="h-4 w-4" />} disabled={selectedRun.status === 'processing'} onClick={async () => {
                  const response = await fetch(`/api/runs/${selectedRun.id}/retry`, { method: 'POST' });
                  if (!response.ok) {
                    addToast('Unable to retry the run.', 'error');
                    return;
                  }
                  addToast('Run queued for retry.', 'success');
                  await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
                  await runQuery.refetch();
                }}>Retry run</Button>
              </div>
              <Tabs activeTab={activeTab} onChange={(value) => setActiveTab(value as typeof activeTab)} tabs={[{ id: 'preview', label: 'Preview', hasContent: previewRows.length > 0 }, { id: 'logs', label: 'Logs', hasContent: Boolean(selectedRun.logs.length) }, { id: 'summary', label: 'Summary', hasContent: Boolean(selectedRun.resultSummary) }]} />
              {activeTab === 'preview' ? <PreviewTable previewRows={previewRows} rowCount={selectedRun.rows.length} status={selectedRun.status} /> : null}
              {activeTab === 'logs' ? <RunLogs entries={selectedRun.logs} status={selectedRun.status} formatRelativeLabel={formatRelativeLabel} /> : null}
              {activeTab === 'summary' ? <div className="grid gap-3 md:grid-cols-2"><Metric label="Status" value={selectedRun.status} helper={selectedRun.step || 'No step reported'} /><Metric label="Workbook" value={selectedRun.workbookName || 'Pending'} helper={selectedRun.completedAt ? `Completed ${formatRelativeLabel(selectedRun.completedAt)}` : 'Not finished yet'} /><Metric label="Rows" value={String(selectedRun.rows.length || 0)} helper="Generated research rows" /><Metric label="Mode" value={selectedRun.mode === 'expand' ? 'Expand existing research' : 'Fresh research'} helper={`Target ${selectedRun.targetRows} rows`} /></div> : null}
            </div>
          )}
        </Card>
      </section>

      <section id="history" className="section-shell">
        <div className="section-header">
          <div>
            <p className="eyebrow">Workspace history</p>
            <h2 className="section-subtitle mt-3">Previous research runs for this site</h2>
            <p className="section-copy mt-3">Reopen past results, review their status, and download the completed workbook again.</p>
          </div>
          <div className="toolbar-chip flex items-center gap-2"><History className="h-4 w-4" />{runsQuery.data?.length || 0} tracked</div>
        </div>
        {!runsQuery.data?.length ? (
          <div className="mt-6">
            <EmptyState title="No research runs yet" description="This website workspace has not queued any research yet." />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {runsQuery.data.map((run) => (
              <div key={run.id} className={cn('rounded-[28px] border px-5 py-5 transition-all', selectedRunId === run.id ? 'border-accent/30 bg-accent/[0.08]' : 'border-border/70 bg-surface-raised/40 hover:-translate-y-0.5 hover:border-accent/20 hover:bg-surface')}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-text-primary">{run.projectName}</p>
                    <p className="mt-1 text-sm text-text-muted">{run.brandName} · {run.language} · {run.market}</p>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Metric label="Queued" value={formatDateTimeLabel(run.queuedAt)} helper={formatRelativeLabel(run.queuedAt)} compact />
                  <Metric label="Workbook" value={run.workbookName || 'Pending'} helper={run.errorMessage || run.step || 'No errors'} compact />
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button type="button" variant={selectedRunId === run.id ? 'primary' : 'secondary'} size="sm" onClick={() => setSelectedRunId(run.id)}>Open in workspace</Button>
                  <Link href={buildProjectRunPath(project.id, run.id)} className="inline-flex min-h-[40px] items-center justify-center rounded-2xl border border-border/80 bg-surface-raised/80 px-3.5 py-2 text-xs font-medium text-text-primary transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:bg-surface">Dedicated run page</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="field-group"><label className="field-label">{label}</label>{children}{error ? <p className="field-help text-destructive">{error}</p> : null}</div>;
}

function InfoRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-surface-raised/65 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
      {multiline ? <p className="mt-3 leading-6">{value}</p> : <a href={value} target="_blank" rel="noreferrer" className="mt-3 block truncate text-accent hover:underline">{value}</a>}
    </div>
  );
}

function PreviewTable({ previewRows, rowCount, status }: { previewRows: ResearchRunDetail['rows']; rowCount: number; status: ResearchRunDetail['status'] }) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-surface-raised/50">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary"><TableProperties className="h-4 w-4 text-accent" />Output preview</div>
        <span className="text-xs text-text-muted">{rowCount} rows generated</span>
      </div>
      <div className="max-h-[420px] overflow-auto">
        {!previewRows.length ? (
          <div className="px-4 py-8 text-sm text-text-secondary">{status === 'completed' ? 'No preview rows were stored.' : 'Preview will appear here once the run reaches the generation phase.'}</div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border/70 text-text-muted">{['Existing Parent Page', 'Pillar', 'Cluster', 'Intent', 'Primary Keyword', 'Keywords'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => <tr key={`${row.cluster}-${index}`} className="border-b border-border/50 align-top"><td className="px-4 py-3 text-text-secondary">{row.existingParentPage}</td><td className="px-4 py-3">{row.pillar}</td><td className="px-4 py-3">{row.cluster}</td><td className="px-4 py-3">{row.intent}</td><td className="px-4 py-3">{row.primaryKeyword}</td><td className="px-4 py-3 text-text-secondary">{row.keywords.join(', ')}</td></tr>)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RunLogs({ entries, status, formatRelativeLabel }: { entries: ResearchRunDetail['logs']; status: ResearchRunDetail['status']; formatRelativeLabel: (value: string | number | Date | null | undefined, fallback?: string) => string }) {
  if (!entries.length) {
    return <p className="rounded-[22px] border border-border/70 bg-surface-raised/50 px-4 py-4 text-sm text-text-secondary">Logs will stream here as the worker advances through crawl, analysis, generation, and export stages.</p>;
  }
  return <div className="space-y-3">{entries.map((entry) => <div key={entry.id} className="rounded-[22px] border border-border/70 bg-surface-raised/55 px-4 py-3"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-medium text-text-primary">{status === 'processing' && entry === entries[entries.length - 1] ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Search className="h-4 w-4 text-accent" />}{entry.message}</div><span className="text-xs text-text-muted">{formatRelativeLabel(entry.createdAt)}</span></div><p className="mt-2 text-xs uppercase tracking-[0.22em] text-text-muted">{entry.stage}</p></div>)}</div>;
}

function Metric({ label, value, helper, compact = false }: { label: string; value: string; helper: string; compact?: boolean }) {
  return <div className="rounded-[22px] border border-border/60 bg-surface-raised/70 px-4 py-3"><p className="text-xs uppercase tracking-[0.22em] text-text-muted">{label}</p><p className={cn('mt-2 font-semibold text-text-primary', compact ? 'text-base' : 'text-2xl')}>{value}</p><p className="mt-2 text-sm leading-6 text-text-secondary">{helper}</p></div>;
}

function StatusBadge({ status }: { status: ResearchRunSummary['status'] | ResearchRunDetail['status'] }) {
  const copy = { queued: 'Queued', processing: 'Processing', completed: 'Completed', failed: 'Failed' }[status];
  const classes = { queued: 'border-warning/25 bg-warning/[0.1] text-warning', processing: 'border-accent/25 bg-accent/[0.12] text-accent', completed: 'border-success/25 bg-success/[0.12] text-success', failed: 'border-destructive/25 bg-destructive/[0.12] text-destructive' }[status];
  return <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', classes)}>{copy}</span>;
}
