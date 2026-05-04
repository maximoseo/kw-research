'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GitMerge,
  Loader2,
  ShieldAlert,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type {
  CannibalGroup,
  CannibalizationResponse,
} from '@/app/api/keywords/cannibalization/route';
import type { ResearchIntent, ResearchRow } from '@/lib/research';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

type ReportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; data: CannibalizationResponse }
  | { status: 'error'; message: string }
  | { status: 'empty' };

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

const LOCAL_STORAGE_KEY = 'kw-research:cannibalization:resolved';

function loadResolvedGroups(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveResolvedGroups(groups: Set<string>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([...groups]));
  } catch {
    // ignore localStorage errors
  }
}

function severityBadgeVariant(
  severity: 'high' | 'medium' | 'low',
): 'error' | 'warning' | 'neutral' {
  switch (severity) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    default:
      return 'neutral';
  }
}

function severityColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high':
      return 'text-destructive border-destructive/20 bg-destructive/[0.06]';
    case 'medium':
      return 'text-warning border-warning/20 bg-warning/[0.06]';
    default:
      return 'text-text-muted border-border/50 bg-surface-raised';
  }
}

/* ─────────────────────────────────────────────
   Sub-component: Group Card
   ───────────────────────────────────────────── */

function GroupCard({
  group,
  index,
  onResolve,
  onMergeToCluster,
  defaultExpanded,
}: {
  group: CannibalGroup;
  index: number;
  onResolve: (groupKey: string) => void;
  onMergeToCluster: (keywords: string[]) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [resolved, setResolved] = useState(false);
  const [merging, setMerging] = useState(false);
  const { addToast } = useToast();

  const groupKey = useMemo(
    () => group.keywords.map((k) => k.toLowerCase()).sort().join('|'),
    [group.keywords],
  );

  const handleResolve = useCallback(() => {
    onResolve(groupKey);
    setResolved(true);
    addToast(
      `Resolved cannibalization group with ${group.keywords.length} keywords.`,
      'success',
    );
  }, [groupKey, group.keywords.length, onResolve, addToast]);

  const handleMerge = useCallback(async () => {
    setMerging(true);
    try {
      const response = await fetch('/api/keywords/cluster', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords: group.keywords }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Clustering failed');
      }
      onMergeToCluster(group.keywords);
      addToast(
        `Created cluster from ${group.keywords.length} keywords.`,
        'success',
      );
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : 'Failed to create cluster.',
        'error',
      );
    } finally {
      setMerging(false);
    }
  }, [group.keywords, onMergeToCluster, addToast]);

  if (resolved) return null;

  const sevColor = severityColor(group.severity);
  const badgeVariant = severityBadgeVariant(group.severity);

  return (
    <Card
      className={cn(
        '!p-0 overflow-hidden transition-all duration-200',
        group.severity === 'high' && 'ring-1 ring-destructive/30',
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-raised/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-caption text-text-muted shrink-0 font-mono">
            #{index + 1}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {group.keywords.slice(0, 3).map((kw, i) => (
              <span
                key={i}
                className="text-body-sm font-semibold text-text-primary truncate max-w-[200px]"
                title={kw}
              >
                {kw}
                {i < Math.min(group.keywords.length, 3) - 1 && ','}
              </span>
            ))}
            {group.keywords.length > 3 && (
              <span className="text-caption text-text-muted">
                +{group.keywords.length - 3} more
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-caption font-mono text-text-muted">
            {(group.overlapScore * 100).toFixed(0)}%
          </span>
          <Badge variant={badgeVariant}>
            {group.severity === 'high'
              ? 'High Risk'
              : group.severity === 'medium'
                ? 'Medium'
                : 'Low'}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/50 px-4 py-4 space-y-4">
          {/* Suggestion */}
          <div className="flex items-start gap-2.5 rounded-lg bg-accent/[0.03] border border-accent/10 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
            <div>
              <p className="text-body-sm font-semibold text-text-primary">
                Suggestion
              </p>
              <p className="text-body-sm text-text-secondary mt-0.5">
                {group.suggestion}
              </p>
            </div>
          </div>

          {/* Full keyword list */}
          <div>
            <p className="text-caption font-semibold text-text-muted uppercase tracking-wider mb-2">
              All Keywords ({group.keywords.length})
            </p>
            <div className="grid gap-1.5">
              {group.keywords.map((kw, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/30 bg-surface/40 px-3 py-2"
                >
                  <span className="text-body-sm font-medium text-text-primary truncate mr-2">
                    {kw}
                  </span>
                  <span className="text-caption text-text-muted shrink-0">
                    #{i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          {(group.intent || group.pillar || group.cluster) && (
            <div className="flex items-center gap-2 flex-wrap">
              {group.intent && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
                  Intent: {group.intent}
                </span>
              )}
              {group.pillar && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
                  Pillar: {group.pillar}
                </span>
              )}
              {group.cluster && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
                  Cluster: {group.cluster}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              onClick={handleResolve}
            >
              Mark as Resolved
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<GitMerge className="h-3.5 w-3.5" />}
              loading={merging}
              onClick={handleMerge}
            >
              Merge into Cluster
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────── */

export default function CannibalizationReport({
  projectId,
}: {
  projectId: string;
}) {
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [reportState, setReportState] = useState<ReportState>({
    status: 'idle',
  });
  const [resolvedGroups, setResolvedGroups] = useState<Set<string>>(() =>
    loadResolvedGroups(),
  );

  // Persist resolved groups to localStorage
  useEffect(() => {
    saveResolvedGroups(resolvedGroups);
  }, [resolvedGroups]);

  const handleCheck = useCallback(() => {
    setReportState({ status: 'loading' });
    startTransition(async () => {
      try {
        const response = await fetch('/api/keywords/cannibalization', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });

        const data = await response.json();
        if (!response.ok) {
          setReportState({
            status: 'error',
            message: data.error || 'Failed to analyze cannibalization.',
          });
          return;
        }

        if (data.cannibalGroups.length === 0) {
          setReportState({ status: 'empty' });
        } else {
          setReportState({ status: 'result', data });
        }
      } catch (err) {
        setReportState({
          status: 'error',
          message:
            err instanceof Error ? err.message : 'Network error. Please try again.',
        });
      }
    });
  }, [projectId]);

  const handleResolve = useCallback((groupKey: string) => {
    setResolvedGroups((prev) => {
      const next = new Set(prev);
      next.add(groupKey);
      return next;
    });
  }, []);

  const handleMergeToCluster = useCallback(
    (keywords: string[]) => {
      addToast(
        `Cluster request sent for ${keywords.length} keywords. See Clusters tab for results.`,
        'info',
      );
    },
    [addToast],
  );

  // Filter out resolved groups from display
  const visibleGroups = useMemo(() => {
    if (reportState.status !== 'result') return [];
    return reportState.data.cannibalGroups.filter((group) => {
      const groupKey = group.keywords
        .map((k) => k.toLowerCase())
        .sort()
        .join('|');
      return !resolvedGroups.has(groupKey);
    });
  }, [reportState, resolvedGroups]);

  const clearResolved = useCallback(() => {
    setResolvedGroups(new Set());
    addToast('All resolved groups have been restored.', 'info');
  }, [addToast]);

  return (
    <div className="space-y-6">
      {/* Header / Action card */}
      <Card className="space-y-5">
        <div className="section-header">
          <div>
            <p className="eyebrow">Keyword Cannibalization</p>
            <h2 className="section-subtitle mt-2">
              Detect competing keywords
            </h2>
            <p className="section-copy mt-1.5">
              Find keywords that target the same search intent and may cause
              your pages to compete against each other in search results.
            </p>
          </div>
        </div>

        {/* Action section */}
        <div className="space-y-4">
          {reportState.status === 'idle' && (
            <div className="action-row border-t border-border/40 pt-4">
              <Button
                type="button"
                size="md"
                icon={<ShieldAlert className="h-4 w-4" />}
                onClick={handleCheck}
              >
                Check Cannibalization
              </Button>
            </div>
          )}

          {reportState.status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-accent/20" />
                <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-accent" />
              </div>
              <p className="text-body font-semibold text-text-primary">
                Analyzing keyword overlap...
              </p>
              <p className="text-body-sm text-text-secondary text-center max-w-md">
                Fetching keywords from completed runs and detecting overlapping
                terms and intents.
              </p>
            </div>
          )}

          {reportState.status === 'error' && (
            <div className="space-y-4 border-t border-border/40 pt-4">
              <Alert variant="error" title="Analysis failed">
                {reportState.message}
              </Alert>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<ShieldAlert className="h-3.5 w-3.5" />}
                onClick={handleCheck}
              >
                Try Again
              </Button>
            </div>
          )}

          {reportState.status === 'empty' && (
            <div className="border-t border-border/40 pt-4">
              <EmptyState
                icon={
                  <CheckCircle2 className="h-12 w-12 text-success/40" />
                }
                title="No cannibalization detected"
                description="All keywords target distinct intents and topics. Your content strategy looks clean."
              />
              <div className="flex justify-center mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<ShieldAlert className="h-3.5 w-3.5" />}
                  onClick={handleCheck}
                >
                  Re-check
                </Button>
              </div>
            </div>
          )}

          {reportState.status === 'result' && (
            <div className="border-t border-border/40 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      reportState.data.cannibalGroups.some(
                        (g) => g.severity === 'high',
                      )
                        ? 'error'
                        : 'warning'
                    }
                  >
                    {reportState.data.totalGroups} group
                    {reportState.data.totalGroups !== 1 ? 's' : ''}
                  </Badge>
                  <span className="text-body-sm text-text-secondary">
                    {reportState.data.totalAffectedKeywords} keyword
                    {reportState.data.totalAffectedKeywords !== 1 && 's'} may be
                    competing
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<ShieldAlert className="h-3.5 w-3.5" />}
                  loading={isPending}
                  onClick={handleCheck}
                >
                  Re-check
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Results */}
      {reportState.status === 'result' && (
        <>
          {/* Stats header */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-surface-raised/40 px-3 py-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <span className="text-body-sm font-semibold text-text-primary">
                {visibleGroups.length} active group
                {visibleGroups.length !== 1 ? 's' : ''}
              </span>
            </div>

            {visibleGroups.length <
              reportState.data.cannibalGroups.length && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-body-sm text-text-muted hover:text-text-primary transition-colors"
                onClick={clearResolved}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Show {reportState.data.cannibalGroups.length - visibleGroups.length}{' '}
                resolved group
                {reportState.data.cannibalGroups.length -
                  visibleGroups.length !==
                  1 && 's'}
              </button>
            )}
          </div>

          {/* Group cards */}
          {visibleGroups.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-10 w-10 text-success/40" />}
              title="All groups resolved"
              description="All cannibalization issues have been addressed."
              action={{
                label: 'Show resolved groups',
                onClick: clearResolved,
              }}
            />
          ) : (
            <div className="space-y-3">
              {visibleGroups.map((group, index) => (
                <GroupCard
                  key={group.keywords
                    .map((k) => k.toLowerCase())
                    .sort()
                    .join('|')}
                  group={group}
                  index={index}
                  onResolve={handleResolve}
                  onMergeToCluster={handleMergeToCluster}
                  defaultExpanded={
                    group.severity === 'high' || visibleGroups.length <= 3
                  }
                />
              ))}
            </div>
          )}

          {/* Bulk actions */}
          {visibleGroups.length > 0 && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                onClick={() => {
                  for (const g of visibleGroups) {
                    const gk = g.keywords
                      .map((k) => k.toLowerCase())
                      .sort()
                      .join('|');
                    setResolvedGroups((prev) => new Set([...prev, gk]));
                  }
                  addToast(
                    `Marked ${visibleGroups.length} groups as resolved.`,
                    'success',
                  );
                }}
              >
                Resolve All
              </Button>
            </div>
          )}
        </>
      )}

      {/* Idle state */}
      {reportState.status === 'idle' && (
        <EmptyState
          icon={<ShieldAlert className="h-11 w-11 text-text-muted/30" />}
          title="Ready to analyze"
          description="Click the button above to scan all keywords from completed runs for cannibalization issues."
        />
      )}
    </div>
  );
}
