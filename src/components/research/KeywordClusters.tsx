'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Layers,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type { ResearchRow } from '@/lib/research';
import type { KeywordCluster } from '@/app/api/keywords/cluster/route';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

type ClusterGroup = {
  id: string;
  name: string;
  keywords: string[];
  expanded: boolean;
};

interface KeywordClustersProps {
  /** The keywords to cluster, from the current run */
  keywords: ResearchRow[];
  /** Called when user wants to generate a content brief for a cluster */
  onGenerateContentBrief?: (clusterName: string, keywords: string[]) => void;
  className?: string;
}

/* ─────────────────────────────────────────────
   Skeleton for loading state
   ───────────────────────────────────────────── */

function ClustersSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-7 w-32 bg-border/30 rounded-lg" />
        <div className="h-6 w-24 bg-border/20 rounded-lg" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/30 bg-surface-raised/40 p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 bg-border/30 rounded shrink-0" />
            <div className="h-5 bg-border/30 rounded w-48" />
            <div className="h-5 w-14 bg-border/20 rounded-full ml-auto" />
          </div>
          <div className="grid grid-cols-3 gap-2 ml-7">
            <div className="h-4 bg-border/20 rounded" />
            <div className="h-4 bg-border/20 rounded" />
            <div className="h-4 bg-border/20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Editable Cluster Name
   ───────────────────────────────────────────── */

function EditableClusterName({
  name,
  onRename,
}: {
  name: string;
  onRename: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setDraft(name);
    }
    setEditing(false);
  }, [draft, name, onRename]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="field-input text-body font-semibold px-2 py-0.5 min-w-[120px] max-w-[280px]"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setDraft(name);
            setEditing(false);
          }
        }}
        onBlur={handleSave}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-body font-semibold text-text-primary hover:text-accent transition-colors group/name"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Click to rename"
    >
      <span className="truncate">{name}</span>
      <PenLine className="h-3 w-3 text-text-muted opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}

/* ─────────────────────────────────────────────
   Draggable Keyword Item
   ───────────────────────────────────────────── */

function KeywordChip({
  keyword,
  keywordData,
  onDragStart,
  onRemove,
}: {
  keyword: string;
  keywordData?: ResearchRow;
  onDragStart: (e: React.DragEvent, keyword: string) => void;
  onRemove?: (keyword: string) => void;
}) {
  const [hovering, setHovering] = useState(false);

  return (
    <div
      draggable
      className={cn(
        'flex items-center gap-1.5 rounded-md border border-border/30 bg-surface px-2 py-1.5 cursor-grab active:cursor-grabbing transition-all',
        'hover:border-accent/30 hover:bg-accent/[0.03] hover:shadow-sm',
        'text-body-sm text-text-primary select-none',
      )}
      onDragStart={(e) => onDragStart(e, keyword)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <GripVertical className="h-3 w-3 text-text-muted/50 shrink-0" />
      <span className="truncate max-w-[200px]" title={keyword}>
        {keyword}
      </span>
      {keywordData?.searchVolume != null && (
        <span className="text-caption text-text-muted font-mono shrink-0 ml-0.5 tabular-nums">
          {keywordData.searchVolume.toLocaleString()}
        </span>
      )}
      {onRemove && hovering && (
        <button
          type="button"
          className="ml-0.5 rounded p-0.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(keyword);
          }}
          title="Remove from cluster"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Cluster Card
   ───────────────────────────────────────────── */

function ClusterCard({
  cluster,
  clusterId,
  keywordDataMap,
  expanded,
  onToggle,
  onRename,
  onRemoveKeyword,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
  onGenerateContentBrief,
}: {
  cluster: ClusterGroup;
  clusterId: string;
  keywordDataMap: Map<string, ResearchRow>;
  expanded: boolean;
  onToggle: () => void;
  onRename: (newName: string) => void;
  onRemoveKeyword: (keyword: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetClusterId: string) => void;
  isDragOver: boolean;
  onGenerateContentBrief?: (clusterName: string, keywords: string[]) => void;
}) {
  const handleKeywordDragStart = useCallback(
    (e: React.DragEvent, keyword: string) => {
      e.dataTransfer.setData('text/plain', keyword);
      e.dataTransfer.effectAllowed = 'move';
      // Store the source cluster id
      e.dataTransfer.setData('application/x-source-cluster', clusterId);
    },
    [clusterId],
  );

  // Compute stats
  const stats = useMemo(() => {
    let combinedVolume = 0;
    let totalDifficulty = 0;
    let difficultyCount = 0;
    let intentCounts: Record<string, number> = {};

    for (const kw of cluster.keywords) {
      const data = keywordDataMap.get(kw);
      if (data) {
        combinedVolume += data.searchVolume ?? 0;
        const diff = (data as ResearchRow & { difficulty?: number }).difficulty;
        if (diff != null) {
          totalDifficulty += diff;
          difficultyCount++;
        }
        if (data.intent) {
          intentCounts[data.intent] = (intentCounts[data.intent] || 0) + 1;
        }
      }
    }

    const avgDifficulty =
      difficultyCount > 0 ? Math.round(totalDifficulty / difficultyCount) : 0;
    const topIntent = Object.entries(intentCounts).sort(
      ([, a], [, b]) => b - a,
    )[0];

    return { combinedVolume, avgDifficulty, topIntent, difficultyCount };
  }, [cluster.keywords, keywordDataMap]);

  return (
    <div
      className={cn(
        'rounded-xl border bg-surface-raised/40 transition-all',
        isDragOver
          ? 'border-accent/50 bg-accent/[0.05] ring-1 ring-accent/20'
          : 'border-border/40 hover:border-border/60',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(e);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, clusterId)}
    >
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-inset/30 transition-colors rounded-t-xl"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-muted shrink-0" />
        )}
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-3">
          <EditableClusterName name={cluster.name} onRename={onRename} />
          <Badge variant="info" dot={false}>
            {cluster.keywords.length} keywords
          </Badge>
          {stats.combinedVolume > 0 && (
            <span className="text-caption text-text-muted font-mono tabular-nums">
              Vol: {stats.combinedVolume.toLocaleString()}
            </span>
          )}
          {stats.difficultyCount > 0 && (
            <span className="text-caption text-text-muted">
              Avg Diff: {stats.avgDifficulty}
            </span>
          )}
          {stats.topIntent && (
            <span className="text-caption text-text-muted">
              {stats.topIntent[0]} ({stats.topIntent[1]})
            </span>
          )}
        </div>
        {isDragOver && (
          <Plus className="h-4 w-4 text-accent animate-bounce shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          <div
            className="flex flex-wrap gap-2"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.stopPropagation();
              onDrop(e, clusterId);
            }}
          >
            {cluster.keywords.map((kw) => (
              <KeywordChip
                key={kw}
                keyword={kw}
                keywordData={keywordDataMap.get(kw)}
                onDragStart={handleKeywordDragStart}
                onRemove={
                  cluster.keywords.length > 1 ? onRemoveKeyword : undefined
                }
              />
            ))}
            {cluster.keywords.length === 0 && (
              <p className="text-caption text-text-muted italic py-2">
                Drop keywords here to add to this cluster.
              </p>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 text-caption text-text-muted">
            {stats.combinedVolume > 0 && (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Combined volume: {stats.combinedVolume.toLocaleString()}
              </span>
            )}
          </div>

          {/* Generate Content Brief button */}
          {onGenerateContentBrief && cluster.keywords.length > 0 && (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateContentBrief(cluster.name, cluster.keywords);
                }}
              >
                Generate Content Brief
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */

export default function KeywordClusters({
  keywords,
  onGenerateContentBrief,
  className,
}: KeywordClustersProps) {
  const { addToast } = useToast();
  const [clusters, setClusters] = useState<ClusterGroup[]>([]);
  const [isClustering, setIsClustering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOverClusterId, setDragOverClusterId] = useState<string | null>(null);

  /* ── Keyword data lookup map (for volume, difficulty, etc.) ── */
  const keywordDataMap = useMemo(() => {
    const map = new Map<string, ResearchRow>();
    for (const row of keywords) {
      // Map by primary keyword
      if (row.primaryKeyword) {
        map.set(row.primaryKeyword, row);
      }
      // Also map by any keyword in the keywords array
      for (const kw of row.keywords) {
        if (!map.has(kw)) {
          map.set(kw, row);
        }
      }
    }
    return map;
  }, [keywords]);

  /* ── Derive keyword list ── */
  const keywordList = useMemo(() => {
    return keywords.map((r) => r.primaryKeyword).filter(Boolean);
  }, [keywords]);

  const hasClusters = clusters.length > 0;

  /* ── Cluster keywords via AI ── */
  const handleCluster = useCallback(async () => {
    if (keywordList.length === 0) {
      addToast('No keywords to cluster.', 'error');
      return;
    }

    setIsClustering(true);
    setError(null);

    try {
      const res = await fetch('/api/keywords/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: keywordList }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Clustering failed');
      }

      const groups: ClusterGroup[] = data.clusters.map(
        (c: KeywordCluster, idx: number) => ({
          id: `cluster-${idx}`,
          name: c.name,
          keywords: c.keywords,
          expanded: true,
        }),
      );

      setClusters(groups);
      addToast(
        data.cached
          ? `Loaded ${groups.length} clusters from cache.`
          : `AI generated ${groups.length} clusters from ${keywordList.length} keywords.`,
        'success',
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Clustering failed';
      setError(message);
      addToast(message, 'error');
    } finally {
      setIsClustering(false);
    }
  }, [keywordList, addToast]);

  /* ── Toggle expand ── */
  const handleToggle = useCallback((clusterId: string) => {
    setClusters((prev) =>
      prev.map((c) =>
        c.id === clusterId ? { ...c, expanded: !c.expanded } : c,
      ),
    );
  }, []);

  /* ── Rename cluster ── */
  const handleRename = useCallback(
    (clusterId: string, newName: string) => {
      setClusters((prev) =>
        prev.map((c) => (c.id === clusterId ? { ...c, name: newName } : c)),
      );
    },
    [],
  );

  /* ── Remove keyword from cluster ── */
  const handleRemoveKeyword = useCallback(
    (clusterId: string, keyword: string) => {
      setClusters((prev) =>
        prev.map((c) =>
          c.id === clusterId
            ? { ...c, keywords: c.keywords.filter((k) => k !== keyword) }
            : c,
        ),
      );
    },
    [],
  );

  /* ── Drag and Drop ── */
  const handleDragOver = useCallback(
    (clusterId: string) => (_e: React.DragEvent) => {
      setDragOverClusterId(clusterId);
    },
    [],
  );

  const handleDragLeave = useCallback((_e: React.DragEvent) => {
    setDragOverClusterId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetClusterId: string) => {
      e.preventDefault();
      const keyword = e.dataTransfer.getData('text/plain');
      const sourceClusterId =
        e.dataTransfer.getData('application/x-source-cluster') || '';

      if (!keyword) return;
      setDragOverClusterId(null);

      setClusters((prev) => {
        // Remove from source cluster (if it has a source)
        const withoutSource = sourceClusterId
          ? prev.map((c) =>
              c.id === sourceClusterId
                ? { ...c, keywords: c.keywords.filter((k) => k !== keyword) }
                : c,
            )
          : prev;

        // Add to target cluster if not already there
        return withoutSource.map((c) =>
          c.id === targetClusterId
            ? c.keywords.includes(keyword)
              ? c
              : { ...c, keywords: [...c.keywords, keyword] }
            : c,
        );
      });
    },
    [],
  );

  /* ── Export cluster for content brief ── */
  const handleGenerateBrief = useCallback(
    (clusterName: string, clusterKeywords: string[]) => {
      if (onGenerateContentBrief) {
        onGenerateContentBrief(clusterName, clusterKeywords);
        addToast(
          `Content brief requested for "${clusterName}" with ${clusterKeywords.length} keywords.`,
          'success',
        );
      }
    },
    [onGenerateContentBrief, addToast],
  );

  /* ── Clear clusters ── */
  const handleClear = useCallback(() => {
    setClusters([]);
    setError(null);
  }, []);

  /* ── Render ── */
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">AI Clustering</p>
          <h2 className="mt-1 text-heading-2 text-text-primary flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-accent" />
            Keyword Clusters
          </h2>
          <p className="mt-1 text-body text-text-secondary">
            Group related keywords by topic and intent using AI.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasClusters && (
            <>
              <Badge variant="info" dot>
                {clusters.length} clusters
              </Badge>
              <span className="text-caption text-text-muted">
                {clusters.reduce((sum, c) => sum + c.keywords.length, 0)} keywords
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="md"
          icon={
            isClustering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BrainCircuit className="h-4 w-4" />
            )
          }
          loading={isClustering}
          disabled={isClustering || keywordList.length === 0}
          onClick={handleCluster}
        >
          {hasClusters ? 'Re-cluster Keywords' : 'Cluster Keywords'}
        </Button>
        {hasClusters && !isClustering && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="md"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={handleCluster}
            >
              Re-cluster
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="md"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={handleClear}
            >
              Clear
            </Button>
          </>
        )}
        {!hasClusters && !isClustering && keywordList.length > 0 && (
          <span className="text-caption text-text-muted ml-2">
            {keywordList.length} keywords available
          </span>
        )}
      </div>

      {/* States */}
      {isClustering ? (
        <ClustersSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/[0.04] p-5 text-center">
          <p className="text-body font-medium text-destructive">{error}</p>
          <p className="mt-2 text-caption text-text-muted">
            Make sure your AI API key is configured (ANTHROPIC_API_KEY).
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={handleCluster}
          >
            Try again
          </Button>
        </div>
      ) : !hasClusters ? (
        keywordList.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-8 w-8 text-text-muted" />}
            title="No keywords to cluster"
            description="Run keyword research first to start clustering."
          />
        ) : (
          <Card className="border-dashed border-2 border-border/40 bg-surface-raised/20 p-8 text-center">
            <BrainCircuit className="h-10 w-10 text-text-muted/50 mx-auto mb-3" />
            <p className="text-body font-medium text-text-primary">
              {keywordList.length} keywords ready for clustering
            </p>
            <p className="mt-1 text-caption text-text-muted max-w-md mx-auto">
              Click &ldquo;Cluster Keywords&rdquo; to let AI group them into logical
              topic clusters. Drag keywords between clusters to reorganize.
            </p>
          </Card>
        )
      ) : (
        /* Clusters list */
        <div className="space-y-3">
          {clusters.map((cluster) => (
            <ClusterCard
              key={cluster.id}
              cluster={cluster}
              clusterId={cluster.id}
              keywordDataMap={keywordDataMap}
              expanded={cluster.expanded}
              onToggle={() => handleToggle(cluster.id)}
              onRename={(newName) => handleRename(cluster.id, newName)}
              onRemoveKeyword={(kw) => handleRemoveKeyword(cluster.id, kw)}
              onDragOver={handleDragOver(cluster.id)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              isDragOver={dragOverClusterId === cluster.id}
              onGenerateContentBrief={handleGenerateBrief}
            />
          ))}
        </div>
      )}
    </div>
  );
}
