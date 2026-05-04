'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ExternalLink,
  Link2,
  Link2Off,
  Loader2,
  MapPin,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Metric } from '@/components/ui';
import Dialog from '@/components/ui/Dialog';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type { ResearchRow } from '@/lib/research';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

type ContentMapEntry = {
  id: string;
  userId: string;
  keywordId: string;
  pageUrl: string;
  pageTitle: string | null;
  mappedAt: number;
};

type PageGroup = {
  pageUrl: string;
  pageTitle: string | null;
  keywordCount: number;
  keywordIds: string[];
};

type PageStat = PageGroup & {
  combinedVolume: number;
  avgDifficulty: number;
};

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function buildKeywordId(row: ResearchRow): string {
  // Use a combination of pillar+cluster+primaryKeyword as stable identifier
  return `${row.pillar || 'no-pillar'}::${row.cluster || 'no-cluster'}::${row.primaryKeyword || 'no-kw'}`;
}

function getUniquePagesFromMappings(mappings: ContentMapEntry[]): { url: string; title: string | null }[] {
  const seen = new Map<string, { url: string; title: string | null }>();
  for (const m of mappings) {
    if (!seen.has(m.pageUrl)) {
      seen.set(m.pageUrl, { url: m.pageUrl, title: m.pageTitle });
    } else if (!seen.get(m.pageUrl)!.title && m.pageTitle) {
      seen.get(m.pageUrl)!.title = m.pageTitle;
    }
  }
  return Array.from(seen.values());
}

/* ─────────────────────────────────────────────
   Map Dialog
   ───────────────────────────────────────────── */

function MapDialog({
  open,
  onClose,
  keyword,
  existingPages,
  existingMapping,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  keyword: ResearchRow;
  existingPages: { url: string; title: string | null }[];
  existingMapping: ContentMapEntry | null;
  onSave: (pageUrl: string, pageTitle?: string) => void;
  saving: boolean;
}) {
  const [pageUrl, setPageUrl] = useState(existingMapping?.pageUrl ?? '');
  const [pageTitle, setPageTitle] = useState(existingMapping?.pageTitle ?? '');
  const [useDropdown, setUseDropdown] = useState(existingPages.length > 0);

  const handleSave = () => {
    if (!pageUrl.trim()) return;
    onSave(pageUrl.trim(), pageTitle.trim() || undefined);
  };

  const handleDropdownSelect = (url: string, title: string | null) => {
    setPageUrl(url);
    setPageTitle(title ?? '');
  };

  return (
    <Dialog open={open} onClose={onClose} title={existingMapping ? 'Update Page Mapping' : 'Map to Page'} maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Keyword info */}
        <div className="rounded-lg border border-border/40 bg-surface-inset/40 px-3 py-2.5">
          <p className="text-caption text-text-muted uppercase tracking-wider">Keyword</p>
          <p className="mt-0.5 text-body font-medium text-text-primary">{keyword.primaryKeyword}</p>
          <p className="text-caption text-text-secondary mt-0.5">
            {keyword.pillar} &middot; {keyword.cluster}
            {keyword.searchVolume != null && <> &middot; Vol: {keyword.searchVolume.toLocaleString()}</>}
          </p>
        </div>

        {/* Toggle input method when existing pages exist */}
        {existingPages.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(
                'text-caption font-medium px-3 py-1.5 rounded-md transition-colors',
                !useDropdown ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary',
              )}
              onClick={() => setUseDropdown(false)}
            >
              Enter URL
            </button>
            <button
              type="button"
              className={cn(
                'text-caption font-medium px-3 py-1.5 rounded-md transition-colors',
                useDropdown ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-primary',
              )}
              onClick={() => setUseDropdown(true)}
            >
              Select existing
            </button>
          </div>
        )}

        {/* URL input or dropdown */}
        {useDropdown && existingPages.length > 0 ? (
          <div className="space-y-1.5">
            <label className="text-body-sm font-medium text-text-primary">Select a page</label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border/40 divide-y divide-border/20">
              {existingPages.map((page) => (
                <button
                  key={page.url}
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2.5 transition-colors hover:bg-surface-inset',
                    pageUrl === page.url && 'bg-accent/[0.06] ring-1 ring-inset ring-accent/20',
                  )}
                  onClick={() => handleDropdownSelect(page.url, page.title)}
                >
                  <p className="text-body-sm font-medium text-text-primary truncate">{page.title || page.url}</p>
                  <p className="text-caption text-text-muted truncate">{page.url}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-body-sm font-medium text-text-primary" htmlFor="cm-page-url">
                Page URL
              </label>
              <input
                id="cm-page-url"
                type="url"
                className="field-input"
                placeholder="https://yoursite.com/page-path"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-body-sm font-medium text-text-primary" htmlFor="cm-page-title">
                Page Title (optional)
              </label>
              <input
                id="cm-page-title"
                type="text"
                className="field-input"
                placeholder="e.g. Best Running Shoes 2024"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              />
            </div>
          </>
        )}

        {/* Existing mapping warning */}
        {existingMapping && (
          <Alert variant="warning" title="Already mapped">
            This keyword is currently mapped to:{' '}
            <span className="font-medium">{existingMapping.pageTitle || existingMapping.pageUrl}</span>.
            Saving will update the mapping.
          </Alert>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Link2 className="h-3.5 w-3.5" />}
            loading={saving}
            disabled={!pageUrl.trim() || saving}
            onClick={handleSave}
          >
            {existingMapping ? 'Update Mapping' : 'Map to Page'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */

interface ContentMapProps {
  keywords: ResearchRow[];
  projectId: string;
}

export default function ContentMap({ keywords, projectId }: ContentMapProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'pages' | 'unmapped'>('pages');
  const [mapKeyword, setMapKeyword] = useState<ResearchRow | null>(null);
  const [saving, setSaving] = useState(false);

  /* ── Data fetching ── */
  const mappingsQuery = useQuery({
    queryKey: ['content-map', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/content-map`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load mappings.');
      return data.mappings as ContentMapEntry[];
    },
  });

  const mappings = mappingsQuery.data ?? [];
  const isLoading = mappingsQuery.isLoading;
  const isError = mappingsQuery.isError;

  /* ── Determine mapped/unmapped ── */
  const mappedKeywordIds = useMemo(
    () => new Set(mappings.map((m) => m.keywordId)),
    [mappings],
  );

  const unmappedKeywords = useMemo(
    () => keywords.filter((kw) => !mappedKeywordIds.has(buildKeywordId(kw))),
    [keywords, mappedKeywordIds],
  );

  /* ── Build page stats ── */
  const pageStats = useMemo((): PageStat[] => {
    const pageMap = new Map<string, PageGroup>();

    for (const m of mappings) {
      const existing = pageMap.get(m.pageUrl);
      if (existing) {
        existing.keywordCount++;
        existing.keywordIds.push(m.keywordId);
        if (!existing.pageTitle && m.pageTitle) {
          existing.pageTitle = m.pageTitle;
        }
      } else {
        pageMap.set(m.pageUrl, {
          pageUrl: m.pageUrl,
          pageTitle: m.pageTitle,
          keywordCount: 1,
          keywordIds: [m.keywordId],
        });
      }
    }

    return Array.from(pageMap.entries()).map(([url, group]) => {
      // Calculate volume and difficulty from keyword data
      const matchedKeywords = group.keywordIds
        .map((kid) => keywords.find((kw) => buildKeywordId(kw) === kid))
        .filter(Boolean) as ResearchRow[];

      const volumes = matchedKeywords.map((k) => k.searchVolume ?? 0);
      const difficulties = matchedKeywords
        .map((k) => (k as ResearchRow & { difficulty?: number }).difficulty)
        .filter((d): d is number => d != null);

      const combinedVolume = volumes.reduce((sum, v) => sum + v, 0);
      const avgDifficulty =
        difficulties.length > 0
          ? Math.round(difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length)
          : 0;

      return {
        ...group,
        combinedVolume,
        avgDifficulty,
      };
    });
  }, [mappings, keywords]);

  /* ── Handlers ── */
  const handleMapSave = useCallback(
    async (pageUrl: string, pageTitle?: string) => {
      if (!mapKeyword) return;
      setSaving(true);
      try {
        const keywordId = buildKeywordId(mapKeyword);
        const res = await fetch('/api/content-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywordId, pageUrl, pageTitle }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to map keyword.');
        addToast('Keyword mapped successfully.', 'success');
        setMapKeyword(null);
        await queryClient.invalidateQueries({ queryKey: ['content-map', projectId] });
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Failed to map keyword.', 'error');
      } finally {
        setSaving(false);
      }
    },
    [mapKeyword, projectId, addToast, queryClient],
  );

  const handleRemoveMapping = useCallback(
    async (mappingId: string) => {
      try {
        const res = await fetch(`/api/content-map?id=${encodeURIComponent(mappingId)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove mapping.');
        addToast('Mapping removed.', 'success');
        await queryClient.invalidateQueries({ queryKey: ['content-map', projectId] });
      } catch (err) {
        addToast(err instanceof Error ? err.message : 'Failed to remove mapping.', 'error');
      }
    },
    [projectId, addToast, queryClient],
  );

  const getMappingForKeyword = useCallback(
    (keyword: ResearchRow): ContentMapEntry | null => {
      const kid = buildKeywordId(keyword);
      return mappings.find((m) => m.keywordId === kid) ?? null;
    },
    [mappings],
  );

  const existingPages = useMemo(
    () => getUniquePagesFromMappings(mappings),
    [mappings],
  );

  /* ── Loading / Error states ── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="ml-3 text-body text-text-secondary">Loading content map...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Link2Off className="h-8 w-8 text-text-muted" />}
        title="Failed to load content map"
        description="There was an error loading the content mappings. Please try again."
        action={{
          label: 'Retry',
          onClick: () => queryClient.invalidateQueries({ queryKey: ['content-map', projectId] }),
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-enter">
      {/* ── Header with stats ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Content Map</p>
          <h2 className="mt-1 text-heading-2 text-text-primary">Keyword-to-Page Assignments</h2>
          <p className="mt-1 text-body text-text-secondary">
            Assign keywords to specific pages and track coverage.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="info" dot>
            {mappings.length} mapped
          </Badge>
          <Badge variant="warning" dot>
            {unmappedKeywords.length} unmapped
          </Badge>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-surface-inset/30 p-1 w-fit">
        <button
          type="button"
          className={cn(
            'rounded-md px-4 py-2 text-body-sm font-medium transition-all cursor-pointer',
            activeTab === 'pages'
              ? 'bg-surface shadow-sm text-text-primary'
              : 'text-text-muted hover:text-text-primary',
          )}
          onClick={() => setActiveTab('pages')}
        >
          <MapPin className="h-3.5 w-3.5 inline mr-1.5" />
          Mapped Pages
          {pageStats.length > 0 && (
            <span className="ml-1.5 text-caption text-text-muted">({pageStats.length})</span>
          )}
        </button>
        <button
          type="button"
          className={cn(
            'rounded-md px-4 py-2 text-body-sm font-medium transition-all cursor-pointer',
            activeTab === 'unmapped'
              ? 'bg-surface shadow-sm text-text-primary'
              : 'text-text-muted hover:text-text-primary',
          )}
          onClick={() => setActiveTab('unmapped')}
        >
          <Target className="h-3.5 w-3.5 inline mr-1.5" />
          Unmapped Keywords
          {unmappedKeywords.length > 0 && (
            <span className="ml-1.5 text-caption text-text-muted">({unmappedKeywords.length})</span>
          )}
        </button>
      </div>

      {/* ── Content ── */}
      {activeTab === 'pages' ? (
        <PagesView
          pageStats={pageStats}
          mappings={mappings}
          keywords={keywords}
          onRemoveMapping={handleRemoveMapping}
          onMapKeyword={(kw) => setMapKeyword(kw)}
          getMappingForKeyword={getMappingForKeyword}
        />
      ) : (
        <UnmappedView
          keywords={unmappedKeywords}
          onMapKeyword={(kw) => setMapKeyword(kw)}
          getMappingForKeyword={getMappingForKeyword}
        />
      )}

      {/* ── Map Dialog ── */}
      {mapKeyword && (
        <MapDialog
          open={!!mapKeyword}
          onClose={() => setMapKeyword(null)}
          keyword={mapKeyword}
          existingPages={existingPages}
          existingMapping={getMappingForKeyword(mapKeyword)}
          onSave={handleMapSave}
          saving={saving}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Pages View
   ───────────────────────────────────────────── */

function PagesView({
  pageStats,
  mappings,
  keywords,
  onRemoveMapping,
  onMapKeyword,
  getMappingForKeyword,
}: {
  pageStats: PageStat[];
  mappings: ContentMapEntry[];
  keywords: ResearchRow[];
  onRemoveMapping: (mappingId: string) => void;
  onMapKeyword: (kw: ResearchRow) => void;
  getMappingForKeyword: (kw: ResearchRow) => ContentMapEntry | null;
}) {
  if (pageStats.length === 0) {
    return (
      <EmptyState
        icon={<MapPin className="h-8 w-8 text-text-muted" />}
        title="No pages mapped yet"
        description="Assign keywords to pages to see them grouped here."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {pageStats.map((page) => {
        const pageMappings = mappings.filter((m) => m.pageUrl === page.pageUrl);
        const pageKeywords = pageMappings
          .map((m) => keywords.find((kw) => buildKeywordId(kw) === m.keywordId))
          .filter(Boolean) as ResearchRow[];

        return (
          <Card key={page.pageUrl} className="space-y-4">
            {/* Page header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-heading-3 text-text-primary truncate" title={page.pageTitle || page.pageUrl}>
                  {page.pageTitle || page.pageUrl}
                </h3>
                <a
                  href={page.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-caption text-text-muted hover:text-accent transition-colors truncate max-w-full"
                  title={page.pageUrl}
                >
                  <span className="truncate">{page.pageUrl}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
              <Badge variant="info" dot={false}>
                {page.keywordCount} keywords
              </Badge>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Combined Volume"
                value={page.combinedVolume.toLocaleString()}
                helper="Total monthly searches"
                compact
              />
              <Metric
                label="Avg Difficulty"
                value={String(page.avgDifficulty)}
                helper="Average keyword difficulty"
                compact
              />
            </div>

            {/* Mapped keywords list */}
            <div className="space-y-1.5">
              <p className="text-caption font-semibold text-text-muted uppercase tracking-wider">
                Mapped Keywords
              </p>
              <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border/30 divide-y divide-border/20">
                {pageKeywords.length === 0 ? (
                  <div className="px-3 py-4 text-center text-body-sm text-text-muted">
                    No keyword data loaded for this page.
                  </div>
                ) : (
                  pageKeywords.map((kw, idx) => {
                    const mapping = getMappingForKeyword(kw);
                    return (
                      <div
                        key={`${kw.primaryKeyword}-${idx}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface-inset/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-body-sm font-medium text-text-primary truncate" title={kw.primaryKeyword}>
                            {kw.primaryKeyword}
                          </p>
                          <p className="text-caption text-text-muted truncate">
                            {kw.pillar} &middot; {kw.cluster}
                            {kw.searchVolume != null && <> &middot; Vol: {kw.searchVolume.toLocaleString()}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="rounded p-1 text-text-muted hover:text-accent hover:bg-accent/[0.06] transition-colors"
                            title="Reassign"
                            onClick={() => onMapKeyword(kw)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          {mapping && (
                            <button
                              type="button"
                              className="rounded p-1 text-text-muted hover:text-red-500 hover:bg-red-500/[0.06] transition-colors"
                              title="Remove mapping"
                              onClick={() => onRemoveMapping(mapping.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Unmapped View
   ───────────────────────────────────────────── */

function UnmappedView({
  keywords,
  onMapKeyword,
  getMappingForKeyword,
}: {
  keywords: ResearchRow[];
  onMapKeyword: (kw: ResearchRow) => void;
  getMappingForKeyword: (kw: ResearchRow) => ContentMapEntry | null;
}) {
  if (keywords.length === 0) {
    return (
      <EmptyState
        icon={<Target className="h-8 w-8 text-success" />}
        title="All keywords mapped!"
        description="Every keyword in this project is assigned to a page. Great coverage!"
      />
    );
  }

  // Group unmapped by pillar for easier navigation
  const byPillar = useMemo(() => {
    const map = new Map<string, ResearchRow[]>();
    for (const kw of keywords) {
      const pillar = kw.pillar || 'Uncategorized';
      const existing = map.get(pillar);
      if (existing) {
        existing.push(kw);
      } else {
        map.set(pillar, [kw]);
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [keywords]);

  return (
    <div className="space-y-6">
      <Alert variant="warning" title={`${keywords.length} Unmapped Keywords`}>
        These keywords haven&apos;t been assigned to any page yet. Map them to track content coverage.
      </Alert>

      {byPillar.map(([pillar, kws]) => (
        <div key={pillar} className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-body font-semibold text-text-primary">{pillar}</h3>
            <Badge variant="neutral" dot={false}>
              {kws.length}
            </Badge>
          </div>
          <div className="rounded-lg border border-border/30 divide-y divide-border/20">
            {kws.map((kw, idx) => (
              <div
                key={`${kw.primaryKeyword}-${idx}`}
                className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-surface-inset/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium text-text-primary truncate" title={kw.primaryKeyword}>
                    {kw.primaryKeyword}
                  </p>
                  <p className="text-caption text-text-muted truncate">
                    {kw.cluster}
                    {kw.searchVolume != null && <> &middot; Vol: {kw.searchVolume.toLocaleString()}</>}
                    {(kw as ResearchRow & { difficulty?: number }).difficulty != null && (
                      <> &middot; Diff: {(kw as ResearchRow & { difficulty?: number }).difficulty}</>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Link2 className="h-3.5 w-3.5" />}
                  onClick={() => onMapKeyword(kw)}
                >
                  Map to Page
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
