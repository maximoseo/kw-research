'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Columns3,
  Filter,
  GripHorizontal,
  LayoutGrid,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Search,
} from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui';
import Sparkline from './Sparkline';
import type { ResearchRow, ResearchIntent } from '@/lib/research';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ViewMode = 'card' | 'table';

export type FilterState = {
  intent: ResearchIntent | 'all';
  search: string;
  volumeMin: number | null;
  volumeMax: number | null;
  difficultyMin: number | null;
  difficultyMax: number | null;
};

const DEFAULT_FILTERS: FilterState = {
  intent: 'all',
  search: '',
  volumeMin: null,
  volumeMax: null,
  difficultyMin: null,
  difficultyMax: null,
};

export type KeywordRow = ResearchRow;

type MobileKeywordViewProps = {
  keywords: KeywordRow[];
  onSelectKeyword: (kw: KeywordRow) => void;
  /** Optional: initial view mode override */
  initialViewMode?: ViewMode;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VIEW_STORAGE_KEY = 'kw-research-mobile-view';

function getStoredView(): ViewMode {
  if (typeof window === 'undefined') return 'card';
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === 'table' ? 'table' : 'card';
  } catch {
    return 'card';
  }
}

function setStoredView(mode: ViewMode) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    // Ignore quota errors
  }
}

const INTENT_COLORS: Record<ResearchIntent, string> = {
  Informational: 'bg-info/[0.08] text-info border-info/20',
  Commercial: 'bg-warning/[0.08] text-warning border-warning/20',
  Transactional: 'bg-success/[0.08] text-success border-success/20',
  Navigational: 'bg-accent/[0.08] text-accent border-accent/20',
};

const INTENTS: ResearchIntent[] = ['Informational', 'Commercial', 'Transactional', 'Navigational'];

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Lightweight toggle switch */
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-border/60',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}

/** Draggable indicator for bottom sheet */
function BottomSheetHandle() {
  return (
    <div className="flex justify-center pt-2 pb-1">
      <GripHorizontal className="h-5 w-8 text-text-muted/40" />
    </div>
  );
}

/** Intent badge for card */
function IntentBadge({ intent }: { intent: ResearchIntent }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold',
        INTENT_COLORS[intent],
      )}
    >
      {intent}
    </span>
  );
}

/** Trend arrow indicator with Sparkline */
function TrendIndicator({ volume }: { volume?: number | null }) {
  // Simulated trend data — in a real app this would come from the API
  // Using a simple static pattern based on volume
  const trendData = useMemo(() => {
    if (!volume) return [];
    const base = volume / 12;
    // Generate a simple sine-wave-ish pattern for visual variety
    return Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      const wave = Math.sin(t * Math.PI * 1.5) * (base * 0.3);
      return Math.max(0, Math.round(base + wave + Math.random() * base * 0.2));
    });
  }, [volume]);

  if (!trendData.length) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Sparkline data={trendData} width={48} height={18} />
    </div>
  );
}

// ─── Card View ───────────────────────────────────────────────────────────────

function KeywordCard({
  keyword,
  isExpanded,
  onToggle,
  onSelect,
}: {
  keyword: KeywordRow;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: (kw: KeywordRow) => void;
}) {
  return (
    <div onClick={() => onSelect(keyword)}>
    <Card
      padding="sm"
      variant="interactive"
      className="w-full min-w-0 cursor-pointer"
    >
      <div className="space-y-2.5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-body font-bold text-text-primary leading-snug break-words line-clamp-2">
              {keyword.primaryKeyword}
            </h3>
            <p className="mt-0.5 text-caption text-text-muted truncate">
              {keyword.pillar} {keyword.cluster ? `→ ${keyword.cluster}` : ''}
            </p>
          </div>
          <IntentBadge intent={keyword.intent} />
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-surface-inset/70 px-2.5 py-1.5 text-center min-w-0">
            <p className="text-caption text-text-muted">Volume</p>
            <p className="mt-0.5 text-body-sm font-semibold tabular-nums text-text-primary truncate">
              {keyword.searchVolume != null ? keyword.searchVolume.toLocaleString() : '—'}
            </p>
          </div>
          <div className="rounded-md bg-surface-inset/70 px-2.5 py-1.5 text-center min-w-0">
            <p className="text-caption text-text-muted">KD</p>
            <p className="mt-0.5 text-body-sm font-semibold tabular-nums text-text-primary truncate">
              {'—'}
            </p>
          </div>
          <div className="rounded-md bg-surface-inset/70 px-2.5 py-1.5 text-center min-w-0">
            <p className="text-caption text-text-muted">CPC</p>
            <p className="mt-0.5 text-body-sm font-semibold tabular-nums text-text-primary truncate">
              {keyword.cpc != null ? `$${keyword.cpc.toFixed(2)}` : '—'}
            </p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-caption text-text-muted hover:text-text-primary hover:bg-surface-inset transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              More
            </>
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="space-y-2.5 pt-1 border-t border-border/30 animate-fade-in">
            {/* Trend */}
            <div className="flex items-center justify-between">
              <span className="text-caption text-text-muted">12-month trend</span>
              <TrendIndicator volume={keyword.searchVolume} />
            </div>
            {/* Additional keywords */}
            {keyword.keywords.length > 0 && (
              <div>
                <p className="text-caption text-text-muted mb-1.5">Related keywords</p>
                <div className="flex flex-wrap gap-1">
                  {keyword.keywords.slice(0, 6).map((kw, i) => (
                    <span
                      key={i}
                      className="inline-block rounded-full border border-border/50 bg-surface-raised px-2 py-0.5 text-[11px] text-text-secondary"
                    >
                      {kw}
                    </span>
                  ))}
                  {keyword.keywords.length > 6 && (
                    <span className="text-caption text-text-muted self-center">
                      +{keyword.keywords.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* Page reference */}
            {keyword.existingParentPage && (
              <div>
                <p className="text-caption text-text-muted mb-0.5">Parent page</p>
                <p className="text-body-sm text-text-secondary truncate" title={keyword.existingParentPage}>
                  {keyword.existingParentPage}
                </p>
              </div>
            )}
            {/* Slug path */}
            {keyword.slugPath && (
              <div>
                <p className="text-caption text-text-muted mb-0.5">Slug</p>
                <p className="text-body-sm font-mono text-[12px] text-text-secondary truncate">
                  {keyword.slugPath}
                </p>
              </div>
            )}
            {/* Notes */}
            {keyword.notes && keyword.notes.length > 0 && (
              <div>
                <p className="text-caption text-text-muted mb-1">Notes</p>
                <ul className="space-y-0.5">
                  {keyword.notes.map((note, i) => (
                    <li key={i} className="text-body-sm text-text-secondary flex gap-1.5">
                      <span className="text-accent mt-1 shrink-0">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
    </div>
  );
}

// ─── Mobile Table View ───────────────────────────────────────────────────────

function MobileTable({
  keywords,
  onSelectKeyword,
}: {
  keywords: KeywordRow[];
  onSelectKeyword: (kw: KeywordRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-raised/60">
      <div className="overflow-x-auto -mx-1 px-1 scrollbar-thin">
        <table className="min-w-[320px] w-full text-left">
          <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
            <tr className="text-text-muted">
              <th className="sticky left-0 z-20 bg-surface-raised px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap shadow-[1px_0_0_hsl(var(--border)/0.5)] min-w-[140px]">
                Keyword
              </th>
              <th className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap text-center min-w-[80px]">
                Volume
              </th>
              <th className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap text-center min-w-[80px]">
                KD
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {keywords.map((row, index) => (
              <tr
                key={`${row.cluster}-${index}`}
                className={cn(
                  'align-middle transition-colors cursor-pointer hover:bg-accent/[0.04] active:bg-accent/[0.08]',
                  index % 2 === 1 && 'bg-surface-inset/30',
                )}
                onClick={() => onSelectKeyword(row)}
              >
                <td
                  className="sticky left-0 z-10 px-2.5 py-3 font-medium text-body-sm text-text-primary truncate max-w-[160px] bg-inherit shadow-[1px_0_0_hsl(var(--border)/0.5)]"
                  title={row.primaryKeyword}
                >
                  <div className="min-w-0">
                    <span className="truncate block">{row.primaryKeyword}</span>
                    <span className="block mt-0.5">
                      <IntentBadge intent={row.intent} />
                    </span>
                  </div>
                </td>
                <td className="px-2.5 py-3 text-center font-mono text-body-sm text-text-secondary tabular-nums">
                  {row.searchVolume != null ? row.searchVolume.toLocaleString() : '—'}
                </td>
                <td className="px-2.5 py-3 text-center font-mono text-body-sm text-text-secondary tabular-nums">
                  {'—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Filter Bottom Sheet ─────────────────────────────────────────────────────

type FilterSheetProps = {
  open: boolean;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClose: () => void;
};

function FilterSheet({ open, filters, onFiltersChange, onClose }: FilterSheetProps) {
  const [local, setLocal] = useState<FilterState>(filters);

  // Sync local state when sheet opens
  useEffect(() => {
    if (open) setLocal(filters);
  }, [open, filters]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleApply = () => {
    onFiltersChange(local);
    onClose();
  };

  const handleReset = () => {
    setLocal(DEFAULT_FILTERS);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border/60 bg-surface shadow-elevation-3 animate-slide-up',
        )}
      >
        <BottomSheetHandle />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-accent" />
            <h2 className="text-heading-3 text-text-primary">Filters</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-inset transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter content */}
        <div className="px-4 pb-6 space-y-5">
          {/* Search */}
          <div>
            <label className="block text-body-sm font-medium text-text-primary mb-1.5">
              Search keyword
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={local.search}
                onChange={(e) => setLocal((s) => ({ ...s, search: e.target.value }))}
                placeholder="Filter by keyword..."
                className="w-full rounded-lg border border-border/60 bg-surface-inset pl-8.5 pr-3 py-2 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent/50"
              />
            </div>
          </div>

          {/* Intent filter */}
          <div>
            <label className="block text-body-sm font-medium text-text-primary mb-2">
              Search intent
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLocal((s) => ({ ...s, intent: 'all' }))}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-caption font-medium transition-colors',
                  local.intent === 'all'
                    ? 'border-accent/40 bg-accent/[0.08] text-accent'
                    : 'border-border/60 bg-surface-raised text-text-secondary hover:border-accent/30',
                )}
              >
                All
              </button>
              {INTENTS.map((intent) => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => setLocal((s) => ({ ...s, intent }))}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-caption font-medium transition-colors',
                    local.intent === intent
                      ? INTENT_COLORS[intent]
                      : 'border-border/60 bg-surface-raised text-text-secondary hover:border-accent/30',
                  )}
                >
                  {intent}
                </button>
              ))}
            </div>
          </div>

          {/* Volume range */}
          <div>
            <label className="block text-body-sm font-medium text-text-primary mb-1.5">
              Volume range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-caption text-text-muted mb-1">Min</label>
                <input
                  type="number"
                  value={local.volumeMin ?? ''}
                  onChange={(e) =>
                    setLocal((s) => ({
                      ...s,
                      volumeMin: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  placeholder="0"
                  min={0}
                  className="w-full rounded-lg border border-border/60 bg-surface-inset px-3 py-2 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-caption text-text-muted mb-1">Max</label>
                <input
                  type="number"
                  value={local.volumeMax ?? ''}
                  onChange={(e) =>
                    setLocal((s) => ({
                      ...s,
                      volumeMax: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  placeholder="∞"
                  min={0}
                  className="w-full rounded-lg border border-border/60 bg-surface-inset px-3 py-2 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent/50"
                />
              </div>
            </div>
          </div>

          {/* Difficulty range */}
          <div>
            <label className="block text-body-sm font-medium text-text-primary mb-1.5">
              KD% range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-caption text-text-muted mb-1">Min</label>
                <input
                  type="number"
                  value={local.difficultyMin ?? ''}
                  onChange={(e) =>
                    setLocal((s) => ({
                      ...s,
                      difficultyMin: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  placeholder="0"
                  min={0}
                  max={100}
                  className="w-full rounded-lg border border-border/60 bg-surface-inset px-3 py-2 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent/50"
                />
              </div>
              <div>
                <label className="block text-caption text-text-muted mb-1">Max</label>
                <input
                  type="number"
                  value={local.difficultyMax ?? ''}
                  onChange={(e) =>
                    setLocal((s) => ({
                      ...s,
                      difficultyMax: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  placeholder="100"
                  min={0}
                  max={100}
                  className="w-full rounded-lg border border-border/60 bg-surface-inset px-3 py-2 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent/50"
                />
              </div>
            </div>
          </div>

          {/* Active filters summary */}
          {(() => {
            const activeCount = [
              local.intent !== 'all',
              local.search.length > 0,
              local.volumeMin != null,
              local.volumeMax != null,
              local.difficultyMin != null,
              local.difficultyMax != null,
            ].filter(Boolean).length;

            if (activeCount > 0) {
              return (
                <div className="rounded-lg border border-accent/15 bg-accent/[0.04] px-3 py-2">
                  <p className="text-caption text-accent font-medium">
                    {activeCount} active filter{activeCount !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            }
            return null;
          })()}

          {/* Action buttons */}
          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleReset}
              className="flex-1"
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleApply}
              className="flex-1"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MobileKeywordView({
  keywords,
  onSelectKeyword,
  initialViewMode,
}: MobileKeywordViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (initialViewMode) return initialViewMode;
    return getStoredView();
  });
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // Persist view mode
  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setStoredView(mode);
  }, []);

  // Filter keywords
  const filteredKeywords = useMemo(() => {
    return keywords.filter((kw) => {
      // Intent filter
      if (filters.intent !== 'all' && kw.intent !== filters.intent) return false;

      // Search filter (case-insensitive)
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesKeyword = kw.primaryKeyword.toLowerCase().includes(q);
        const matchesPillar = kw.pillar.toLowerCase().includes(q);
        const matchesCluster = kw.cluster.toLowerCase().includes(q);
        const matchesAnyTag = kw.keywords.some((k) => k.toLowerCase().includes(q));
        if (!matchesKeyword && !matchesPillar && !matchesCluster && !matchesAnyTag) return false;
      }

      // Volume range
      if (filters.volumeMin != null && (kw.searchVolume == null || kw.searchVolume < filters.volumeMin)) return false;
      if (filters.volumeMax != null && kw.searchVolume != null && kw.searchVolume > filters.volumeMax) return false;

      return true;
    });
  }, [keywords, filters]);

  const toggleCard = useCallback((index: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    return [
      filters.intent !== 'all',
      filters.search.length > 0,
      filters.volumeMin != null,
      filters.volumeMax != null,
      filters.difficultyMin != null,
      filters.difficultyMax != null,
    ].filter(Boolean).length;
  }, [filters]);

  return (
    <div className="space-y-3">
      {/* Toolbar: view toggle + filter button + result count */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-raised px-2.5 py-1.5">
            <LayoutGrid
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                viewMode === 'card' ? 'text-accent' : 'text-text-muted',
              )}
            />
            <Switch
              checked={viewMode === 'table'}
              onChange={(checked) => handleViewChange(checked ? 'table' : 'card')}
            />
            <Columns3
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                viewMode === 'table' ? 'text-accent' : 'text-text-muted',
              )}
            />
          </div>

          {/* Filter button */}
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-caption font-medium transition-colors',
              activeFilterCount > 0
                ? 'border-accent/40 bg-accent/[0.08] text-accent'
                : 'border-border/60 bg-surface-raised text-text-secondary hover:border-accent/30 hover:text-text-primary',
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Result count */}
        <span className="text-caption text-text-muted shrink-0">
          {filteredKeywords.length} keyword{filteredKeywords.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.intent !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/[0.06] px-2 py-0.5 text-[11px] font-medium text-accent">
              {filters.intent}
              <button
                type="button"
                onClick={() => setFilters((s) => ({ ...s, intent: 'all' }))}
                className="ml-0.5 hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.search && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/[0.06] px-2 py-0.5 text-[11px] font-medium text-accent">
              &quot;{filters.search}&quot;
              <button
                type="button"
                onClick={() => setFilters((s) => ({ ...s, search: '' }))}
                className="ml-0.5 hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.volumeMin != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/[0.06] px-2 py-0.5 text-[11px] font-medium text-accent">
              Vol ≥ {filters.volumeMin.toLocaleString()}
              <button
                type="button"
                onClick={() => setFilters((s) => ({ ...s, volumeMin: null }))}
                className="ml-0.5 hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.volumeMax != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/[0.06] px-2 py-0.5 text-[11px] font-medium text-accent">
              Vol ≤ {filters.volumeMax.toLocaleString()}
              <button
                type="button"
                onClick={() => setFilters((s) => ({ ...s, volumeMax: null }))}
                className="ml-0.5 hover:text-text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Content area */}
      {filteredKeywords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-8 w-8 text-text-muted/40 mb-3" />
          <p className="text-body font-medium text-text-primary">No keywords match</p>
          <p className="mt-1 text-caption text-text-muted">
            Try adjusting your filters or clearing the search.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="mt-3"
          >
            Clear all filters
          </Button>
        </div>
      ) : viewMode === 'card' ? (
        /* Card view */
        <div className="grid gap-3">
          {filteredKeywords.map((kw, i) => (
            <KeywordCard
              key={`${kw.cluster}-${kw.primaryKeyword}-${i}`}
              keyword={kw}
              isExpanded={expandedCards.has(i)}
              onToggle={() => toggleCard(i)}
              onSelect={onSelectKeyword}
            />
          ))}
        </div>
      ) : (
        /* Mobile table view */
        <MobileTable
          keywords={filteredKeywords}
          onSelectKeyword={onSelectKeyword}
        />
      )}

      {/* Filter bottom sheet */}
      <FilterSheet
        open={filtersOpen}
        filters={filters}
        onFiltersChange={setFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}
