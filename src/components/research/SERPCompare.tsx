'use client';

import React, { useState, useCallback } from 'react';
import {
  ArrowLeftRight,
  AlertCircle,
  BarChart3,
  ExternalLink,
  Eye,
  Film,
  FileText,
  Globe,
  LayoutGrid,
  Lightbulb,
  Loader2,
  MessageSquare,
  Newspaper,
  ShoppingBag,
  Wrench,
  Sparkles,
} from 'lucide-react';
import type { ResearchRow } from '@/lib/research';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import DifficultyBadge from './DifficultyBadge';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

type ContentTypeKey = 'blog' | 'video' | 'product' | 'forum' | 'news' | 'tool';

interface SerpTopResult {
  rank: number;
  title: string;
  url: string;
  domain: string;
  contentType: string;
}

interface SerpCompareKeywordData {
  keyword: string;
  topResults: SerpTopResult[];
  contentTypeBreakdown: Record<string, number>;
  uniqueDomains: string[];
  missingTypes: string[];
  fetchedAt: number;
}

interface SerpCompareResponse {
  results: SerpCompareKeywordData[];
  sharedDomains: string[];
  opportunities: string[];
}

interface SERPCompareProps {
  /** Keywords selected for comparison (with metadata) */
  selectedKeywords: ResearchRow[];
  /** Called to dismiss */
  onClose?: () => void;
  className?: string;
}

/* ─────────────────────────────────────────────
   Content-type icon + color map (matches Badge variants)
   ───────────────────────────────────────────── */

const contentTypeConfig: Record<
  ContentTypeKey,
  { icon: React.ReactNode; label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; color: string }
> = {
  blog: {
    icon: <FileText className="h-3 w-3" />,
    label: 'Blog',
    variant: 'info',
    color: 'hsl(254 100% 64%)',
  },
  video: {
    icon: <Film className="h-3 w-3" />,
    label: 'Video',
    variant: 'error',
    color: 'hsl(0 84% 60%)',
  },
  product: {
    icon: <ShoppingBag className="h-3 w-3" />,
    label: 'Product',
    variant: 'success',
    color: 'hsl(142 71% 45%)',
  },
  forum: {
    icon: <MessageSquare className="h-3 w-3" />,
    label: 'Forum',
    variant: 'warning',
    color: 'hsl(45 93% 47%)',
  },
  news: {
    icon: <Newspaper className="h-3 w-3" />,
    label: 'News',
    variant: 'neutral',
    color: 'hsl(215 20% 50%)',
  },
  tool: {
    icon: <Wrench className="h-3 w-3" />,
    label: 'Tool',
    variant: 'info',
    color: 'hsl(200 100% 50%)',
  },
};

const ALL_TYPES: ContentTypeKey[] = ['blog', 'video', 'product', 'forum', 'news', 'tool'];

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function formatVolume(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function isSharedDomain(
  domain: string,
  sharedDomains: string[],
): boolean {
  return sharedDomains.includes(domain);
}

/* ─────────────────────────────────────────────
   Content Type Bar
   ───────────────────────────────────────────── */

function ContentTypeBar({
  breakdown,
}: {
  breakdown: Record<string, number>;
}) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return <p className="text-caption text-text-muted italic">No data</p>;
  }

  return (
    <div className="space-y-1.5">
      {ALL_TYPES.map((type) => {
        const count = breakdown[type] || 0;
        if (count === 0) return null;
        const pct = Math.round((count / total) * 100);
        const config = contentTypeConfig[type];
        return (
          <div key={type} className="flex items-center gap-2 text-[11px]">
            <div className="flex items-center gap-1 w-16 shrink-0 text-text-secondary">
              {config.icon}
              <span className="font-medium">{config.label}</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-inset overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: config.color,
                  minWidth: pct > 0 ? '4px' : '0',
                }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-text-muted">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SERP Features display (mock/estimated)
   ───────────────────────────────────────────── */

function getEstimatedSerpFeatures(
  topResults: SerpTopResult[],
  contentTypeBreakdown: Record<string, number>,
): string[] {
  const features: string[] = [];

  // Check for content types that suggest features
  if ((contentTypeBreakdown.video || 0) > 0) {
    features.push('video_carousel');
  }
  if ((contentTypeBreakdown.news || 0) > 0) {
    features.push('top_stories');
  }
  if ((contentTypeBreakdown.forum || 0) > 0) {
    features.push('discussions_and_forums');
  }
  if ((contentTypeBreakdown.tool || 0) > 0) {
    features.push('tools_section');
  }

  // Featured snippet: if top 3 results include a definition-style or "what is" page
  const topTitles = topResults.slice(0, 3).map((r) => r.title.toLowerCase());
  if (
    topTitles.some(
      (t) =>
        t.includes('what is') ||
        t.includes('definition') ||
        t.includes('guide to') ||
        t.includes('ultimate guide'),
    )
  ) {
    features.push('featured_snippet');
  }

  // PAA: People Also Ask — most keywords have this
  features.push('people_also_ask');

  // If product pages rank highly, likely shopping results
  if (topResults.slice(0, 5).some((r) => r.contentType === 'product')) {
    features.push('shopping_results');
  }

  // Knowledge panel: if there's wikipedia or .org in top results
  if (
    topResults.some(
      (r) =>
        r.domain.includes('wikipedia.org') ||
        r.domain.includes('wikihow.com'),
    )
  ) {
    features.push('knowledge_panel');
  }

  // Image pack — assume present for competitive keywords
  if (topResults.length >= 8) {
    features.push('image_pack');
  }

  return [...new Set(features)].slice(0, 8);
}

const serpFeatureLabels: Record<string, string> = {
  featured_snippet: 'Featured Snippet',
  video_carousel: 'Video Carousel',
  people_also_ask: 'People Also Ask',
  knowledge_panel: 'Knowledge Panel',
  shopping_results: 'Shopping Results',
  top_stories: 'Top Stories',
  discussions_and_forums: 'Discussions & Forums',
  image_pack: 'Image Pack',
  tools_section: 'Tools Section',
};

/* ─────────────────────────────────────────────
   Keyword Column
   ───────────────────────────────────────────── */

function KeywordColumn({
  data,
  rank,
  sharedDomains,
}: {
  data: SerpCompareKeywordData;
  rank: number;
  sharedDomains: string[];
}) {
  const serpFeatures = getEstimatedSerpFeatures(
    data.topResults,
    data.contentTypeBreakdown,
  );

  return (
    <div className="flex flex-col min-w-0">
      {/* ── Header ── */}
      <div className="rounded-t-xl border border-border/60 bg-surface-raised/80 px-4 py-3 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/[0.12] text-accent text-[10px] font-bold">
            {rank}
          </span>
          <h3
            className="text-body-sm font-semibold text-text-primary truncate"
            title={data.keyword}
          >
            {truncate(data.keyword, 42)}
          </h3>
        </div>
      </div>

      {/* ── Results table ── */}
      <div className="border-x border-border/60 bg-surface overflow-hidden">
        <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-[2] bg-surface-raised">
              <tr className="text-caption text-text-muted border-b border-border/30">
                <th className="px-3 py-1.5 w-8 text-center font-semibold">#</th>
                <th className="px-2 py-1.5 font-semibold">Title / URL</th>
                <th className="px-2 py-1.5 w-20 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {data.topResults.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-caption text-text-muted">
                    No results available
                  </td>
                </tr>
              ) : (
                data.topResults.map((r) => {
                  const shared = isSharedDomain(r.domain, sharedDomains);
                  const ctConfig =
                    contentTypeConfig[r.contentType as ContentTypeKey] ??
                    contentTypeConfig.blog;
                  return (
                    <tr
                      key={`${r.rank}-${r.domain}`}
                      className={cn(
                        'text-[12px] transition-colors',
                        shared
                          ? 'bg-amber-400/[0.06] hover:bg-amber-400/[0.10]'
                          : 'hover:bg-surface-inset/50',
                      )}
                    >
                      <td className="px-3 py-1.5 text-center tabular-nums text-text-muted font-medium">
                        {r.rank}
                      </td>
                      <td className="px-2 py-1.5 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          {shared && (
                            <Eye className="h-3 w-3 shrink-0 text-amber-500" />
                          )}
                          <span
                            className="truncate block font-medium text-text-primary"
                            title={r.title}
                          >
                            {truncate(r.title, 48)}
                          </span>
                        </div>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            'inline-flex items-center gap-0.5 text-[10px] truncate max-w-full mt-0.5 transition-colors',
                            shared
                              ? 'text-amber-500'
                              : 'text-text-muted hover:text-accent',
                          )}
                        >
                          {r.domain}
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${ctConfig.color}18`,
                            color: ctConfig.color,
                            border: `1px solid ${ctConfig.color}33`,
                          }}
                        >
                          {ctConfig.icon}
                          {ctConfig.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Content type breakdown ── */}
      <div className="border-x border-border/60 bg-surface-raised/40 px-4 py-3 space-y-1.5">
        <p className="text-caption font-semibold text-text-secondary flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          Content Type Breakdown
        </p>
        <ContentTypeBar breakdown={data.contentTypeBreakdown} />
      </div>

      {/* ── SERP features ── */}
      <div className="rounded-b-xl border border-border/60 bg-surface-raised/20 px-4 py-3 space-y-1.5">
        <p className="text-caption font-semibold text-text-secondary flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5" />
          SERP Features
        </p>
        {serpFeatures.length === 0 ? (
          <p className="text-caption text-text-muted italic">None detected</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {serpFeatures.map((feat) => (
              <Badge
                key={feat}
                variant="neutral"
                dot={false}
                className="text-[10px] px-1.5 py-0.5"
              >
                {serpFeatureLabels[feat] ?? feat}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Skeleton
   ───────────────────────────────────────────── */

function ColumnSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-[340px] w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */

export default function SERPCompare({
  selectedKeywords,
  onClose,
  className,
}: SERPCompareProps) {
  const [data, setData] = useState<SerpCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = useCallback(async () => {
    if (selectedKeywords.length < 2) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const keywords = selectedKeywords.map((k) => k.primaryKeyword);
      const response = await fetch('/api/keywords/serp-compare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to compare SERPs.');
      }
      setData(result as SerpCompareResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [selectedKeywords]);

  // ── Idle state: prompt to compare
  if (!loading && !data && !error) {
    return (
      <Card padding="md" className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-body font-semibold text-text-primary">
                SERP Comparison
              </h2>
              <p className="text-caption text-text-muted">
                Compare top 10 results side-by-side to spot patterns and opportunities.
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-inset transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedKeywords.map((k) => (
            <div
              key={k.primaryKeyword}
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-inset px-3 py-1.5"
            >
              <span className="text-body-sm font-medium text-text-primary max-w-[220px] truncate">
                {k.primaryKeyword}
              </span>
              {k.searchVolume != null && (
                <span className="text-caption text-text-muted tabular-nums">
                  {formatVolume(k.searchVolume)} vol
                </span>
              )}
              {k.difficulty != null && (
                <DifficultyBadge
                  difficulty={k.difficulty}
                  showLabel={false}
                  className="scale-[0.85]"
                />
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          icon={<ArrowLeftRight className="h-4 w-4" />}
          onClick={handleCompare}
          disabled={selectedKeywords.length < 2}
          className="w-full sm:w-auto"
        >
          Compare {selectedKeywords.length} SERPs
        </Button>
      </Card>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <Card padding="md" className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <h2 className="text-body font-semibold text-text-primary">
              SERP Comparison Failed
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-inset transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] px-4 py-3">
          <p className="text-body-sm text-destructive">{error}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCompare}
        >
          Try Again
        </Button>
      </Card>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <Card padding="md" className={cn('space-y-4', className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <div>
            <h2 className="text-body font-semibold text-text-primary">
              Comparing SERPs…
            </h2>
            <p className="text-caption text-text-muted">
              Fetching top 10 results for{' '}
              {selectedKeywords.map((k) => k.primaryKeyword).join(', ')}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'grid gap-4',
            selectedKeywords.length === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
          )}
        >
          {selectedKeywords.map((k) => (
            <ColumnSkeleton key={k.primaryKeyword} />
          ))}
        </div>
      </Card>
    );
  }

  // ── Results state ──
  const results = data?.results ?? [];
  const sharedDomains = data?.sharedDomains ?? [];
  const opportunities = data?.opportunities ?? [];

  return (
    <Card padding="md" className={cn('space-y-5', className)}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-body font-semibold text-text-primary">
              SERP Comparison
            </h2>
            <p className="text-caption text-text-muted">
              {results.length} keyword{results.length !== 1 ? 's' : ''} ·{' '}
              {sharedDomains.length} shared domain
              {sharedDomains.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCompare}
            loading={loading}
          >
            Refresh
          </Button>
          {onClose && (
            <button
              type="button"
              className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-inset transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Columns ── */}
      <div
        className={cn(
          'grid gap-4',
          results.length === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {results.map((r, i) => (
          <KeywordColumn
            key={r.keyword}
            data={r}
            rank={i + 1}
            sharedDomains={sharedDomains}
          />
        ))}
      </div>

      {/* ── Shared Domains Section ── */}
      {sharedDomains.length > 0 && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.03] px-4 py-3 space-y-2">
          <p className="text-body-sm font-semibold text-text-primary flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-amber-500" />
            Shared Domains
            <Badge variant="warning" dot={false} className="text-[10px] px-1.5 py-0.5">
              {sharedDomains.length}
            </Badge>
          </p>
          <p className="text-caption text-text-muted">
            These domains rank for ALL compared keywords — study their content strategy.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sharedDomains.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/[0.06] px-2.5 py-1 text-[12px] font-medium text-text-primary"
              >
                <Globe className="h-3 w-3 text-amber-500" />
                {domain}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Opportunities Section ── */}
      {opportunities.length > 0 && (
        <div className="rounded-xl border border-accent/15 bg-accent/[0.03] px-4 py-3 space-y-2">
          <p className="text-body-sm font-semibold text-text-primary flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Opportunities & Insights
            <Badge variant="info" dot={false} className="text-[10px] px-1.5 py-0.5">
              {opportunities.length}
            </Badge>
          </p>
          <ul className="space-y-1.5">
            {opportunities.map((opp, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-body-sm text-text-secondary"
              >
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
                <span>{opp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
