'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Globe,
  Info,
  Lightbulb,
  Loader2,
  Search,
  TrendingUp,
} from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import type { ResearchRow } from '@/lib/research';
import {
  type SerpFeature,
  type KeywordSerpFeatures,
  type SerpFeatureOpportunity,
  SERP_FEATURE_META,
  ALL_SERP_FEATURES,
} from '@/lib/serp-features';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

interface SerpFeaturesResult {
  results: KeywordSerpFeatures[];
  summary: {
    mostCommonFeatures: SerpFeature[];
    keywordWithMostFeatures: string;
    totalFeatureTypesFound: number;
    totalKeywordsAnalyzed: number;
    keywordsWithFeatures: number;
  };
}

/* ─────────────────────────────────────────────
   Component for keyword detail panel (expanded view)
   ───────────────────────────────────────────── */

interface SERPFeaturesPanelProps {
  keyword: ResearchRow | null;
  onClose: () => void;
}

export function KeywordSERPFeatureDetail({
  keyword,
}: {
  keyword: ResearchRow;
}) {
  const [data, setData] = useState<KeywordSerpFeatures | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!keyword) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch('/api/keywords/serp-features', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keywords: [keyword.primaryKeyword] }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to load SERP features');
        if (!cancelled && body.results?.length) {
          setData(body.results[0]);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [keyword]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/[0.04]">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
        <p className="text-body-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-body-sm text-text-muted italic">No SERP feature data available.</p>
    );
  }

  const presentSet = new Set(data.features);

  return (
    <div className="space-y-4">
      {/* Feature Legend */}
      <details className="group">
        <summary className="flex items-center gap-1.5 cursor-pointer text-caption text-text-muted hover:text-text-secondary transition-colors">
          <Info className="h-3 w-3" />
          <span>What do these features mean?</span>
        </summary>
        <div className="mt-2 p-3 rounded-lg border border-border/30 bg-surface-raised/50 space-y-1.5">
          {ALL_SERP_FEATURES.map((f) => {
            const meta = SERP_FEATURE_META[f];
            return (
              <div key={f} className="flex items-start gap-2 text-caption">
                <span className="shrink-0 mt-0.5">{meta.icon}</span>
                <div>
                  <span className="font-medium text-text-primary">{meta.label}</span>
                  <span className="text-text-muted"> — {meta.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {/* Detected Features */}
      <div>
        <h4 className="text-caption font-semibold uppercase tracking-wider text-text-muted mb-2">
          Detected SERP Features
        </h4>
        {data.features.length === 0 ? (
          <p className="text-body-sm text-text-muted italic">
            No special SERP features detected for this keyword. Standard organic results only.
          </p>
        ) : (
          <div className="space-y-1.5">
            {ALL_SERP_FEATURES.filter((f) => presentSet.has(f)).map((feature) => {
              const meta = SERP_FEATURE_META[feature];
              return (
                <div
                  key={feature}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-success/20 bg-success/[0.04]"
                >
                  <span className="text-base">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-body-sm font-medium text-text-primary">{meta.label}</span>
                    <p className="text-caption text-text-muted truncate">{meta.description}</p>
                  </div>
                  <Badge variant="success">Present</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Opportunities */}
      {data.opportunities.length > 0 && (
        <div>
          <h4 className="text-caption font-semibold uppercase tracking-wider text-text-muted mb-2">
            You Could Capture
          </h4>
          <div className="space-y-1.5">
            {data.opportunities.map((opp) => {
              const meta = SERP_FEATURE_META[opp.feature];
              return (
                <div
                  key={opp.feature}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-warning/20 bg-warning/[0.04]"
                >
                  <span className="text-base">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-body-sm font-medium text-text-primary">{meta.label}</span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-semibold',
                          opp.difficulty === 'easy'
                            ? 'border-success/30 text-success'
                            : opp.difficulty === 'medium'
                              ? 'border-warning/30 text-warning'
                              : 'border-destructive/30 text-destructive',
                        )}
                      >
                        {opp.difficulty}
                      </span>
                    </div>
                    <p className="text-caption text-text-muted">{opp.action}</p>
                  </div>
                  <Badge variant="warning">Opportunity</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Compact Icon Bar for KeywordTable cell
   ───────────────────────────────────────────── */

interface SerpFeatureIconsProps {
  features: SerpFeature[];
  size?: 'sm' | 'md';
  className?: string;
}

const COMPACT_ICON_ORDER: SerpFeature[] = [
  'featured_snippet',
  'people_also_ask',
  'video_carousel',
  'local_pack',
  'shopping_results',
  'knowledge_panel',
  'image_pack',
  'top_stories',
  'reviews',
  'faq',
  'howto',
];

export function SerpFeatureIcons({ features, size = 'sm', className }: SerpFeatureIconsProps) {
  if (!features.length) {
    return (
      <span className={cn('text-text-muted text-caption italic', className)}>
        <Globe className={cn('inline-block', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      </span>
    );
  }

  const sizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn('inline-flex items-center gap-0.5', sizeClass, className)}
      title={features.map((f) => SERP_FEATURE_META[f].label).join(', ')}
    >
      {COMPACT_ICON_ORDER.filter((f) => features.includes(f)).map((f) => (
        <span key={f} title={SERP_FEATURE_META[f].label} className="leading-none">
          {SERP_FEATURE_META[f].icon}
        </span>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Hover Tooltip for full feature info
   ───────────────────────────────────────────── */

export function SerpFeatureTooltip({ features }: { features: SerpFeature[] }) {
  const [open, setOpen] = useState(false);

  if (!features.length) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center gap-0.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(!open)}
      >
        {COMPACT_ICON_ORDER.filter((f) => features.includes(f)).slice(0, 5).map((f) => (
          <span key={f} className="text-xs leading-none">{SERP_FEATURE_META[f].icon}</span>
        ))}
        {features.length > 5 && (
          <span className="text-[10px] text-text-muted">+{features.length - 5}</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-1 min-w-[180px] rounded-lg border border-border/60 bg-surface shadow-elevation-2 p-2.5 text-left">
          <p className="text-caption font-semibold text-text-secondary mb-1.5">SERP Features</p>
          <div className="space-y-1">
            {features.map((f) => {
              const meta = SERP_FEATURE_META[f];
              return (
                <div key={f} className="flex items-center gap-1.5 text-body-sm">
                  <span className="text-xs">{meta.icon}</span>
                  <span className="text-text-primary">{meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Batch SERP Features Analysis Panel
   (used for "Analyze SERP" bulk action)
   ───────────────────────────────────────────── */

interface SerpFeaturesAnalysisPanelProps {
  keywords: string[];
  onClose: () => void;
  className?: string;
}

export function SerpFeaturesAnalysisPanel({
  keywords,
  onClose,
  className,
}: SerpFeaturesAnalysisPanelProps) {
  const [data, setData] = useState<SerpFeaturesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const analyze = useCallback(async () => {
    if (!keywords.length) return;

    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // Simulate progress since we batch internally
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      const response = await fetch('/api/keywords/serp-features', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords: keywords.slice(0, 50) }),
      });

      clearInterval(progressInterval);

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Analysis failed');

      setData(body);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [keywords]);

  // Auto-start analysis
  useEffect(() => {
    analyze();
  }, [analyze]);

  const featuresFound = data?.results.filter((r) => r.features.length > 0).length ?? 0;
  const totalOpps = data?.results.reduce((sum, r) => sum + r.opportunities.length, 0) ?? 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-accent" />
          <h3 className="text-body font-semibold text-text-primary">
            SERP Feature Analysis
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <div className="w-full max-w-xs">
            <div className="h-1.5 rounded-full bg-surface-inset overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-caption text-text-muted">
            Analyzing {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}…
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/[0.04]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <div>
            <p className="text-body-sm font-medium text-destructive">Analysis failed</p>
            <p className="text-caption text-destructive/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
            <div className="subtle-surface px-3 py-2.5 rounded-lg text-center">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                Keywords
              </p>
              <p className="mt-1 text-body font-bold text-text-primary">
                {data.summary.totalKeywordsAnalyzed}
              </p>
            </div>
            <div className="subtle-surface px-3 py-2.5 rounded-lg text-center">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                w/ Features
              </p>
              <p className="mt-1 text-body font-bold text-text-primary">
                {data.summary.keywordsWithFeatures}
              </p>
            </div>
            <div className="subtle-surface px-3 py-2.5 rounded-lg text-center">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                Feature Types
              </p>
              <p className="mt-1 text-body font-bold text-text-primary">
                {data.summary.totalFeatureTypesFound}
              </p>
            </div>
            <div className="subtle-surface px-3 py-2.5 rounded-lg text-center">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">
                Opportunities
              </p>
              <p className="mt-1 text-body font-bold text-warning">
                {totalOpps}
              </p>
            </div>
          </div>

          {/* Most Common Features */}
          {data.summary.mostCommonFeatures.length > 0 && (
            <div>
              <h4 className="text-caption font-semibold uppercase tracking-wider text-text-muted mb-2">
                Most Common SERP Features
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.summary.mostCommonFeatures.map((feature) => {
                  const meta = SERP_FEATURE_META[feature];
                  const count = data.results.filter((r) => r.features.includes(feature)).length;
                  return (
                    <div
                      key={feature}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-surface-raised px-2.5 py-1 text-caption"
                      title={`${count} keyword${count !== 1 ? 's' : ''} have this feature`}
                    >
                      <span>{meta.icon}</span>
                      <span className="text-text-primary">{meta.label}</span>
                      <span className="text-text-muted font-mono text-[10px]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Most Featured Keyword */}
          {data.summary.keywordWithMostFeatures && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-accent/20 bg-accent/[0.04]">
              <TrendingUp className="h-4 w-4 text-accent shrink-0" />
              <div>
                <p className="text-body-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">
                    "{data.summary.keywordWithMostFeatures}"
                  </span>{' '}
                  has the most SERP features ({data.results.find((r) => r.keyword === data.summary.keywordWithMostFeatures)?.features.length ?? 0})
                </p>
              </div>
            </div>
          )}

          {/* Per-Keyword Results */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {data.results.map((r) => (
              <div
                key={r.keyword}
                className="rounded-lg border border-border/30 bg-surface-raised/50 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-body-sm font-medium text-text-primary truncate">
                    {r.keyword}
                  </span>
                  <span className="text-caption text-text-muted shrink-0">
                    {r.features.length} feature{r.features.length !== 1 ? 's' : ''}
                    {r.opportunities.length > 0 && (
                      <span className="text-warning ml-1">
                        +{r.opportunities.length} opp{r.opportunities.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                </div>
                <SerpFeatureIcons features={r.features} size="md" />
                {r.opportunities.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.opportunities.map((opp) => (
                      <span
                        key={opp.feature}
                        className="inline-flex items-center gap-1 rounded border border-warning/20 bg-warning/[0.04] px-1.5 py-0.5 text-[10px] text-warning"
                        title={opp.action}
                      >
                        {SERP_FEATURE_META[opp.feature].icon} {SERP_FEATURE_META[opp.feature].label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
