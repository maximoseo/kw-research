'use client';

import { useCallback, useState, useTransition } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Download,
  GitMerge,
  Loader2,
  Minus,
  X,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, Tabs } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { ResearchRow, ResearchRunSummary } from '@/lib/research';
import { cn } from '@/lib/utils';

// ── Types ──

interface ComparedKeyword {
  keyword: string;
  volumeA: number | null;
  difficultyA: number | null;
  volumeB: number | null;
  difficultyB: number | null;
  bestSource: 'A' | 'B' | 'tie';
}

interface CompareResponse {
  shared: ComparedKeyword[];
  onlyA: ResearchRow[];
  onlyB: ResearchRow[];
  stats: {
    sharedCount: number;
    onlyACount: number;
    onlyBCount: number;
    mergedCount: number;
  };
}

type WorkflowState = 'idle' | 'loading' | 'results';

// ── Helpers ──

function formatVolume(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString();
}

function formatDifficulty(d: number | null): string {
  if (d == null) return '—';
  return String(d);
}

function difficultyColor(d: number | null): string {
  if (d == null) return 'text-text-muted';
  if (d <= 30) return 'text-success';
  if (d <= 60) return 'text-warning';
  return 'text-destructive';
}

function volumeColor(v: number | null): string {
  if (v == null) return 'text-text-muted';
  if (v >= 5000) return 'text-success';
  if (v >= 1000) return 'text-accent';
  return 'text-text-secondary';
}

// ── Component ──

export default function ListCompare({ projectId }: { projectId: string }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [listAId, setListAId] = useState<string>('');
  const [listBId, setListBId] = useState<string>('');
  const [workflowState, setWorkflowState] = useState<WorkflowState>('idle');
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'shared' | 'onlyA' | 'onlyB'>('shared');
  const [isMerging, startMerge] = useTransition();

  // Fetch runs for the project
  const runsQuery = useQuery({
    queryKey: ['runs', projectId, 'completed'],
    queryFn: async () => {
      const response = await fetch(`/api/runs?projectId=${encodeURIComponent(projectId)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load runs.');
      return (payload.runs as ResearchRunSummary[]).filter(
        (r) => r.status === 'completed',
      );
    },
  });

  const completedRuns = runsQuery.data ?? [];

  // Auto-select first two if available
  const hasAutoSelected = listAId || listBId;
  if (!hasAutoSelected && completedRuns.length >= 2 && !runsQuery.isFetching) {
    setListAId(completedRuns[0].id);
    setListBId(completedRuns[1].id);
  }

  const handleCompare = useCallback(async () => {
    if (!listAId || !listBId) {
      addToast('Please select both lists.', 'error');
      return;
    }
    if (listAId === listBId) {
      addToast('Please select two different lists.', 'error');
      return;
    }

    setWorkflowState('loading');
    setCompareData(null);

    try {
      const response = await fetch('/api/keywords/compare-lists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runIdA: listAId, runIdB: listBId }),
      });

      const result = await response.json();
      if (!response.ok) {
        addToast(result.error || 'Comparison failed.', 'error');
        setWorkflowState('idle');
        return;
      }

      setCompareData(result);
      setActiveTab('shared');
      setWorkflowState('results');
    } catch {
      addToast('Network error during comparison.', 'error');
      setWorkflowState('idle');
    }
  }, [listAId, listBId, addToast]);

  const handleMerge = useCallback(() => {
    if (!compareData) return;

    startMerge(async () => {
      try {
        // Build merged keyword list
        const keywords: { keyword: string; volume: number | null; difficulty: number | null }[] = [];

        // Shared keywords: pick best metrics
        for (const item of compareData.shared) {
          keywords.push({
            keyword: item.keyword,
            volume: item.bestSource === 'A' ? item.volumeA : item.volumeB,
            difficulty: item.bestSource === 'A' ? item.difficultyA : item.difficultyB,
          });
        }

        // Unique to A
        for (const row of compareData.onlyA) {
          keywords.push({
            keyword: row.primaryKeyword,
            volume: row.searchVolume ?? null,
            difficulty: row.difficulty ?? null,
          });
        }

        // Unique to B
        for (const row of compareData.onlyB) {
          keywords.push({
            keyword: row.primaryKeyword,
            volume: row.searchVolume ?? null,
            difficulty: row.difficulty ?? null,
          });
        }

        // Import via bulk endpoint
        const response = await fetch('/api/keywords/import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId,
            keywords,
            duplicateStrategy: 'skip',
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          addToast(result.error || 'Merge failed.', 'error');
          return;
        }

        addToast(
          `Merged ${result.imported} keywords from both lists. ${result.skipped > 0 ? `${result.skipped} duplicates skipped.` : ''}`,
          'success',
        );

        // Refresh runs
        await queryClient.invalidateQueries({ queryKey: ['runs', projectId] });
      } catch {
        addToast('Network error during merge.', 'error');
      }
    });
  }, [compareData, projectId, addToast, queryClient]);

  const handleExportShared = useCallback(() => {
    if (!compareData?.shared.length) return;

    const header = 'Keyword,Volume A,Difficulty A,Volume B,Difficulty B,Best Source';
    const rows = compareData.shared.map((item) =>
      [
        `"${item.keyword.replace(/"/g, '""')}"`,
        item.volumeA ?? '',
        item.difficultyA ?? '',
        item.volumeB ?? '',
        item.difficultyB ?? '',
        item.bestSource,
      ].join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `keyword-comparison-shared-${Date.now()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    addToast('Shared keywords exported as CSV.', 'success');
  }, [compareData, addToast]);

  // ── Get run names for display ──
  const runAName = completedRuns.find((r) => r.id === listAId);
  const runBName = completedRuns.find((r) => r.id === listBId);

  const canCompare = listAId && listBId && listAId !== listBId && completedRuns.length >= 2;

  return (
    <div className="min-w-0 space-y-6">
      {/* ── Header Section ── */}
      <Card>
        <div className="section-header mb-5">
          <div>
            <p className="eyebrow">Keyword tools</p>
            <h2 className="section-subtitle mt-2">Compare &amp; Merge Keyword Lists</h2>
            <p className="section-copy mt-1.5">
              Compare two completed research runs side-by-side. Find shared keywords, unique keywords, and merge the best data from both.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowLeftRight className="h-4 w-4 text-accent" />
            <span className="text-caption text-text-muted">
              {completedRuns.length} completed run{completedRuns.length === 1 ? '' : 's'} available
            </span>
          </div>
        </div>

        {/* Selectors */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* List A */}
          <div className="space-y-2">
            <label className="text-caption font-semibold uppercase tracking-wider text-text-muted">
              List A
            </label>
            <select
              value={listAId}
              onChange={(e) => {
                setListAId(e.target.value);
                setWorkflowState('idle');
                setCompareData(null);
              }}
              className="field-select w-full"
              disabled={runsQuery.isFetching}
            >
              <option value="">Select a completed run...</option>
              {completedRuns.map((run) => (
                <option key={`a-${run.id}`} value={run.id}>
                  {run.projectName} — {new Date(run.queuedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
            {runAName && (
              <p className="text-caption text-text-muted">
                {runAName.brandName} · {runAName.language} · {runAName.market}
              </p>
            )}
          </div>

          {/* List B */}
          <div className="space-y-2">
            <label className="text-caption font-semibold uppercase tracking-wider text-text-muted">
              List B
            </label>
            <select
              value={listBId}
              onChange={(e) => {
                setListBId(e.target.value);
                setWorkflowState('idle');
                setCompareData(null);
              }}
              className="field-select w-full"
              disabled={runsQuery.isFetching}
            >
              <option value="">Select a completed run...</option>
              {completedRuns.map((run) => (
                <option key={`b-${run.id}`} value={run.id}>
                  {run.projectName} — {new Date(run.queuedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
            {runBName && (
              <p className="text-caption text-text-muted">
                {runBName.brandName} · {runBName.language} · {runBName.market}
              </p>
            )}
          </div>
        </div>

        {/* Compare button */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={<ArrowLeftRight className="h-4 w-4" />}
            loading={workflowState === 'loading'}
            disabled={!canCompare || workflowState === 'loading'}
            onClick={handleCompare}
          >
            Compare Lists
          </Button>
          {listAId === listBId && listAId !== '' && (
            <span className="text-caption text-destructive">Please select two different lists.</span>
          )}
          {completedRuns.length < 2 && !runsQuery.isFetching && (
            <span className="text-caption text-text-muted">
              Need at least 2 completed runs to compare.
            </span>
          )}
        </div>
      </Card>

      {/* ── Results ── */}
      {workflowState === 'loading' && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
            <p className="text-body font-semibold text-text-primary">Comparing keyword lists...</p>
            <p className="mt-1 text-caption text-text-muted">
              Matching keywords and analyzing metrics across both lists.
            </p>
          </div>
        </Card>
      )}

      {workflowState === 'results' && compareData && (
        <>
          {/* Stats summary */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="text-center">
              <p className="text-2xl font-bold text-accent tabular-nums">
                {compareData.stats.sharedCount}
              </p>
              <p className="mt-1 text-caption text-text-muted">Shared Keywords</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-info tabular-nums">
                {compareData.stats.onlyACount}
              </p>
              <p className="mt-1 text-caption text-text-muted">Only in List A</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-warning tabular-nums">
                {compareData.stats.onlyBCount}
              </p>
              <p className="mt-1 text-caption text-text-muted">Only in List B</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-success tabular-nums">
                {compareData.stats.mergedCount}
              </p>
              <p className="mt-1 text-caption text-text-muted">Pot. Merged Total</p>
            </Card>
          </div>

          {/* Merge button */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="primary"
              size="md"
              icon={<GitMerge className="h-4 w-4" />}
              loading={isMerging}
              disabled={isMerging}
              onClick={handleMerge}
            >
              Merge Best into New List
            </Button>
            <span className="text-caption text-text-muted">
              Shared keywords: best metrics picked &middot; All unique keywords from both lists included
            </span>
          </div>

          {/* Tabbed results */}
          <Card padding="none">
            <div className="px-5 pt-5 pb-0">
              <Tabs
                activeTab={activeTab}
                onChange={(v) => setActiveTab(v as typeof activeTab)}
                tabs={[
                  {
                    id: 'shared',
                    label: `Shared (${compareData.stats.sharedCount})`,
                    hasContent: compareData.stats.sharedCount > 0,
                  },
                  {
                    id: 'onlyA',
                    label: `Only in A (${compareData.stats.onlyACount})`,
                    hasContent: compareData.stats.onlyACount > 0,
                  },
                  {
                    id: 'onlyB',
                    label: `Only in B (${compareData.stats.onlyBCount})`,
                    hasContent: compareData.stats.onlyBCount > 0,
                  },
                ]}
              />
            </div>

            <div className="p-5">
              {/* Shared tab */}
              {activeTab === 'shared' && (
                <div className="space-y-4">
                  {compareData.shared.length === 0 ? (
                    <EmptyState
                      icon={<Minus className="h-8 w-8 text-text-muted" />}
                      title="No shared keywords"
                      description="These two lists don't contain any matching keywords."
                    />
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-caption text-text-muted">
                          {compareData.shared.length} shared keywords — side-by-side metrics with best source highlighted
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          icon={<Download className="h-3.5 w-3.5" />}
                          onClick={handleExportShared}
                        >
                          Export shared CSV
                        </Button>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border/50">
                        <div className="max-h-[600px] overflow-auto">
                          <table className="min-w-[800px] w-full text-left">
                            <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
                              <tr className="text-text-muted">
                                <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider">
                                  Keyword
                                </th>
                                <th className="px-3 py-2.5 text-center text-caption font-semibold uppercase tracking-wider">
                                  Volume A
                                </th>
                                <th className="px-3 py-2.5 text-center text-caption font-semibold uppercase tracking-wider">
                                  Diff A
                                </th>
                                <th className="px-3 py-2.5 text-center text-caption font-semibold uppercase tracking-wider">
                                  Volume B
                                </th>
                                <th className="px-3 py-2.5 text-center text-caption font-semibold uppercase tracking-wider">
                                  Diff B
                                </th>
                                <th className="px-3 py-2.5 text-center text-caption font-semibold uppercase tracking-wider">
                                  Best Source
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {compareData.shared.map((item, i) => (
                                <tr
                                  key={`${item.keyword}-${i}`}
                                  className={cn(
                                    'transition-colors hover:bg-accent/[0.02]',
                                    i % 2 === 1 && 'bg-surface-inset/30',
                                  )}
                                >
                                  <td className="max-w-[220px] truncate px-3 py-2.5 font-medium text-body-sm" title={item.keyword}>
                                    {item.keyword}
                                  </td>
                                  <td className={cn('px-3 py-2.5 text-center font-mono text-body-sm tabular-nums', volumeColor(item.volumeA))}>
                                    {formatVolume(item.volumeA)}
                                  </td>
                                  <td className={cn('px-3 py-2.5 text-center font-mono text-body-sm tabular-nums', difficultyColor(item.difficultyA))}>
                                    {formatDifficulty(item.difficultyA)}
                                  </td>
                                  <td className={cn('px-3 py-2.5 text-center font-mono text-body-sm tabular-nums', volumeColor(item.volumeB))}>
                                    {formatVolume(item.volumeB)}
                                  </td>
                                  <td className={cn('px-3 py-2.5 text-center font-mono text-body-sm tabular-nums', difficultyColor(item.difficultyB))}>
                                    {formatDifficulty(item.difficultyB)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <Badge
                                      variant={
                                        item.bestSource === 'A'
                                          ? 'info'
                                          : item.bestSource === 'B'
                                            ? 'warning'
                                            : 'neutral'
                                      }
                                    >
                                      {item.bestSource === 'tie' ? 'Tie' : `List ${item.bestSource}`}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Only in A tab */}
              {activeTab === 'onlyA' && (
                <div className="space-y-4">
                  {compareData.onlyA.length === 0 ? (
                    <EmptyState
                      icon={<Minus className="h-8 w-8 text-text-muted" />}
                      title="No unique keywords in List A"
                      description="All keywords from List A are also present in List B."
                    />
                  ) : (
                    <>
                      <p className="text-caption text-text-muted">
                        {compareData.onlyA.length} keywords only found in List A
                      </p>
                      <KeywordRowTable rows={compareData.onlyA} />
                    </>
                  )}
                </div>
              )}

              {/* Only in B tab */}
              {activeTab === 'onlyB' && (
                <div className="space-y-4">
                  {compareData.onlyB.length === 0 ? (
                    <EmptyState
                      icon={<Minus className="h-8 w-8 text-text-muted" />}
                      title="No unique keywords in List B"
                      description="All keywords from List B are also present in List A."
                    />
                  ) : (
                    <>
                      <p className="text-caption text-text-muted">
                        {compareData.onlyB.length} keywords only found in List B
                      </p>
                      <KeywordRowTable rows={compareData.onlyB} />
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Keyword Row Table (reused for onlyA / onlyB) ──

function KeywordRowTable({ rows }: { rows: ResearchRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/50">
      <div className="max-h-[600px] overflow-auto">
        <table className="min-w-[700px] w-full text-left">
          <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
            <tr className="text-text-muted">
              <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider">Keyword</th>
              <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider">Pillar</th>
              <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider">Cluster</th>
              <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider">Intent</th>
              <th className="px-3 py-2.5 text-center text-caption font-semibold uppercase tracking-wider">Volume</th>
              <th className="px-3 py-2.5 text-center text-caption font-semibold uppercase tracking-wider">Difficulty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((row, i) => (
              <tr
                key={`${row.primaryKeyword}-${i}`}
                className={cn(
                  'transition-colors hover:bg-accent/[0.02]',
                  i % 2 === 1 && 'bg-surface-inset/30',
                )}
              >
                <td className="max-w-[200px] truncate px-3 py-2.5 font-medium text-body-sm" title={row.primaryKeyword}>
                  {row.primaryKeyword}
                </td>
                <td className="max-w-[140px] truncate px-3 py-2.5 text-body-sm text-text-secondary" title={row.pillar}>
                  {row.pillar}
                </td>
                <td className="max-w-[140px] truncate px-3 py-2.5 text-body-sm text-text-secondary" title={row.cluster}>
                  {row.cluster}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      'inline-block rounded-md px-2 py-0.5 text-caption font-medium',
                      row.intent === 'Informational' && 'bg-info/[0.08] text-info',
                      row.intent === 'Commercial' && 'bg-warning/[0.08] text-warning',
                      row.intent === 'Transactional' && 'bg-success/[0.08] text-success',
                      row.intent === 'Navigational' && 'bg-accent/[0.08] text-accent',
                    )}
                  >
                    {row.intent}
                  </span>
                </td>
                <td className={cn('px-3 py-2.5 text-center font-mono text-body-sm tabular-nums', volumeColor(row.searchVolume ?? null))}>
                  {formatVolume(row.searchVolume ?? null)}
                </td>
                <td className={cn('px-3 py-2.5 text-center font-mono text-body-sm tabular-nums', difficultyColor(row.difficulty ?? null))}>
                  {formatDifficulty(row.difficulty ?? null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
