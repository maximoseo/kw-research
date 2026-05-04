'use client';

import { useCallback, useState, useTransition } from 'react';
import { AlertTriangle, ArrowDownAZ, ArrowUpAZ, ArrowUpRight, BarChart3, ChevronDown, ExternalLink, Filter, GanttChart, Info, Loader2, Plus, RotateCcw, Search, Target, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Field } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type { GapKeyword } from '@/app/api/competitors/gap-analysis/route';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnalysisState =
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'complete'; data: GapKeyword[]; meta: { totalFound: number; userKeywordCount: number; competitorDomains: string[] }; errors?: string[] }
  | { status: 'error'; message: string };

type SortField = 'opportunityScore' | 'volume' | 'difficulty' | 'keyword';
type SortOrder = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatOpportunity(score: number): string {
  if (score >= 10_000) return `${(score / 1_000).toFixed(1)}K`;
  return score.toString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ContentGapAnalysis({ projectId, userDomain: initialUserDomain }: { projectId: string; userDomain?: string }) {
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [userDomain, setUserDomain] = useState(initialUserDomain || '');
  const [domains, setDomains] = useState<string[]>(['']);

  const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' });

  // Filtering state
  const [minVolume, setMinVolume] = useState<number>(0);
  const [maxDifficulty, setMaxDifficulty] = useState<number>(100);
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('opportunityScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Import state
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Show/hide filters
  const [showFilters, setShowFilters] = useState(false);

  const handleAddDomain = () => {
    if (domains.length >= 3) {
      addToast('Maximum 3 competitor domains allowed.', 'error');
      return;
    }
    setDomains([...domains, '']);
  };

  const handleRemoveDomain = (index: number) => {
    if (domains.length <= 1) return;
    setDomains(domains.filter((_, i) => i !== index));
  };

  const handleDomainChange = (index: number, value: string) => {
    const updated = [...domains];
    updated[index] = value;
    setDomains(updated);
  };

  const handleAnalyze = useCallback(() => {
    const filledDomains = domains.filter((d) => d.trim().length > 0);
    if (!userDomain.trim()) {
      addToast('Please enter your domain.', 'error');
      return;
    }
    if (filledDomains.length === 0) {
      addToast('Please enter at least one competitor domain.', 'error');
      return;
    }

    setSelectedKeywords(new Set());
    setAnalysis({ status: 'analyzing' });

    startTransition(async () => {
      try {
        const response = await fetch('/api/competitors/gap-analysis', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId,
            userDomain: userDomain.trim(),
            competitorDomains: filledDomains.map((d) => d.trim()),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setAnalysis({ status: 'error', message: data.error || 'Analysis failed.' });
          return;
        }

        setAnalysis({
          status: 'complete',
          data: data.gapKeywords,
          meta: {
            totalFound: data.totalFound,
            userKeywordCount: data.userKeywordCount,
            competitorDomains: data.competitorDomains,
          },
          errors: data.errors,
        });
      } catch (err) {
        setAnalysis({
          status: 'error',
          message: err instanceof Error ? err.message : 'Network error. Please try again.',
        });
      }
    });
  }, [userDomain, domains, projectId, addToast]);

  const toggleKeywordSelection = (keyword: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
  };

  const toggleAll = useCallback(() => {
    if (analysis.status !== 'complete') return;
    let filtered = analysis.data;
    if (minVolume > 0) {
      filtered = filtered.filter((k) => k.volume >= minVolume);
    }
    if (maxDifficulty < 100) {
      filtered = filtered.filter((k) => k.difficulty <= maxDifficulty);
    }
    if (contentTypeFilter !== 'all') {
      if (contentTypeFilter === 'informational') {
        filtered = filtered.filter((k) =>
          /\b(how|what|why|guide|tutorial|tips|learn|about|definition|meaning|explained)\b/i.test(k.keyword),
        );
      } else if (contentTypeFilter === 'commercial') {
        filtered = filtered.filter((k) =>
          /\b(best|top|review|compare|vs|versus|price|pricing|cost)\b/i.test(k.keyword),
        );
      } else if (contentTypeFilter === 'transactional') {
        filtered = filtered.filter((k) =>
          /\b(buy|order|hire|rent|sign up|free trial|download|shop|get)\b/i.test(k.keyword),
        );
      }
    }
    if (selectedKeywords.size === filtered.length) {
      setSelectedKeywords(new Set());
    } else {
      setSelectedKeywords(new Set(filtered.map((k) => k.keyword)));
    }
  }, [analysis, selectedKeywords.size, minVolume, maxDifficulty, contentTypeFilter]);

  const handleImportSelected = useCallback(async () => {
    if (selectedKeywords.size === 0) {
      addToast('Select keywords to import first.', 'error');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch('/api/keywords/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          keywords: Array.from(selectedKeywords),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Import failed.');
      }

      addToast(`${selectedKeywords.size} keyword(s) added to your research workspace.`, 'success');
      setSelectedKeywords(new Set());
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to import keywords.', 'error');
    } finally {
      setImporting(false);
    }
  }, [selectedKeywords, projectId, addToast]);

  const getFilteredKeywords = useCallback((): GapKeyword[] => {
    if (analysis.status !== 'complete') return [];

    let filtered = analysis.data;

    if (minVolume > 0) {
      filtered = filtered.filter((k) => k.volume >= minVolume);
    }
    if (maxDifficulty < 100) {
      filtered = filtered.filter((k) => k.difficulty <= maxDifficulty);
    }
    if (contentTypeFilter !== 'all') {
      if (contentTypeFilter === 'informational') {
        filtered = filtered.filter((k) =>
          /\b(how|what|why|guide|tutorial|tips|learn|about|definition|meaning|explained)\b/i.test(k.keyword),
        );
      } else if (contentTypeFilter === 'commercial') {
        filtered = filtered.filter((k) =>
          /\b(best|top|review|compare|vs|versus|price|pricing|cost)\b/i.test(k.keyword),
        );
      } else if (contentTypeFilter === 'transactional') {
        filtered = filtered.filter((k) =>
          /\b(buy|order|hire|rent|sign up|free trial|download|shop|get)\b/i.test(k.keyword),
        );
      }
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'opportunityScore':
          cmp = a.opportunityScore - b.opportunityScore;
          break;
        case 'volume':
          cmp = a.volume - b.volume;
          break;
        case 'difficulty':
          cmp = a.difficulty - b.difficulty;
          break;
        case 'keyword':
          cmp = a.keyword.localeCompare(b.keyword);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [analysis, minVolume, maxDifficulty, contentTypeFilter, sortField, sortOrder]);

  const resetAnalysis = () => {
    setAnalysis({ status: 'idle' });
    setSelectedKeywords(new Set());
    setMinVolume(0);
    setMaxDifficulty(100);
    setContentTypeFilter('all');
    setSortField('opportunityScore');
    setSortOrder('desc');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ── Input Section ── */}
      <Card className="space-y-5">
        <div className="section-header">
          <div>
            <p className="eyebrow">Content Gap Analysis</p>
            <h2 className="section-subtitle mt-2">Find keywords competitors rank for that you don&apos;t</h2>
            <p className="section-copy mt-1.5">
              Compare up to 3 competitor domains against your existing keywords to uncover untapped opportunities.
            </p>
          </div>
          {analysis.status === 'complete' && (
            <div className="flex items-center gap-3">
              <Badge variant="success">
                {analysis.data.length} gap keywords
              </Badge>
              <Button type="button" variant="ghost" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={resetAnalysis}>
                New Analysis
              </Button>
            </div>
          )}
        </div>

        {/* Inputs always visible except during analysis or when complete */}
        {(analysis.status === 'idle' || analysis.status === 'error') && (
          <div className="space-y-4">
            <Field label="Your domain" hint="The site you want to find gaps for.">
              <input
                type="text"
                className="field-input"
                placeholder="yourwebsite.com"
                value={userDomain}
                onChange={(e) => setUserDomain(e.target.value)}
              />
            </Field>

            <Field
              label="Competitor domains"
              hint={`${domains.filter((d) => d.trim()).length}/3 domains added. Enter fully qualified domains.`}
            >
              <div className="space-y-2.5">
                {domains.map((domain, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <GanttChart className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                      <input
                        type="text"
                        className="field-input pl-9"
                        placeholder={`competitor-${index + 1}.com`}
                        value={domain}
                        onChange={(e) => handleDomainChange(index, e.target.value)}
                      />
                    </div>
                    {domains.length > 1 && (
                      <button
                        type="button"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/5 transition-colors"
                        onClick={() => handleRemoveDomain(index)}
                        title="Remove domain"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {domains.length < 3 && (
                  <button
                    type="button"
                    className="flex items-center gap-2 text-body-sm font-medium text-accent hover:text-accent-hover transition-colors"
                    onClick={handleAddDomain}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add competitor domain ({domains.length}/3)
                  </button>
                )}
              </div>
            </Field>

            {analysis.status === 'error' && (
              <Alert variant="error" title="Analysis failed">
                {analysis.message}
              </Alert>
            )}

            <div className="action-row pt-2 border-t border-border/40">
              <Button
                type="button"
                size="md"
                icon={<Search className="h-4 w-4" />}
                loading={isPending}
                onClick={handleAnalyze}
                className="w-full sm:w-auto"
              >
                Analyze Gap
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                className="w-full sm:w-auto"
                onClick={() => {
                  setUserDomain(initialUserDomain || '');
                  setDomains(['']);
                  setAnalysis({ status: 'idle' });
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {analysis.status === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
              <BarChart3 className="h-12 w-12 text-accent/40 animate-pulse" />
              <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-accent" />
            </div>
            <p className="text-body font-semibold text-text-primary">Analyzing content gaps...</p>
            <p className="text-body-sm text-text-secondary text-center max-w-md">
              Searching competitor domains, extracting keywords, and comparing with your existing research.
              This may take 30-60 seconds for 3 domains.
            </p>
          </div>
        )}
      </Card>

      {/* ── Results Section ── */}
      {analysis.status === 'complete' && (
        <>
          {/* Stats bar */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-success/15 bg-success/[0.08]">
                  <TrendingUp className="h-4 w-4 text-success" />
                </span>
                <div>
                  <p className="text-heading-3">{analysis.data.length}</p>
                  <p className="text-caption text-text-muted">Gap keywords found</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/15 bg-accent/[0.06]">
                  <Target className="h-4 w-4 text-accent" />
                </span>
                <div>
                  <p className="text-heading-3">{analysis.meta.userKeywordCount}</p>
                  <p className="text-caption text-text-muted">Your keywords</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-warning/15 bg-warning/[0.06]">
                  <ExternalLink className="h-4 w-4 text-warning" />
                </span>
                <div>
                  <p className="text-heading-3">{analysis.meta.competitorDomains.length}</p>
                  <p className="text-caption text-text-muted">Competitors analyzed</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-info/15 bg-info/[0.06]">
                  <BarChart3 className="h-4 w-4 text-info" />
                </span>
                <div>
                  <p className="text-heading-3">{selectedKeywords.size}</p>
                  <p className="text-caption text-text-muted">Selected for import</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Errors from analysis */}
          {analysis.errors && analysis.errors.length > 0 && (
            <Alert variant="warning" title="Some issues during analysis">
              <ul className="list-disc pl-4 mt-1 space-y-1">
                {analysis.errors.map((err, i) => (
                  <li key={i} className="text-body-sm">{err}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={selectedKeywords.size > 0 ? 'primary' : 'secondary'}
                size="sm"
                icon={importing ? undefined : <Plus className="h-3.5 w-3.5" />}
                loading={importing}
                disabled={selectedKeywords.size === 0 || importing}
                onClick={handleImportSelected}
              >
                {selectedKeywords.size > 0
                  ? `Add ${selectedKeywords.size} to Research`
                  : 'Select to Import'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                className="text-body-sm"
              >
                {selectedKeywords.size === getFilteredKeywords().length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Filter className="h-3.5 w-3.5" />}
                onClick={() => setShowFilters(!showFilters)}
                className={cn(showFilters && 'text-accent bg-accent/[0.06]')}
              >
                Filters
                {((minVolume > 0) || (maxDifficulty < 100) || (contentTypeFilter !== 'all')) && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                    !
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="grid gap-3 p-4 rounded-xl border border-border/50 bg-surface-raised/60 sm:grid-cols-3">
              <Field label="Min. search volume" hint="Hide low-volume keywords.">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={5000}
                    step={100}
                    value={minVolume}
                    onChange={(e) => setMinVolume(Number(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <span className="min-w-[4rem] text-right text-body-sm font-mono text-text-secondary">
                    {minVolume > 0 ? formatVolume(minVolume) : 'Any'}
                  </span>
                </div>
              </Field>
              <Field label="Max. difficulty" hint="Filter by competition level.">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={maxDifficulty}
                    onChange={(e) => setMaxDifficulty(Number(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <span className="min-w-[3rem] text-right text-body-sm font-mono text-text-secondary">
                    {maxDifficulty < 100 ? maxDifficulty : '100'}
                  </span>
                </div>
              </Field>
              <Field label="Content type" hint="Filter by search intent.">
                <select
                  className="field-select"
                  value={contentTypeFilter}
                  onChange={(e) => setContentTypeFilter(e.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="informational">Informational</option>
                  <option value="commercial">Commercial</option>
                  <option value="transactional">Transactional</option>
                </select>
              </Field>
            </div>
          )}

          {/* Results table */}
          <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-raised/60">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
              <div className="flex items-center gap-2 text-body font-semibold text-text-primary">
                <GanttChart className="h-4 w-4 text-accent" />
                Gap Keywords
              </div>
              <span className="text-caption text-text-muted">
                {getFilteredKeywords().length} of {analysis.data.length} shown
              </span>
            </div>
            <div className="max-h-[600px] overflow-auto">
              {getFilteredKeywords().length === 0 ? (
                <EmptyState
                  icon={<Search className="h-8 w-8 text-text-muted" />}
                  title="No matching gap keywords"
                  description="Try adjusting your filters to see more results."
                />
              ) : (
                <table className="min-w-[700px] w-full text-left">
                  <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
                    <tr className="text-text-muted">
                      <th className="w-10 px-2 py-2.5">
                        <input
                          type="checkbox"
                          className="rounded border-border/50 accent-accent"
                          checked={selectedKeywords.size > 0 && selectedKeywords.size === getFilteredKeywords().length}
                          onChange={toggleAll}
                        />
                      </th>
                      <th
                        className="cursor-pointer px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 hover:text-accent transition-colors select-none"
                        onClick={() => {
                          if (sortField === 'keyword') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortField('keyword'); setSortOrder('asc'); }
                        }}
                      >
                        Keyword{sortField === 'keyword' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                      </th>
                      <th
                        className="cursor-pointer px-2.5 py-2.5 text-center text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 hover:text-accent transition-colors select-none"
                        onClick={() => {
                          if (sortField === 'volume') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortField('volume'); setSortOrder('desc'); }
                        }}
                      >
                        Volume{sortField === 'volume' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                      </th>
                      <th
                        className="cursor-pointer px-2.5 py-2.5 text-center text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 hover:text-accent transition-colors select-none"
                        onClick={() => {
                          if (sortField === 'difficulty') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortField('difficulty'); setSortOrder('asc'); }
                        }}
                      >
                        Difficulty{sortField === 'difficulty' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                      </th>
                      <th
                        className="cursor-pointer px-2.5 py-2.5 text-center text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 hover:text-accent transition-colors select-none"
                        onClick={() => {
                          if (sortField === 'opportunityScore') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          else { setSortField('opportunityScore'); setSortOrder('desc'); }
                        }}
                      >
                        Opportunity{sortField === 'opportunityScore' ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                      </th>
                      <th className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5">
                        Source
                      </th>
                      <th className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5">
                        Snippet
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {getFilteredKeywords().map((row, index) => {
                      const isSelected = selectedKeywords.has(row.keyword);
                      const scoreIndicator =
                        row.opportunityScore >= 5000 ? 'high' :
                        row.opportunityScore >= 2000 ? 'medium' : 'low';

                      return (
                        <tr
                          key={`${row.keyword}-${index}`}
                          className={cn(
                            'align-top transition-colors hover:bg-accent/[0.02]',
                            isSelected && 'bg-accent/[0.04]',
                            index % 2 === 1 && !isSelected && 'bg-surface-inset/30',
                          )}
                        >
                          <td className="px-2 py-2.5">
                            <input
                              type="checkbox"
                              className="rounded border-border/50 accent-accent"
                              checked={isSelected}
                              onChange={() => toggleKeywordSelection(row.keyword)}
                            />
                          </td>
                          <td className="max-w-[200px] truncate px-2.5 py-2.5 sm:px-3.5">
                            <span className="font-medium text-body-sm text-text-primary" title={row.keyword}>
                              {row.keyword}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-center sm:px-3.5">
                            <span className="font-mono text-body-sm text-text-secondary">
                              {formatVolume(row.volume)}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-center sm:px-3.5">
                            <span className={cn(
                              'inline-flex items-center gap-1 font-mono text-body-sm',
                              row.difficulty <= 30 ? 'text-success' :
                              row.difficulty <= 60 ? 'text-warning' :
                              'text-destructive',
                            )}>
                              {row.difficulty <= 30 ? <TrendingDown className="h-3 w-3" /> : row.difficulty > 60 ? <TrendingUp className="h-3 w-3" /> : null}
                              {row.difficulty}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-center sm:px-3.5">
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-caption font-semibold',
                              scoreIndicator === 'high' && 'bg-success/[0.08] text-success',
                              scoreIndicator === 'medium' && 'bg-warning/[0.08] text-warning',
                              scoreIndicator === 'low' && 'bg-surface text-text-muted',
                            )}>
                              {scoreIndicator === 'high' ? <ArrowUpAZ className="h-3 w-3" /> :
                               scoreIndicator === 'medium' ? <ArrowDownAZ className="h-3 w-3" /> :
                               <Info className="h-3 w-3" />}
                              {formatOpportunity(row.opportunityScore)}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 sm:px-3.5">
                            <span className="font-mono text-body-sm text-text-muted">
                              {row.source}
                            </span>
                          </td>
                          <td className="max-w-[180px] truncate px-2.5 py-2.5 sm:px-3.5">
                            <span className="text-body-sm text-text-secondary" title={row.contentSnippet}>
                              {row.contentSnippet || '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Tip */}
          <div className="rounded-lg border border-accent/10 bg-accent/[0.02] p-4 flex items-start gap-3">
            <Info className="h-4 w-4 shrink-0 text-accent mt-0.5" />
            <div>
              <p className="text-body-sm font-semibold text-text-primary">How to use gap keywords</p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Select high-opportunity keywords and click &ldquo;Add to Research&rdquo; to import them into your workspace. 
                These keywords represent content topics your competitors cover but you don&apos;t &mdash; ideal candidates 
                for new content creation, blog posts, or landing pages.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {analysis.status === 'idle' && !isPending && (
        <EmptyState
          icon={<GanttChart className="h-12 w-12 text-text-muted/40" />}
          title="Ready to find content gaps"
          description="Enter your domain and 1-3 competitor domains above, then click Analyze Gap to discover keywords your competitors rank for that you're missing."
        />
      )}
    </div>
  );
}
