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
      {/* ── Hero ── */}
      <section className="animate-enter grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]">
        <Card variant="hero" className="overflow-hidden" padding="none">
          <div className="relative px-6 py-7 sm:px-7 sm:py-8">
            <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-accent/[0.08] blur-3xl" />
            <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-accent/[0.04] blur-3xl" />
            <div className="relative">
              <div className="toolbar-chip w-fit border-accent/20 bg-accent/[0.06] text-accent">Site-first workspace model</div>
              <h1 className="mt-4 text-heading-1 sm:text-2xl lg:text-[1.75rem]">
                Choose a website workspace
              </h1>
              <p className="mt-2 max-w-xl text-body leading-relaxed text-text-secondary">
                KW Research is organized by site context. Select a workspace to keep runs, exports, and history isolated.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric label="Analyst" value={user.displayName} helper={user.email} />
                <Metric label="Workspaces" value={String(projects.length)} helper="Available in your account" />
                <Metric label="Scope" value="Project" helper="Dashboard stays in site context" />
              </div>
            </div>
          </div>
        </Card>

        <Card variant="muted">
          <div className="space-y-4">
            <div>
              <p className="eyebrow">How the flow works</p>
              <h2 className="section-subtitle mt-2">Workspace model</h2>
              <p className="section-copy mt-1.5">
                A predictable workspace gate keeps analytics from leaking between sites.
              </p>
            </div>
            <div className="space-y-2">
              {[
                ['Site-scoped routes', 'Every dashboard route opens only after a workspace is selected.'],
                ['Context recovery', 'Returning sessions restore the last workspace when available.'],
                ['Focused outputs', 'All uploads, logs, and exports stay attached to one website.'],
              ].map(([title, text]) => (
                <div key={title} className="subtle-surface px-4 py-3">
                  <p className="text-body font-semibold text-text-primary">{title}</p>
                  <p className="mt-0.5 text-body-sm leading-relaxed text-text-secondary">{text}</p>
                </div>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" icon={<SearchCheck className="h-3.5 w-3.5" />} onClick={focusCreateSection}>
              Jump to create form
            </Button>
          </div>
        </Card>
      </section>

      {/* ── Workspaces + Create ── */}
      <section className="animate-enter-delayed grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="section-header">
            <div>
              <p className="eyebrow">Website workspaces</p>
              <h2 className="section-subtitle mt-2">Select a workspace</h2>
              <p className="section-copy mt-1.5">
                Each card opens a dedicated project dashboard for a single website.
              </p>
            </div>
            <Badge variant="info" className="self-start">
              <Layers3 className="h-3.5 w-3.5" />
              {projects.length} workspace{projects.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {!orderedProjects.length ? (
            <EmptyState
              className="mt-5"
              title="No website workspaces yet"
              description="Create your first workspace to run research inside a scoped project context."
              action={{
                label: 'Create workspace',
                onClick: focusCreateSection,
              }}
            />
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {orderedProjects.map((project) => {
                const isLastSelected = project.id === lastSelectedProjectId;
                const activityTime = project.latestRunQueuedAt || project.updatedAt;
                const status = getStatusVisual(project.latestRunStatus);

                return (
                  <Link
                    key={project.id}
                    href={buildProjectDashboardPath(project.id)}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Card
                      variant="interactive"
                      className={cn(
                        'h-full',
                        isLastSelected && 'border-accent/25 bg-accent/[0.03]',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-heading-3 text-text-primary">{project.name}</p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-body-sm text-text-muted">
                            <Globe className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {project.brandName} · {project.language} · {project.market}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isLastSelected ? <Badge variant="success" dot={false}>Last used</Badge> : null}
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                        <Metric label="Runs" value={String(project.runCount)} helper="Total executions" compact />
                        <Metric
                          label="Activity"
                          value={formatRelative(activityTime)}
                          helper={formatDateTime(activityTime)}
                          compact
                        />
                        <Metric label="Competitors" value={String(project.competitorUrls.length)} helper="Seeded URLs" compact />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <span className="max-w-full truncate rounded-md border border-border/40 bg-surface-raised px-2.5 py-1 text-caption text-text-muted">
                          {project.homepageUrl}
                        </span>
                        {project.sitemapUrl ? (
                          <span className="max-w-full truncate rounded-md border border-border/40 bg-surface-raised px-2.5 py-1 text-caption text-text-muted">
                            {project.sitemapUrl}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4 flex items-center justify-between rounded-lg border border-accent/[0.06] bg-accent/[0.02] px-3 py-2 text-caption">
                        <span className="font-medium text-text-muted">Open workspace</span>
                        <span className="inline-flex items-center gap-1 text-accent">
                          <span className="font-semibold">Enter</span>
                          <ArrowRight className="h-3 w-3" />
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
              <h2 className="section-subtitle mt-2">Add a new website workspace</h2>
              <p className="section-copy mt-1.5">
                Add once, then use across runs, exports, and reporting.
              </p>
            </div>
            <Badge variant="neutral" className="self-start">
              <Plus className="h-3.5 w-3.5" />
              New
            </Badge>
          </div>

          <Alert variant="info" className="mt-5">
            Required fields: homepage URL, about URL, and sitemap URL. Competitor URLs can be added later.
          </Alert>

          <form id="new-site-form" onSubmit={handleCreateProject} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Homepage URL" error={formState.errors.homepageUrl?.message} hint="Example: https://example.com">
                <input className="field-input" placeholder="https://example.com" {...form.register('homepageUrl')} />
              </Field>
              <Field label="About page URL" error={formState.errors.aboutUrl?.message} hint="Optional, useful for context">
                <input className="field-input" placeholder="https://example.com/about" {...form.register('aboutUrl')} />
              </Field>
            </div>
            <Field label="Sitemap URL" error={formState.errors.sitemapUrl?.message} hint="Example: https://example.com/sitemap.xml">
              <input className="field-input" placeholder="https://example.com/sitemap.xml" {...form.register('sitemapUrl')} />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Brand name" error={formState.errors.brandName?.message} hint="Shown in cards">
                <input className="field-input" placeholder="Maximo SEO" {...form.register('brandName')} />
              </Field>
              <Field label="Language" error={formState.errors.language?.message} hint="Research language">
                <select className="field-select" {...form.register('language')}>
                  <option value="English">English</option>
                  <option value="Hebrew">Hebrew / עברית</option>
                </select>
              </Field>
              <Field label="Market" error={formState.errors.market?.message} hint="Target market">
                <input className="field-input" placeholder="United Kingdom / Israel" {...form.register('market')} />
              </Field>
            </div>
            <Field
              label="Competitor URLs"
              error={formState.errors.competitorUrls?.message as string | undefined}
              hint="Optional, commas or new lines"
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
            <div className="flex flex-col gap-2.5 border-t border-border/40 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="ghost" size="md" onClick={() => form.reset(defaultValues)} disabled={isPending} className="w-full sm:w-auto">
                Reset
              </Button>
              <Button type="submit" size="md" loading={isPending} disabled={formState.isSubmitting} className="w-full sm:w-auto">
                Create workspace
              </Button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
