'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Globe, Layers3, Plus, Radar, SearchCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { buildProjectDashboardPath, SELECTED_PROJECT_STORAGE_KEY } from '@/lib/project-context';
import type { ResearchProjectSummary } from '@/lib/research';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { createProjectFormSchema, type CreateProjectFormInput } from '@/lib/validation';

const defaultValues: CreateProjectFormInput = {
  homepageUrl: '',
  aboutUrl: '',
  sitemapUrl: '',
  brandName: '',
  language: 'English',
  market: '',
  competitorUrls: '',
  notes: '',
};

export function SiteSelectionDashboard({
  user,
  projects,
}: {
  user: { displayName: string; email: string };
  projects: ResearchProjectSummary[];
}) {
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [lastSelectedProjectId, setLastSelectedProjectId] = useState<string | null>(null);
  const form = useForm<CreateProjectFormInput>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setLastSelectedProjectId(window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY));
  }, []);

  const orderedProjects = useMemo(() => {
    if (!lastSelectedProjectId) {
      return projects;
    }

    return [...projects].sort((left, right) => {
      if (left.id === lastSelectedProjectId) return -1;
      if (right.id === lastSelectedProjectId) return 1;
      return (right.latestRunQueuedAt || right.updatedAt) - (left.latestRunQueuedAt || left.updatedAt);
    });
  }, [lastSelectedProjectId, projects]);

  const handleCreateProject = form.handleSubmit((values) => {
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

      const response = await fetch('/api/projects', {
        method: 'POST',
        body: payload,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        addToast(result?.error || 'Unable to create the website workspace.', 'error');
        return;
      }

      const nextPath = buildProjectDashboardPath(result.projectId);
      window.location.assign(nextPath);
    });
  });

  return (
    <div className="page-stack">
      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card padding="none" className="rounded-2xl border-border/70 overflow-hidden">
          <div className="relative overflow-hidden px-6 py-8 sm:px-8 sm:py-9">
            <div className="absolute inset-0 bg-grid opacity-20" />
            <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-info/10 blur-3xl" />
            <div className="relative">
              <div className="toolbar-chip w-fit border-accent/18 bg-accent/8">
                Website selection required
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-[2.4rem]">
                Choose the website workspace before opening internal research tools.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary sm:text-base">
                The app no longer drops users into a global dashboard. Select a site first, then enter
                that website&apos;s dedicated keyword research workspace with project-scoped runs,
                exports, and competitor discovery.
              </p>
              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <Metric label="Analyst" value={user.displayName} helper={user.email} />
                <Metric label="Projects" value={String(projects.length)} helper="Website workspaces available" />
                <Metric label="Routing model" value="Site first" helper="Internal dashboards only load with a valid site context" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-border/70">
          <p className="eyebrow">How this works now</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Project-scoped entry</h2>
          <div className="mt-6 space-y-4">
            {[
              'Every dashboard route is now tied to one selected website workspace.',
              'Refreshing a valid project URL restores that workspace cleanly.',
              'Invalid deep links and missing site context fall back to this selector instead of rendering a broken dashboard.',
            ].map((item) => (
              <div key={item} className="rounded-xl border border-border/70 bg-surface-raised/65 px-4 py-4 text-sm leading-6 text-text-secondary">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="rounded-xl border-border/70">
          <div className="section-header">
            <div>
              <p className="eyebrow">Website workspaces</p>
              <h2 className="section-subtitle mt-3">Select a site to enter its dashboard</h2>
              <p className="section-copy mt-3">
                Each card opens one dedicated site workspace. The last site you used is surfaced first when available.
              </p>
            </div>
            <div className="toolbar-chip flex items-center gap-2">
              <Layers3 className="h-4 w-4" />
              {projects.length} sites
            </div>
          </div>

          {!orderedProjects.length ? (
            <div className="mt-6">
              <EmptyState
                title="No website workspaces yet"
                description="Create the first website workspace to start project-scoped keyword research."
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {orderedProjects.map((project) => {
                const isLastSelected = project.id === lastSelectedProjectId;
                const activityTime = project.latestRunQueuedAt || project.updatedAt;

                return (
                  <Link
                    key={project.id}
                    href={buildProjectDashboardPath(project.id)}
                    className={cn(
                      'rounded-xl border px-5 py-5 transition-all hover:-translate-y-0.5',
                      isLastSelected
                        ? 'border-accent/30 bg-accent/[0.08]'
                        : 'border-border/70 bg-surface-raised/40 hover:border-accent/20 hover:bg-surface',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold tracking-tight text-text-primary">{project.name}</p>
                        <p className="mt-1 text-sm text-text-muted">
                          {project.brandName} · {project.language} · {project.market}
                        </p>
                      </div>
                      {isLastSelected ? (
                        <span className="rounded-full border border-accent/25 bg-accent/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                          Recent
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Metric
                        label="Runs"
                        value={String(project.runCount)}
                        helper={project.latestRunStatus ? `Latest ${project.latestRunStatus}` : 'No runs yet'}
                        compact
                      />
                      <Metric
                        label="Activity"
                        value={formatRelative(activityTime)}
                        helper={formatDateTime(activityTime)}
                        compact
                      />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-text-muted min-w-0">
                      <span className="toolbar-chip border-border/60 max-w-[260px] truncate">{project.homepageUrl}</span>
                      <span className="toolbar-chip border-border/60 max-w-[260px] truncate">{project.sitemapUrl}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="rounded-xl border-border/70">
          <div className="section-header">
            <div>
              <p className="eyebrow">Create website workspace</p>
              <h2 className="section-subtitle mt-3">Add a new site</h2>
              <p className="section-copy mt-3">
                Define the site once here. After that, all research runs happen inside the selected site dashboard.
              </p>
            </div>
            <div className="toolbar-chip flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New site
            </div>
          </div>

          <form onSubmit={handleCreateProject} className="mt-6 space-y-5">
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
            <Field label="Competitor URLs" error={form.formState.errors.competitorUrls?.message as string | undefined}>
              <textarea className="field-textarea" placeholder="Optional seed competitor URLs" {...form.register('competitorUrls')} />
            </Field>
            <Field label="Workspace notes" error={form.formState.errors.notes?.message}>
              <textarea className="field-textarea" placeholder="Optional project notes" {...form.register('notes')} />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg" loading={isPending}>
                Create Workspace
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={() => form.reset(defaultValues)}>
                Reset
              </Button>
            </div>
          </form>
        </Card>
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
    <div className="rounded-lg border border-border/60 bg-surface-raised/70 px-4 py-3 overflow-hidden min-w-0">
      <p className="text-xs uppercase tracking-[0.22em] text-text-muted truncate">{label}</p>
      <p className={cn('mt-2 font-semibold text-text-primary break-words', compact ? 'text-base' : 'text-2xl')}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary line-clamp-2">{helper}</p>
    </div>
  );
}
