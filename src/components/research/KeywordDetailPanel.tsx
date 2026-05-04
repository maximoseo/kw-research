'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BarChart3, ExternalLink, HelpCircle, Lightbulb, Link2, Search, X } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import type { ResearchRow } from '@/lib/research';
import type { KeywordDetail, SerpResult, ContentTypeDistribution } from '@/app/api/keywords/[id]/details/route';

interface KeywordDetailPanelProps {
  keyword: ResearchRow | null;
  runId: string | null;
  onClose: () => void;
}

// ── Intent badge styling, matching ResearchDashboard ──
const intentStyles: Record<string, string> = {
  Informational: 'bg-info/[0.08] text-info border-info/20',
  Commercial: 'bg-warning/[0.08] text-warning border-warning/20',
  Transactional: 'bg-success/[0.08] text-success border-success/20',
  Navigational: 'bg-accent/[0.08] text-accent border-accent/20',
};

// ── Content type badge styling ──
const contentTypeStyles: Record<string, string> = {
  blog: 'bg-accent/[0.08] text-accent border-accent/20',
  product: 'bg-success/[0.08] text-success border-success/20',
  video: 'bg-destructive/[0.08] text-destructive border-destructive/20',
  forum: 'bg-warning/[0.08] text-warning border-warning/20',
  news: 'bg-info/[0.08] text-info border-info/20',
  tool: 'bg-purple-500/[0.08] text-purple-500 border-purple-500/20',
};

const contentTypeLabels: Record<string, string> = {
  blog: 'Blog',
  product: 'Product',
  video: 'Video',
  forum: 'Forum',
  news: 'News',
  tool: 'Tool',
};

// ── SERP types (from the serp API) ──
interface SerpApiResult {
  position: number;
  url: string;
  title: string;
  snippet: string;
  content_type: string;
  domain: string;
}

interface SerpDistribution {
  type: string;
  count: number;
  label: string;
}

interface SerpApiResponse {
  results: SerpApiResult[];
  distribution: SerpDistribution[];
  missingTypes: string[];
  fetchedAt: number;
}

function formatVolume(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatCPC(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${n.toFixed(2)}`;
}

// ── Skeleton components ──

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

function ContentTypeBarSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

// ── Content Type Bar component ──

function ContentTypeBars({ data }: { data: ContentTypeDistribution[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const colors = [
    'bg-accent',
    'bg-info',
    'bg-success',
    'bg-warning',
    'bg-destructive/60',
    'bg-accent/60',
    'bg-info/50',
    'bg-text-muted/30',
  ];

  return (
    <div className="space-y-2.5">
      {data.map((item, i) => {
        const pct = Math.round((item.count / max) * 100);
        return (
          <div key={item.type} className="flex items-center gap-2 text-body-sm">
            <span className="w-20 shrink-0 text-text-secondary truncate" title={item.type}>
              {item.type}
            </span>
            <div className="flex-1 h-5 rounded bg-surface-inset overflow-hidden">
              <div
                className={cn('h-full rounded transition-all duration-500', colors[i % colors.length])}
                style={{ width: `${pct}%`, opacity: 0.15 + (pct / 100) * 0.85 }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-text-muted text-caption">
              {item.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── SERP result item (original /details endpoint format) ──

function SerpItem({ result }: { result: SerpResult }) {
  return (
    <div className="border-b border-border/30 last:border-b-0 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-surface-inset flex items-center justify-center text-[10px] font-mono text-text-muted">
          {result.position}
        </span>
        <div className="min-w-0">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="text-body-sm font-medium text-accent hover:underline line-clamp-1"
          >
            {result.title}
          </a>
          <p className="mt-0.5 text-caption text-text-muted line-clamp-1">{result.url}</p>
          <p className="mt-1 text-body-sm text-text-secondary line-clamp-2">{result.snippet}</p>
        </div>
      </div>
    </div>
  );
}

// ── SERP result item with content type badge (real SERP data) ──

function SerpItemWithBadge({ result }: { result: SerpApiResult }) {
  return (
    <div className="border-b border-border/30 last:border-b-0 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-surface-inset flex items-center justify-center text-[10px] font-mono text-text-muted">
          {result.position}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-body-sm font-medium text-accent hover:underline line-clamp-1 min-w-0"
            >
              {result.title}
            </a>
            <span
              className={cn(
                'shrink-0 inline-flex items-center rounded border px-1.5 py-px text-[9px] font-semibold',
                contentTypeStyles[result.content_type] || 'bg-border/10 text-text-muted',
              )}
            >
              {contentTypeLabels[result.content_type] || result.content_type}
            </span>
          </div>
          <p className="mt-0.5 text-caption text-text-muted line-clamp-1">{result.domain}</p>
          <p className="mt-1 text-body-sm text-text-secondary line-clamp-2">{result.snippet}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main panel component ──

export default function KeywordDetailPanel({ keyword, runId, onClose }: KeywordDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<KeywordDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus trap: focus panel when opened
  useEffect(() => {
    if (keyword && panelRef.current) {
      panelRef.current.focus();
    }
  }, [keyword]);

  // Close on click outside
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  // ── Separate state for SERP (real data) vs details (generated data) ──
  const [serpData, setSerpData] = useState<SerpApiResponse | null>(null);
  const [serpLoading, setSerpLoading] = useState(false);
  const [serpError, setSerpError] = useState<string | null>(null);

  // Fetch detail data (generated content: related keywords, questions, etc.)
  useEffect(() => {
    if (!keyword || !runId) {
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    const encodedKeyword = encodeURIComponent(keyword.primaryKeyword);
    fetch(`/api/keywords/${encodedKeyword}/details?runId=${encodeURIComponent(runId)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to load details');
        if (!cancelled) {
          setData(body);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load details');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [keyword, runId]);

  // Fetch real SERP data
  useEffect(() => {
    if (!keyword) {
      setSerpData(null);
      setSerpError(null);
      return;
    }

    let cancelled = false;
    setSerpLoading(true);
    setSerpError(null);
    setSerpData(null);

    const encoded = encodeURIComponent(keyword.primaryKeyword);
    fetch(`/api/keywords/serp?keyword=${encoded}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to load SERP data');
        if (!cancelled) {
          setSerpData(body);
          setSerpLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSerpError(err instanceof Error ? err.message : 'Failed to load SERP data');
          setSerpLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [keyword]);

  if (!keyword) return null;

  const isOpen = !!keyword;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`Details for ${keyword.primaryKeyword}`}
        className={cn(
          'fixed z-50 bg-surface border-l border-border/50 shadow-elevation-3',
          'flex flex-col overflow-hidden',
          // Desktop: slide-in right panel
          'right-0 top-0 h-full w-[400px]',
          'max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[85vh] max-md:w-full max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0 max-md:translate-y-0' : 'translate-x-full max-md:translate-y-full',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/40 bg-surface-raised shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-heading-3 text-text-primary truncate">{keyword.primaryKeyword}</h2>
              <span
                className={cn(
                  'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold shrink-0',
                  intentStyles[keyword.intent] || 'bg-border/10 text-text-muted',
                )}
              >
                {keyword.intent}
              </span>
            </div>
            <p className="mt-1 text-caption text-text-muted truncate">
              {keyword.pillar} / {keyword.cluster}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-inset transition-colors cursor-pointer min-h-tap"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-5 py-4 space-y-6">
            {/* ── Metrics Summary ── */}
            <section>
              <h3 className="text-caption font-semibold uppercase tracking-wider text-text-muted mb-3">
                Metrics
              </h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="subtle-surface px-3 py-2.5 text-center rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Volume</p>
                  <p className="mt-1 text-body font-bold text-text-primary">{formatVolume(keyword.searchVolume)}</p>
                </div>
                <div className="subtle-surface px-3 py-2.5 text-center rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">CPC</p>
                  <p className="mt-1 text-body font-bold text-text-primary">{formatCPC(keyword.cpc)}</p>
                </div>
                <div className="subtle-surface px-3 py-2.5 text-center rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Difficulty</p>
                  <p className="mt-1 text-body font-bold text-text-primary">
                    {keyword.searchVolume != null
                      ? keyword.searchVolume > 5000
                        ? 'Hard'
                        : keyword.searchVolume > 1000
                          ? 'Medium'
                          : 'Easy'
                      : '—'}
                  </p>
                </div>
                <div className="subtle-surface px-3 py-2.5 text-center rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">Keywords</p>
                  <p className="mt-1 text-body font-bold text-text-primary">{keyword.keywords.length}</p>
                </div>
              </div>
            </section>

            {/* ── SERP Preview (Real Data) ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-3.5 w-3.5 text-text-muted" />
                <h3 className="text-caption font-semibold uppercase tracking-wider text-text-muted">
                  SERP Results
                </h3>
              </div>
              {serpLoading ? (
                <SectionSkeleton rows={6} />
              ) : serpError ? (
                <div>
                  <p className="text-body-sm text-destructive mb-2">{serpError}</p>
                  {/* Fallback to generated SERP if real fails */}
                  {data?.serpResults.length ? (
                    <div className="rounded-lg border border-border/40 bg-surface-raised/50 px-3 divide-y divide-border/20">
                      {data.serpResults.map((r, i) => (
                        <SerpItem key={i} result={r} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : serpData?.results.length ? (
                <div className="rounded-lg border border-border/40 bg-surface-raised/50 px-3 divide-y divide-border/20">
                  {serpData.results.map((r, i) => (
                    <SerpItemWithBadge key={i} result={r} />
                  ))}
                </div>
              ) : data?.serpResults.length ? (
                <div className="rounded-lg border border-border/40 bg-surface-raised/50 px-3 divide-y divide-border/20">
                  {data.serpResults.map((r, i) => (
                    <SerpItem key={i} result={r} />
                  ))}
                </div>
              ) : (
                <p className="text-body-sm text-text-muted italic">No SERP data available.</p>
              )}
            </section>

            {/* ── Content Type Distribution (Real Data) ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-3.5 w-3.5 text-text-muted" />
                <h3 className="text-caption font-semibold uppercase tracking-wider text-text-muted">
                  Content Types Ranking
                </h3>
              </div>
              {serpLoading ? (
                <ContentTypeBarSkeleton />
              ) : serpData?.distribution.length ? (
                <ContentTypeBars data={serpData.distribution} />
              ) : data?.contentTypes.length ? (
                <ContentTypeBars data={data.contentTypes} />
              ) : (
                <p className="text-body-sm text-text-muted italic">No distribution data.</p>
              )}

              {/* ── Opportunity Insight ── */}
              {serpData?.missingTypes && serpData.missingTypes.length > 0 && (
                <div className="mt-3 p-3 rounded-lg border border-warning/30 bg-warning/[0.04]">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                    <div>
                      <p className="text-body-sm font-medium text-warning">Content Gap Opportunity</p>
                      <p className="mt-0.5 text-caption text-text-secondary">
                        No{' '}
                        {serpData.missingTypes.map((t, i) => (
                          <span key={t}>
                            <span className="text-text-primary font-medium">
                              {contentTypeLabels[t] || t}
                            </span>
                            {i < serpData.missingTypes.length - 2 ? ', ' : i === serpData.missingTypes.length - 2 ? ' or ' : ''}
                          </span>
                        ))}{' '}
                        content in top 10. Creating content in this format could be easier to rank.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ── Related Keywords ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="h-3.5 w-3.5 text-text-muted" />
                <h3 className="text-caption font-semibold uppercase tracking-wider text-text-muted">
                  Related Keywords
                </h3>
              </div>
              {loading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-24 rounded-full" />
                  ))}
                </div>
              ) : data?.relatedKeywords.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.relatedKeywords.map((rk) => (
                    <span
                      key={rk}
                      className="inline-flex items-center rounded-full border border-border/40 bg-surface-raised px-2.5 py-1 text-[11px] text-text-secondary"
                    >
                      {rk}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm text-text-muted italic">No related keywords.</p>
              )}
            </section>

            {/* ── Questions (People Also Ask) ── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="h-3.5 w-3.5 text-text-muted" />
                <h3 className="text-caption font-semibold uppercase tracking-wider text-text-muted">
                  People Also Ask
                </h3>
              </div>
              {loading ? (
                <SectionSkeleton rows={4} />
              ) : data?.questions.length ? (
                <ul className="space-y-2">
                  {data.questions.map((q) => (
                    <li
                      key={q}
                      className="flex items-start gap-2 text-body-sm text-text-secondary px-3 py-2 rounded-lg border border-border/30 bg-surface-raised/40"
                    >
                      <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-text-muted" />
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-text-muted italic">No questions found.</p>
              )}
            </section>
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div className="shrink-0 border-t border-border/40 bg-surface-raised px-5 py-3">
          <Button
            variant="primary"
            size="md"
            icon={<ArrowRight className="h-4 w-4" />}
            className="w-full"
            onClick={() => {
              // Placeholder — Add to Campaign would integrate with campaign features
              // For now, just open the parent page if available
              if (keyword.existingParentPageUrl) {
                window.open(keyword.existingParentPageUrl, '_blank');
              }
            }}
          >
            Add to Campaign
          </Button>
        </div>
      </div>
    </>
  );
}
