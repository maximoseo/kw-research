'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Download, History, Loader2, RefreshCcw, Search, TableProperties, UploadCloud } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, EmptyState, Tabs } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { createResearchFormSchema, type CreateResearchFormInput } from '@/lib/validation';
import type { ResearchRunDetail, ResearchRunSummary } from '@/lib/research';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';

function fetchRuns() {
  return fetch('/api/runs').then(async (response) => {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to load runs.');
    }
    return payload.runs as ResearchRunSummary[];
  });
}

function fetchRun(runId: string) {
  return fetch(`/api/runs/${runId}`).then(async (response) => {
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to load the run.');
    }
    return payload.run as ResearchRunDetail;
  });
}

const defaultValues: CreateResearchFormInput = {
  homepageUrl: '',
  aboutUrl: '',
  sitemapUrl: '',
  brandName: '',
  language: 'English',
  market: '',
  competitorUrls: '',
  notes: '',
  mode: 'fresh',
  targetRows: 220,
};

export default function ResearchDashboard({
  initialRunId,
}: {
  initialRunId?: string | null;
}) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState(initialRunId || null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'logs' | 'summary'>('preview');
  const [isPending, startTransition] = useTransition();
  const [hasMounted, setHasMounted] = useState(false);
  const runsQuery = useQuery({
    queryKey: ['runs'],
    queryFn: fetchRuns,
    refetchInterval: (query) => {
      const runs = (query.state.data || []) as ResearchRunSummary[];
      return runs.some((run) => run.status === 'queued' || run.status === 'processing') ? 4000 : false;
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

  const runQuery = useQuery({
    queryKey: ['run', selectedRunId],
    queryFn: () => fetchRun(selectedRunId!),
    enabled: Boolean(selectedRunId),
    refetchInterval: (query) => {
      const run = query.state.data as ResearchRunDetail | undefined;
      return run && (run.status === 'queued' || run.status === 'processing') ? 3000 : false;
    },
  });

  const form = useForm<CreateResearchFormInput>({
    resolver: zodResolver(createResearchFormSchema),
    defaultValues,
  });

  const previewRows = useMemo(() => runQuery.data?.rows.slice(0, 50) || [], [runQuery.data?.rows]);
  const greeting = hasMounted
    ? new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 17
        ? 'Good afternoon'
        : 'Good evening'
    : 'Welcome back';
  const formatDateTimeLabel = (value: string | number | Date | null | undefined, fallback = 'Syncing time...') =>
    hasMounted ? formatDateTime(value, fallback) : fallback;
  const formatRelativeLabel = (value: string | number | Date | null | undefined, fallback = 'Syncing...') =>
    hasMounted ? formatRelative(value, fallback) : fallback;

  const handleSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = new FormData();
      payload.set('homepageUrl', values.homepageUrl);
      payload.set('aboutUrl', values.aboutUrl);
      payload.set('sitemapUrl', values.sitemapUrl);
      payload.set('brandName', values.brandName);
      payload.set('language', values.language);
      payload.set('market', values.market);
      payload.set('competitorUrls', values.competitorUrls);
      payload.set('notes', values.notes || '');
      payload.set('mode', values.mode);
      payload.set('targetRows', String(values.targetRows));
      if (uploadedFile) {
        payload.set('existingResearch', uploadedFile);
      }

      const response = await fetch('/api/runs', {
        method: 'POST',
        body: payload,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        addToast(result?.error || 'Unable to start the research run.', 'error');
        return;
      }

      addToast('Research run queued successfully.', 'success');
      setSelectedRunId(result.runId);
      form.reset({
        ...defaultValues,
        language: values.language,
        market: values.market,
        brandName: values.brandName,
      });
      setUploadedFile(null);
      await queryClient.invalidateQueries({ queryKey: ['runs'] });
      await queryClient.invalidateQueries({ queryKey: ['run', result.runId] });
    });
  });

  const selectedRun = runQuery.data;

  return (
    <div className="page-stack">
      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card padding="none" className="rounded-[32px] border-border/70">
          <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
            <div className="absolute inset-0 bg-grid opacity-25" />
            <div className="absolute -left-10 top-0 h-36 w-36 rounded-full bg-[rgba(124,92,255,0.15)] blur-3xl" />
            <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-[rgba(96,165,250,0.1)] blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center rounded-full border border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8f73ff]">
                Keyword architecture ops
              </div>
              <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-lg text-text-secondary">{greeting}</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[2.2rem]">
                    Build deduplicated pillar and cluster plans that are ready to hand off.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
                    This workspace crawls the supplied site, studies the real business, compares
                    against existing coverage and uploaded research, then exports a polished XLSX
                    built for strategy and content production.
                  </p>
                </div>
              </div>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {[
                  {
                    label: 'Recent runs',
                    value: `${runsQuery.data?.length || 0} tracked`,
                    helper: 'Every run keeps logs, preview rows, and workbook history.',
                  },
                  {
                    label: 'Protected access',
                    value: 'Login required',
                    helper: 'Auth-gated dashboard with logout and route protection.',
                  },
                  {
                    label: 'Workbook output',
                    value: 'Styled XLSX',
                    helper: 'Grouped pillars, filters, frozen headers, and hyperlink-ready rows.',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[24px] border border-border/70 bg-surface-overlay/70 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{item.label}</p>
                    <p className="mt-3 text-lg font-semibold text-text-primary">{item.value}</p>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{item.helper}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-[32px] border-border/70">
          <p className="eyebrow">Research policy</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">What this engine will enforce</h2>
          <div className="mt-6 space-y-4">
            {[
              'Brand name is forced to the first position in every Keywords cell.',
              'Pillar rows are emitted first in every group, followed by cluster rows.',
              'Existing coverage and uploaded research are used to suppress duplicates and cannibalization.',
              'English outputs stay LTR. Hebrew outputs are exported with RTL worksheet direction.',
            ].map((item) => (
              <div key={item} className="rounded-[24px] border border-border/70 bg-surface-raised/65 px-4 py-4">
                <p className="text-sm leading-6 text-text-secondary">{item}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section id="new-research" className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="rounded-[30px] border-border/70">
          <div className="section-header">
            <div>
              <p className="eyebrow">New project</p>
              <h2 className="section-subtitle mt-3">Create a research run</h2>
              <p className="section-copy mt-3">
                Add the site sources, choose the market, optionally upload previous keyword research,
                and start a new run.
              </p>
            </div>
            <div className="toolbar-chip">{uploadedFile ? uploadedFile.name : 'No workbook uploaded'}</div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
            dir={form.watch('language') === 'Hebrew' ? 'rtl' : 'ltr'}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Homepage URL" error={form.formState.errors.homepageUrl?.message}>
                <input className="field-input" placeholder="https://example.com" {...form.register('homepageUrl')} />
              </Field>
              <Field label="About page URL" error={form.formState.errors.aboutUrl?.message}>
                <input className="field-input" placeholder="https://example.com/about" {...form.register('aboutUrl')} />
              </Field>
            </div>

            <Field label="Sitemap URL" error={form.formState.errors.sitemapUrl?.message}>
              <input className="field-input" placeholder="https://example.com/sitemap.xml" {...form.register('sitemapUrl')} />
            </Field>

            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Brand name" error={form.formState.errors.brandName?.message}>
                <input className="field-input" placeholder="Maximo SEO" {...form.register('brandName')} />
              </Field>
              <Field label="Language" error={form.formState.errors.language?.message}>
                <select className="field-select" {...form.register('language')}>
                  <option value="English">English</option>
                  <option value="Hebrew">Hebrew / עברית</option>
                </select>
              </Field>
              <Field label="Market" error={form.formState.errors.market?.message}>
                <input className="field-input" placeholder="United Kingdom / Israel / Texas" {...form.register('market')} />
              </Field>
            </div>

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
              <textarea
                className="field-textarea"
                placeholder="https://competitor-one.com, https://competitor-two.com"
                {...form.register('competitorUrls')}
              />
            </Field>

            <Field label="Notes / instructions" error={form.formState.errors.notes?.message}>
              <textarea className="field-textarea" placeholder="Optional guidance for the run" {...form.register('notes')} />
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
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(event) => setUploadedFile(event.target.files?.[0] || null)}
                />
              </label>
            </Field>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg" loading={isPending}>
                Run research
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={() => form.reset(defaultValues)}>
                Reset form
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
              <EmptyState title="No run selected" description="Start a research run or select one from history to inspect its logs and results." />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <Metric label="Brand" value={selectedRun.brandName} helper={`${selectedRun.language} · ${selectedRun.market}`} />
                <Metric label="Queued" value={formatDateTimeLabel(selectedRun.queuedAt)} helper={selectedRun.step || 'Awaiting updates'} />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<RefreshCcw className="h-4 w-4" />}
                  loading={runQuery.isRefetching}
                  onClick={() => runQuery.refetch()}
                >
                  Refresh
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Download className="h-4 w-4" />}
                  disabled={!selectedRun.workbookName}
                  onClick={() => window.open(`/api/runs/${selectedRun.id}/download`, '_blank')}
                >
                  Download XLSX
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
                    await queryClient.invalidateQueries({ queryKey: ['runs'] });
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
                <div className="rounded-[24px] border border-border/70 bg-surface-raised/50">
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      <TableProperties className="h-4 w-4 text-accent" />
                      Output preview
                    </div>
                    <span className="text-xs text-text-muted">{selectedRun.rows.length} rows generated</span>
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    {!previewRows.length ? (
                      <div className="px-4 py-8 text-sm text-text-secondary">
                        {selectedRun.status === 'completed'
                          ? 'No preview rows were stored.'
                          : 'Preview will appear here once the run reaches the generation phase.'}
                      </div>
                    ) : (
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 bg-surface">
                          <tr className="border-b border-border/70 text-text-muted">
                            {['Existing Parent Page', 'Pillar', 'Cluster', 'Intent', 'Primary Keyword', 'Keywords'].map((label) => (
                              <th key={label} className="px-4 py-3 font-medium">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, index) => (
                            <tr key={`${row.cluster}-${index}`} className="border-b border-border/50 align-top">
                              <td className="px-4 py-3 text-text-secondary">{row.existingParentPage}</td>
                              <td className="px-4 py-3">{row.pillar}</td>
                              <td className="px-4 py-3">{row.cluster}</td>
                              <td className="px-4 py-3">{row.intent}</td>
                              <td className="px-4 py-3">{row.primaryKeyword}</td>
                              <td className="px-4 py-3 text-text-secondary">{row.keywords.join(', ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === 'logs' ? (
                <div className="space-y-3">
                  {selectedRun.logs.length ? (
                    selectedRun.logs.map((entry) => (
                      <div key={entry.id} className="rounded-[22px] border border-border/70 bg-surface-raised/55 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                            {selectedRun.status === 'processing' && entry === selectedRun.logs[selectedRun.logs.length - 1] ? (
                              <Loader2 className="h-4 w-4 animate-spin text-accent" />
                            ) : (
                              <Search className="h-4 w-4 text-accent" />
                            )}
                            {entry.message}
                          </div>
                          <span className="text-xs text-text-muted">{formatRelativeLabel(entry.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-xs uppercase tracking-[0.22em] text-text-muted">{entry.stage}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-[22px] border border-border/70 bg-surface-raised/50 px-4 py-4 text-sm text-text-secondary">
                      Logs will stream here as the worker advances through crawl, analysis, generation, and export stages.
                    </p>
                  )}
                </div>
              ) : null}

              {activeTab === 'summary' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <Metric label="Status" value={selectedRun.status} helper={selectedRun.step || 'No step reported'} />
                  <Metric label="Workbook" value={selectedRun.workbookName || 'Pending'} helper={selectedRun.completedAt ? `Completed ${formatRelativeLabel(selectedRun.completedAt)}` : 'Not finished yet'} />
                  <Metric label="Rows" value={String(selectedRun.rows.length || 0)} helper="Generated research rows" />
                  <Metric label="Mode" value={selectedRun.mode === 'expand' ? 'Expand existing research' : 'Fresh research'} helper={`Target ${selectedRun.targetRows} rows`} />
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </section>

      <section id="history" className="section-shell">
        <div className="section-header">
          <div>
            <p className="eyebrow">History</p>
            <h2 className="section-subtitle mt-3">Previous research runs</h2>
            <p className="section-copy mt-3">
              Reopen past results, review their status, and download the completed workbook again.
            </p>
          </div>
          <div className="toolbar-chip flex items-center gap-2">
            <History className="h-4 w-4" />
            {runsQuery.data?.length || 0} tracked
          </div>
        </div>

        {!runsQuery.data?.length ? (
          <div className="mt-6">
            <EmptyState title="No research runs yet" description="Your queued, completed, and failed research jobs will appear here." />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {runsQuery.data.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                className={cn(
                  'text-left rounded-[28px] border px-5 py-5 transition-all',
                  selectedRunId === run.id
                    ? 'border-accent/30 bg-accent/[0.08]'
                    : 'border-border/70 bg-surface-raised/40 hover:-translate-y-0.5 hover:border-accent/20 hover:bg-surface',
                )}
              >
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
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {children}
      {error ? <p className="field-help text-destructive">{error}</p> : null}
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  compact = false,
}: {
  label: string;
  value: string;
  helper: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-border/60 bg-surface-raised/70 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.22em] text-text-muted">{label}</p>
      <p className={cn('mt-2 font-semibold text-text-primary', compact ? 'text-base' : 'text-2xl')}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{helper}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchRunSummary['status'] | ResearchRunDetail['status'] }) {
  const copy = {
    queued: 'Queued',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
  }[status];

  const classes = {
    queued: 'border-warning/25 bg-warning/[0.1] text-warning',
    processing: 'border-accent/25 bg-accent/[0.12] text-accent',
    completed: 'border-success/25 bg-success/[0.12] text-success',
    failed: 'border-destructive/25 bg-destructive/[0.12] text-destructive',
  }[status];

  return <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', classes)}>{copy}</span>;
}
