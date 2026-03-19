'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowRight, Layers3, Plus, SearchCheck, Globe } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Badge, Button, Card, EmptyState, Field, Metric } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { buildProjectDashboardPath, SELECTED_PROJECT_STORAGE_KEY } from '@/lib/project-context';
import type { ResearchProjectSummary, ResearchStatus } from '@/lib/research';
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

type RunStatusVisual = {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info' | 'neutral';
};

const runStatusVisual: Record<ResearchStatus | 'none', RunStatusVisual> = {
  queued: { label: 'Queued', variant: 'info' },
  processing: { label: 'Processing', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  failed: { label: 'Failed', variant: 'error' },
  none: { label: 'No runs yet', variant: 'neutral' },
};

function getStatusVisual(status: ResearchStatus | null) {
  return status ? runStatusVisual[status] : runStatusVisual.none;
}

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
  const { formState } = form;

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

  const focusCreateSection = () => {
    if (typeof window === 'undefined') {
      return;
    }
    const section = document.getElementById('new-site-form');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="page-stack">
      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.08fr_0.92fr]">
        <Card variant="hero" className="overflow-hidden" padding="none">
          <div className="relative px-5 py-7 sm:px-7 sm:py-8">
            <div className="absolute inset-0 bg-grid/50" />
            <div className="absolute -left-12 top-0 h-48 w-48 rounded-full bg-accent/[0.16] blur-3xl" />
            <div className="absolute bottom-2 right-0 h-44 w-44 rounded-full bg-accent/[0.06] blur-3xl" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-2/3 bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
            <div className="relative">
              <div className="toolbar-chip w-fit border-accent/25 bg-accent/[0.10] text-accent">Site-first workspace model</div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[2rem]">
                Choose a website workspace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary sm:text-base">
                KW Research is organized by site context. Select a workspace first to keep runs, exports, and history isolated
                and predictable.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Metric label="Signed-in analyst" value={user.displayName} helper={user.email} />
                <Metric label="Available workspaces" value={String(projects.length)} helper="Website projects in your account" />
                <Metric label="Scope model" value="Project selected" helper="Dashboard routes stay in site context" />
              </div>
            </div>
          </div>
        </Card>

        <Card variant="muted">
          <div className="space-y-5">
            <div className="section-header">
              <div>
                <p className="eyebrow">How the flow works</p>
                <h2 className="section-subtitle mt-2">Cleaner route behavior</h2>
                <p className="section-copy mt-2">
                  A predictable workspace gate keeps analytics from leaking between sites.
                </p>
              </div>
              <Badge variant="info" className="self-start">
                <SearchCheck className="h-3.5 w-3.5" />
                Guidance
              </Badge>
            </div>
            <div className="space-y-2.5">
              {[
                ['Site-scoped routes', 'Every dashboard route opens only after a workspace is selected.'],
                ['Context recovery', 'Returning sessions restore the last workspace when available.'],
                ['Focused outputs', 'All uploads, logs, and exports stay attached to one website.'],
              ].map(([title, text]) => (
                <div key={title} className="subtle-surface grid gap-1 px-4 py-3.5">
                  <p className="text-sm font-semibold text-text-primary">{title}</p>
                  <p className="text-sm leading-6 text-text-secondary">{text}</p>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" className="w-full sm:w-auto" size="sm" onClick={focusCreateSection}>
              <SearchCheck className="h-4 w-4" />
              Jump to create form
            </Button>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="section-header">
            <div>
              <p className="eyebrow">Website workspaces</p>
              <h2 className="section-subtitle mt-2">Select a workspace to continue</h2>
              <p className="section-copy mt-2">
                Each card opens one dedicated project dashboard for a single website.
              </p>
            </div>
            <Badge variant="info" className="self-start">
              <Layers3 className="h-3.5 w-3.5" />
              {projects.length} workspace{projects.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {!orderedProjects.length ? (
            <EmptyState
              className="mt-6"
              title="No website workspaces yet"
              description="Create your first workspace so research can run inside a scoped project context."
              action={{
                label: 'Create workspace',
                onClick: focusCreateSection,
              }}
            />
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              {orderedProjects.map((project) => {
                const isLastSelected = project.id === lastSelectedProjectId;
                const activityTime = project.latestRunQueuedAt || project.updatedAt;
                const status = getStatusVisual(project.latestRunStatus);

                return (
                  <Link
                    key={project.id}
                    href={buildProjectDashboardPath(project.id)}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Card
                      variant="interactive"
                      className={cn(
                        'h-full transition-colors',
                        isLastSelected ? 'border-accent/32 bg-accent/[0.06]' : 'hover:bg-surface',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-semibold tracking-tight text-text-primary">{project.name}</p>
                          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                            <Globe className="h-4 w-4" />
                            <span className="truncate">
                              {project.brandName} · {project.language} · {project.market}
                            </span>
                          </p>
                        </div>
                        <div className="stack-mobile items-center">
                          {isLastSelected ? <Badge variant="success">Last used</Badge> : null}
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <Metric label="Runs" value={String(project.runCount)} helper="Total research executions" compact />
                        <Metric
                          label="Activity"
                          value={formatRelative(activityTime)}
                          helper={formatDateTime(activityTime)}
                          compact
                        />
                        <Metric label="Competitors" value={String(project.competitorUrls.length)} helper="Seeded URL sources" compact />
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <span className="max-w-full truncate rounded-full border border-border/70 bg-surface-raised/[0.66] px-3 py-1.5 text-[11px] text-text-secondary">
                          {project.homepageUrl}
                        </span>
                        {project.sitemapUrl ? (
                          <span className="max-w-full truncate rounded-full border border-border/70 bg-surface-raised/[0.66] px-3 py-1.5 text-[11px] text-text-secondary">
                            {project.sitemapUrl}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-5 flex items-center justify-between rounded-lg border border-accent/[0.08] bg-accent/[0.03] px-3.5 py-2.5 text-xs">
                        <span className="font-medium text-text-secondary">Open workspace</span>
                        <span className="inline-flex items-center gap-1.5 text-accent">
                          <span className="font-semibold">Enter</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="section-header">
            <div>
              <p className="eyebrow">Create workspace</p>
              <h2 className="section-subtitle mt-3">Add a new website workspace</h2>
              <p className="section-copy mt-3">
                Add once, then use it across runs, exports, and reporting without re-entering context.
              </p>
            </div>
            <Badge variant="neutral" className="self-start">
              <Plus className="h-3.5 w-3.5" />
              New
            </Badge>
          </div>

          <Alert variant="info" className="mt-6">
            Required fields: homepage URL, about URL, and sitemap URL. Competitor URLs can be added later.
          </Alert>

          <form id="new-site-form" onSubmit={handleCreateProject} className="mt-6 space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Homepage URL" error={formState.errors.homepageUrl?.message} hint="Example: https://example.com">
                <input className="field-input" placeholder="https://example.com" {...form.register('homepageUrl')} />
              </Field>
              <Field label="About page URL" error={formState.errors.aboutUrl?.message} hint="Optional, but useful for context">
                <input className="field-input" placeholder="https://example.com/about" {...form.register('aboutUrl')} />
              </Field>
            </div>
            <Field label="Sitemap URL" error={formState.errors.sitemapUrl?.message} hint="Example: https://example.com/sitemap.xml">
              <input className="field-input" placeholder="https://example.com/sitemap.xml" {...form.register('sitemapUrl')} />
            </Field>
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Brand name" error={formState.errors.brandName?.message} hint="Shown in cards and reports">
                <input className="field-input" placeholder="Maximo SEO" {...form.register('brandName')} />
              </Field>
              <Field label="Language" error={formState.errors.language?.message} hint="Research language context">
                <select className="field-select" {...form.register('language')}>
                  <option value="English">English</option>
                  <option value="Hebrew">Hebrew / עברית</option>
                </select>
              </Field>
              <Field label="Market" error={formState.errors.market?.message} hint="Optional target market">
                <input className="field-input" placeholder="United Kingdom / Israel / Texas" {...form.register('market')} />
              </Field>
            </div>
            <Field
              label="Competitor URLs"
              error={formState.errors.competitorUrls?.message as string | undefined}
              hint="Optional seed URLs, commas or new lines"
            >
              <textarea
                className="field-textarea"
                placeholder="https://competitor-a.com, https://competitor-b.com"
                {...form.register('competitorUrls')}
              />
            </Field>
            <Field label="Workspace notes" error={formState.errors.notes?.message} hint="Optional analyst notes">
              <textarea className="field-textarea" placeholder="Project-specific assumptions or exclusions" {...form.register('notes')} />
            </Field>
            <div className="flex flex-col gap-3 border-t border-accent/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="ghost" size="lg" onClick={() => form.reset(defaultValues)} disabled={isPending} className="w-full sm:w-auto">
                Reset
              </Button>
              <Button type="submit" size="lg" loading={isPending} disabled={formState.isSubmitting} className="w-full sm:w-auto">
                Create workspace
              </Button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
