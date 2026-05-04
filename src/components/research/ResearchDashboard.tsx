'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftRight, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, History, Loader2, Radar, RefreshCcw, Search, Star, TableProperties, Trash2, TrendingUp, UploadCloud, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, EmptyState, Field, Metric, Tabs } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { buildProjectRunPath } from '@/lib/project-context';
import type { ResearchProjectDetail, ResearchRow, ResearchRunDetail, ResearchRunSummary } from '@/lib/research';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';
import { createProjectRunFormSchema, type CreateProjectRunFormInput } from '@/lib/validation';
import DifficultyBadge, { DifficultyVariantToggle } from './DifficultyBadge';
import PersonalDifficultyBadge from './PersonalDifficultyBadge';
import { usePersonalDifficulty } from '@/hooks/usePersonalDifficulty';
import type { PersonalDifficultyData } from './PersonalDifficultyBadge';
import MobileKeywordView from './MobileKeywordView';
import ResearchProcessTracker from './ResearchProcessTracker';
import KeywordDetailPanel from './KeywordDetailPanel';
import IntentBadge from './IntentBadge';
import QuestionsTab from './QuestionsTab';
import ContentMap from './ContentMap';
import KeywordClusters from './KeywordClusters';
import BulkKeywordImport from './BulkKeywordImport';
import BulkActionsToolbar, { type BulkAction } from './BulkActionsToolbar';
import SERPCompare from './SERPCompare';
import { SerpFeatureIcons } from './SERPFeaturesPanel';
import type { SerpFeature } from '@/lib/serp-features';
import ListCompare from './ListCompare';
import { exportKeywordsToCsv } from '@/lib/export-csv';
import FilterPresets, { type CurrentFilters } from './FilterPresets';
import SavedSearches, { useSavedSearches, type SavedSearch, type SearchHistoryItem } from './SavedSearches';
import VolumeTrendChart, { type VolumeTrendData } from './VolumeTrendChart';

type CompetitorDiscoveryState = {
  status: 'idle' | 'success' | 'empty' | 'error';
  message?: string;
  metadata?: { methods?: string[]; totalCandidates?: number; [key: string]: unknown };
};

function buildRunsUrl(projectId: string) {
  return `/api/runs?projectId=${encodeURIComponent(projectId)}`;
}

function buildRunUrl(projectId: string, runId: string) {
  return `/api/runs/${runId}?projectId=${encodeURIComponent(projectId)}`;
}

function buildKeywordsUrl(runId: string, page: number, limit: number, sort: string, order: string) {
  const params = new URLSearchParams({
    runId,
    page: String(page),
    limit: String(limit),
    sort,
    order,
  });
  return `/api/keywords?${params.toString()}`;
}

type KeywordsApiResponse = {
  data: ResearchRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

function buildDefaultValues(project: ResearchProjectDetail): CreateProjectRunFormInput {
  return {
    competitorUrls: project.competitorUrls.join('\n'),
    notes: project.notes || '',
    mode: 'fresh',
    targetRows: 220,
  };
}

const statusBadgeMap: Record<ResearchRunSummary['status'], { variant: 'warning' | 'info' | 'success' | 'error'; label: string }> = {
  queued: { variant: 'warning', label: 'Queued' },
  processing: { variant: 'info', label: 'Processing' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'error', label: 'Failed' },
  cancelled: { variant: 'warning', label: 'Cancelled' },
};

/** Trigger a file download without opening a new tab (avoids popup blockers). */
function triggerDownload(runId: string, addToast: (msg: string, type: 'error' | 'success') => void, setDownloading: (v: boolean) => void) {
  setDownloading(true);
  fetch(`/api/runs/${runId}/download`)
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Download failed.');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
      const filename = match ? decodeURIComponent(match[1]) : 'keyword-research.xlsx';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      addToast('Workbook downloaded successfully.', 'success');
    })
    .catch((err) => {
      addToast(err instanceof Error ? err.message : 'Download failed.', 'error');
    })
    .finally(() => setDownloading(false));
}

export default function ResearchDashboard({ project, initialRunId, userDomain = '' }: { project: ResearchProjectDetail; initialRunId?: string | null; userDomain?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedRunId, setSelectedRunId] = useState(initialRunId || null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'logs' | 'summary' | 'questions' | 'content-map' | 'clusters'>('preview');
  const [questionSeedKeyword, setQuestionSeedKeyword] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [isDiscoveringCompetitors, startCompetitorDiscovery] = useTransition();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);
  const [isRefreshingResearch, setIsRefreshingResearch] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [competitorDiscovery, setCompetitorDiscovery] = useState<CompetitorDiscoveryState>({
    status: 'idle',
  });
  const [detailKeyword, setDetailKeyword] = useState<ResearchRow | null>(null);
  const [isClassifyingIntents, setIsClassifyingIntents] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showListCompare, setShowListCompare] = useState(false);
  const [showSerpCompare, setShowSerpCompare] = useState(false);
  // Volume trends
  const [showTrends, setShowTrends] = useState(false);
  const [trendData, setTrendData] = useState<VolumeTrendData[] | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const form = useForm<CreateProjectRunFormInput>({
    resolver: zodResolver(createProjectRunFormSchema),
    defaultValues: buildDefaultValues(project),
  });

  const runsQuery = useQuery({
    queryKey: ['runs', project.id],
    queryFn: async () => {
      const response = await fetch(buildRunsUrl(project.id));
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load runs.');
      }
      return payload.runs as ResearchRunSummary[];
    },
    refetchInterval: (query) => {
      const runs = (query.state.data || []) as ResearchRunSummary[];
      return runs.some((run) => run.status === 'queued' || run.status === 'processing') ? 4000 : false;
    },
  });

  const runQuery = useQuery({
    queryKey: ['run', project.id, selectedRunId],
    queryFn: async () => {
      const response = await fetch(buildRunUrl(project.id, selectedRunId!));
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load the run.');
      }
      return payload.run as ResearchRunDetail;
    },
    enabled: Boolean(selectedRunId),
    refetchInterval: (query) => {
      const run = query.state.data as ResearchRunDetail | undefined;
      return run && (run.status === 'queued' || run.status === 'processing') ? 3000 : false;
    },
  });

  useEffect(() => {
    if (!selectedRunId && runsQuery.data?.length) {
      setSelectedRunId(runsQuery.data[0].id);
    }
  }, [runsQuery.data, selectedRunId]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const selectedRun = runQuery.data;

  const searchParams = useSearchParams();
  const [previewSort, setPreviewSort] = useState<string>('volume');
  const [previewSortOrder, setPreviewSortOrder] = useState<string>('desc');

  // Filter state
  const [filterMinDifficulty, setFilterMinDifficulty] = useState(0);
  const [filterMaxDifficulty, setFilterMaxDifficulty] = useState(100);
  const [filterMinVolume, setFilterMinVolume] = useState(0);
  const [filterMaxVolume, setFilterMaxVolume] = useState(1_000_000);
  const [filterIntents, setFilterIntents] = useState<string[]>([]);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');

  // Saved searches & search history
  const savedSearches = useSavedSearches();
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [triggerSaveDialog, setTriggerSaveDialog] = useState(false);

  const currentFilterState: CurrentFilters = useMemo(() => ({
    minDifficulty: filterMinDifficulty,
    maxDifficulty: filterMaxDifficulty,
    minVolume: filterMinVolume,
    maxVolume: filterMaxVolume,
    intents: filterIntents,
    sortBy: previewSort,
    sortOrder: previewSortOrder as 'asc' | 'desc',
    searchQuery: filterSearchQuery,
  }), [
    filterMinDifficulty,
    filterMaxDifficulty,
    filterMinVolume,
    filterMaxVolume,
    filterIntents,
    previewSort,
    previewSortOrder,
    filterSearchQuery,
  ]);

  // Read page from URL; fall back to 1 if not present
  const previewPage = (() => {
    const raw = searchParams.get('page');
    const parsed = raw ? parseInt(raw, 10) : 1;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  })();
  const [previewPageSize, setPreviewPageSize] = useState<number>(50);

  const keywordsQuery = useQuery({
    queryKey: ['keywords', selectedRunId, previewPage, previewPageSize, previewSort, previewSortOrder],
    queryFn: async (): Promise<KeywordsApiResponse> => {
      const response = await fetch(
        buildKeywordsUrl(selectedRunId!, previewPage, previewPageSize, previewSort, previewSortOrder),
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load keywords.');
      }
      return payload;
    },
    enabled: Boolean(selectedRunId),
    placeholderData: (prev) => prev, // keep previous data while loading next page
  });

  const previewRows = keywordsQuery.data?.data ?? [];
  const pagination = keywordsQuery.data?.pagination ?? { page: 1, limit: previewPageSize, total: 0, totalPages: 1 };
  const isLoadingKeywords = keywordsQuery.isFetching && !keywordsQuery.isPending;

  // ── Personal Difficulty analysis ──
  const previewKeywordList = useMemo(
    () => previewRows.map((r) => r.primaryKeyword).filter(Boolean),
    [previewRows],
  );
  const {
    dataMap: personalDifficultyMap,
    loading: loadingPersonalDifficulty,
    pendingCount: pendingPersonalDiff,
  } = usePersonalDifficulty({
    domain: userDomain,
    keywords: userDomain ? previewKeywordList : [],
    batchSize: 5,
    batchDelayMs: 500,
  });
  const hasDomain = Boolean(userDomain);

  // ── SERP Features analysis state ──
  const [serpFeaturesData, setSerpFeaturesData] = useState<Map<string, SerpFeature[]> | undefined>(undefined);
  const [analyzingSerpFeatures, setAnalyzingSerpFeatures] = useState(false);

  const handleAnalyzeSerpFeatures = useCallback(async () => {
    const allKeywords = keywordsQuery.data?.data.map((r: ResearchRow) => r.primaryKeyword).filter(Boolean) ?? [];
    if (allKeywords.length === 0) {
      addToast('No keywords to analyze.', 'error');
      return;
    }
    setAnalyzingSerpFeatures(true);
    try {
      const response = await fetch('/api/keywords/serp-features', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords: allKeywords.slice(0, 50) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Analysis failed');

      const map = new Map<string, SerpFeature[]>();
      for (const r of body.results ?? []) {
        map.set(r.keyword, r.features);
      }
      setSerpFeaturesData(map);
      addToast(
        `Detected features across ${body.summary.totalFeatureTypesFound} types in ${body.summary.keywordsWithFeatures} keywords.`,
        'success',
      );
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'SERP feature analysis failed', 'error');
    } finally {
      setAnalyzingSerpFeatures(false);
    }
  }, [keywordsQuery.data, addToast]);

  // Client-side filtering of preview rows
  const filteredPreviewRows = useMemo(() => {
    let rows = previewRows;

    // Search query filter
    if (filterSearchQuery.trim()) {
      const q = filterSearchQuery.toLowerCase().trim();
      rows = rows.filter(
        (row) =>
          row.primaryKeyword?.toLowerCase().includes(q) ||
          row.pillar?.toLowerCase().includes(q) ||
          row.cluster?.toLowerCase().includes(q) ||
          row.keywords?.some((k) => k.toLowerCase().includes(q)),
      );
    }

    // Intent filter
    if (filterIntents.length > 0) {
      rows = rows.filter((row) => filterIntents.includes(row.intent || ''));
    }

    // Difficulty filter
    rows = rows.filter((row) => {
      const d = row.difficulty;
      if (d == null) return true; // no difficulty data — include
      return d >= filterMinDifficulty && d <= filterMaxDifficulty;
    });

    // Volume filter
    rows = rows.filter((row) => {
      const v = row.searchVolume;
      if (v == null) return true; // no volume data — include
      return v >= filterMinVolume && v <= filterMaxVolume;
    });

    return rows;
  }, [previewRows, filterSearchQuery, filterIntents, filterMinDifficulty, filterMaxDifficulty, filterMinVolume, filterMaxVolume]);

  // ── Keywords selection state ──
  const [selectedKeywordSet, setSelectedKeywordSet] = useState<Set<string>>(new Set());
  const [processingBulkAction, setProcessingBulkAction] = useState<BulkAction | null>(null);

  // Clear selection when run changes
  useEffect(() => {
    setSelectedKeywordSet(new Set());
  }, [selectedRunId]);

  const handleKeywordSelection = useCallback((keyword: string, selected: boolean) => {
    setSelectedKeywordSet((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(keyword);
      } else {
        next.delete(keyword);
      }
      return next;
    });
  }, []);

  const handleSelectAllVisible = useCallback(() => {
    setSelectedKeywordSet((prev) => {
      const next = new Set(prev);
      filteredPreviewRows.forEach((r) => next.add(r.primaryKeyword));
      return next;
    });
  }, [filteredPreviewRows]);

  const handleClearSelection = useCallback(() => {
    setSelectedKeywordSet(new Set());
  }, []);

  const handleBulkAction = useCallback((action: BulkAction) => {
    const selectedRows = filteredPreviewRows.filter((r) => selectedKeywordSet.has(r.primaryKeyword));
    switch (action) {
      case 'add-to-list':
        // Add to keyword list — parent handles via callbacks
        handleClearSelection();
        break;
      case 'export-csv':
        setProcessingBulkAction('export-csv');
        setTimeout(() => {
          exportKeywordsToCsv(selectedRows);
          setProcessingBulkAction(null);
        }, 150);
        break;
      case 'generate-brief':
        setProcessingBulkAction('generate-brief');
        // TODO: integrate content brief generator
        setTimeout(() => {
          addToast(`Content brief requested for ${selectedRows.length} keywords.`, 'success');
          setProcessingBulkAction(null);
        }, 150);
        break;
      case 'cluster-selected':
        setProcessingBulkAction('cluster-selected');
        // TODO: integrate clustering
        setTimeout(() => {
          addToast(`Clustering requested for ${selectedRows.length} keywords.`, 'success');
          setProcessingBulkAction(null);
        }, 150);
        break;
      case 'select-all':
        handleSelectAllVisible();
        break;
      case 'clear-selection':
        handleClearSelection();
        break;
    }
  }, [filteredPreviewRows, selectedKeywordSet, handleClearSelection, handleSelectAllVisible, addToast]);

  // Reset sort/page when run changes
  useEffect(() => { setPreviewSort('volume'); setPreviewSortOrder('desc'); }, [selectedRunId]);

  // Update URL when page changes
  const updatePageUrl = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newPage <= 1) {
        params.delete('page');
      } else {
        params.set('page', String(newPage));
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    },
    [router, searchParams],
  );

  const handlePageChange = useCallback(
    (page: number) => updatePageUrl(page),
    [updatePageUrl],
  );

  const handleLoadPreset = useCallback(
    (preset: CurrentFilters) => {
      setFilterMinDifficulty(preset.minDifficulty);
      setFilterMaxDifficulty(preset.maxDifficulty);
      setFilterMinVolume(preset.minVolume);
      setFilterMaxVolume(preset.maxVolume);
      setFilterIntents(preset.intents);
      setPreviewSort(preset.sortBy);
      setPreviewSortOrder(preset.sortOrder);
      setFilterSearchQuery(preset.searchQuery);
      handlePageChange(1);
    },
    [handlePageChange],
  );

  // ── Saved Searches handlers ──────────────────────────────────────────────

  const handleAddToHistory = useCallback(() => {
    if (!filterSearchQuery.trim()) return;
    savedSearches.addToHistory({
      query: filterSearchQuery.trim(),
      resultCount: filteredPreviewRows.length,
    });
  }, [filterSearchQuery, filteredPreviewRows.length, savedSearches]);

  // Auto-save to history when search query changes (debounced via the fact we track it on enter/blur)
  const [lastHistoryQuery, setLastHistoryQuery] = useState('');
  useEffect(() => {
    const q = filterSearchQuery.trim();
    if (q && q !== lastHistoryQuery && previewRows.length > 0) {
      // Only add to history if the user has typed something meaningful
      // We use a simple heuristic: add when the query has been stable for 1.5 seconds
      const timer = setTimeout(() => {
        savedSearches.addToHistory({
          query: q,
          resultCount: filteredPreviewRows.length,
        });
        setLastHistoryQuery(q);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [filterSearchQuery, lastHistoryQuery, previewRows.length, filteredPreviewRows.length, savedSearches]);

  const handleHistoryClick = useCallback(
    (item: SearchHistoryItem) => {
      setFilterSearchQuery(item.query);
      handlePageChange(1);
      setShowSavedSearches(false);
    },
    [handlePageChange],
  );

  const handleSavedClick = useCallback(
    (item: SavedSearch) => {
      setFilterSearchQuery(item.query);
      setFilterMinDifficulty(item.filters.minDifficulty);
      setFilterMaxDifficulty(item.filters.maxDifficulty);
      setFilterMinVolume(item.filters.minVolume);
      setFilterMaxVolume(item.filters.maxVolume);
      setFilterIntents(item.filters.intents);
      handlePageChange(1);
      setShowSavedSearches(false);
    },
    [handlePageChange],
  );

  const handleSaveCurrent = useCallback(
    (name: string) => {
      savedSearches.saveSearch(
        name,
        filterSearchQuery,
        {
          minDifficulty: filterMinDifficulty,
          maxDifficulty: filterMaxDifficulty,
          minVolume: filterMinVolume,
          maxVolume: filterMaxVolume,
          intents: filterIntents,
        },
      );
      addToast('Search saved.', 'success');
    },
    [filterSearchQuery, filterMinDifficulty, filterMaxDifficulty, filterMinVolume, filterMaxVolume, filterIntents, savedSearches, addToast],
  );

  // Keyboard shortcut: Ctrl+Shift+S to save search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (showSavedSearches) {
          setTriggerSaveDialog(true);
        } else {
          setShowSavedSearches(true);
          // Will trigger save dialog after panel opens
          setTimeout(() => setTriggerSaveDialog(true), 200);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showSavedSearches]);

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPreviewPageSize(size);
      // Reset to page 1 when changing page size
      updatePageUrl(1);
    },
    [updatePageUrl],
  );
  const formatDateTimeLabel = (value: string | number | Date | null | undefined, fallback = 'Syncing time...') =>
    hasMounted ? formatDateTime(value, fallback) : fallback;
  const formatRelativeLabel = (value: string | number | Date | null | undefined, fallback = 'Syncing...') =>
    hasMounted ? formatRelative(value, fallback) : fallback;

  const handleDownload = useCallback(() => {
    if (!selectedRun?.workbookName) return;
    triggerDownload(selectedRun.id, addToast, setIsDownloading);
  }, [selectedRun?.id, selectedRun?.workbookName, addToast]);

  const handleCancel = useCallback(async () => {
    if (!selectedRun) return;
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/runs/${selectedRun.id}/cancel`, { method: 'POST' });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        addToast(result?.error || 'Unable to cancel run.', 'error');
        return;
      }
      addToast('Run cancelled.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['run', project.id, selectedRun.id] });
    } finally {
      setIsCancelling(false);
    }
  }, [selectedRun, selectedRun?.id, project.id, addToast, queryClient]);

  const handleRerun = useCallback(async () => {
    if (!selectedRun?.input) return;
    setIsRerunning(true);
    try {
      const input = selectedRun.input;
      const payload = new FormData();
      payload.set('projectId', project.id);
      payload.set('competitorUrls', (input.competitorUrls ?? []).join('\n'));
      payload.set('notes', input.notes || '');
      payload.set('mode', 'fresh');
      payload.set('targetRows', String(input.targetRows ?? 220));

      const response = await fetch('/api/runs', { method: 'POST', body: payload });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        addToast(result?.error || 'Unable to start rerun.', 'error');
        return;
      }
      addToast('Rerun queued — starting fresh research.', 'success');
      setSelectedRunId(result.runId);
      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['run', project.id, result.runId] });
    } finally {
      setIsRerunning(false);
    }
  }, [selectedRun?.input, project.id, addToast, queryClient]);

  const handleRefreshResearch = useCallback(async () => {
    if (!selectedRun?.input) return;
    setIsRefreshingResearch(true);
    try {
      const input = selectedRun.input;
      const payload = new FormData();
      payload.set('projectId', project.id);
      payload.set('competitorUrls', (input.competitorUrls ?? []).join('\n'));
      payload.set('notes', input.notes || '');
      payload.set('mode', 'fresh');
      payload.set('targetRows', String(input.targetRows ?? 220));
      payload.set('refresh', 'true');

      const response = await fetch('/api/runs', { method: 'POST', body: payload });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        addToast(result?.error || 'Unable to start research refresh.', 'error');
        return;
      }
      addToast('Refresh queued — bypassing cache for fresh results.', 'success');
      setSelectedRunId(result.runId);
      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['run', project.id, result.runId] });
    } finally {
      setIsRefreshingResearch(false);
    }
  }, [selectedRun?.input, project.id, addToast, queryClient]);

  const handleClassifyIntents = useCallback(async () => {
    if (!selectedRunId || !keywordsQuery.data) return;
    setIsClassifyingIntents(true);
    try {
      const keywords = keywordsQuery.data.data.map((row: ResearchRow) => row.primaryKeyword).filter(Boolean);
      if (keywords.length === 0) {
        addToast('No keywords to classify.', 'error');
        return;
      }

      const response = await fetch('/api/keywords/classify-intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        addToast(result?.error || 'Intent classification failed.', 'error');
        return;
      }

      // Build a map of keyword → intent
      const intentMap = new Map<string, string>();
      for (const item of result.results) {
        intentMap.set(item.keyword, item.intent);
      }

      // Update the local rows with the classified intents
      const classified = keywordsQuery.data.data.map((row: ResearchRow) => ({
        ...row,
        intent: (intentMap.get(row.primaryKeyword) as ResearchRow['intent']) || row.intent,
      }));

      // Update the query cache
      queryClient.setQueryData(
        ['keywords', selectedRunId, previewPage, previewPageSize, previewSort, previewSortOrder],
        { data: classified, pagination: keywordsQuery.data.pagination },
      );

      addToast(`Classified ${result.results.length} keywords.`, 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Classification failed.', 'error');
    } finally {
      setIsClassifyingIntents(false);
    }
  }, [selectedRunId, keywordsQuery.data, previewPage, previewPageSize, previewSort, previewSortOrder, addToast, queryClient]);

  const handleToggleTrends = useCallback(async () => {
    if (showTrends) {
      setShowTrends(false);
      setTrendData(null);
      return;
    }

    const keywords = filteredPreviewRows
      .slice(0, 5)
      .map((r) => r.primaryKeyword)
      .filter(Boolean);

    if (keywords.length === 0) {
      addToast('No keywords available for trends.', 'error');
      return;
    }

    setShowTrends(true);
    setTrendLoading(true);

    try {
      const res = await fetch('/api/keywords/volume-trends', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load trends');
      setTrendData(json.trends);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Trend load failed.', 'error');
      setShowTrends(false);
    } finally {
      setTrendLoading(false);
    }
  }, [showTrends, filteredPreviewRows, addToast]);

  const handleSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload = new FormData();
      payload.set('projectId', project.id);
      payload.set('competitorUrls', values.competitorUrls);
      payload.set('notes', values.notes || '');
      payload.set('mode', values.mode);
      payload.set('targetRows', String(values.targetRows));
      if (uploadedFile) {
        payload.set('existingResearch', uploadedFile);
      }

      const response = await fetch('/api/runs', { method: 'POST', body: payload });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        addToast(result?.error || 'Unable to start the research run.', 'error');
        return;
      }

      addToast('Research run queued successfully.', 'success');
      setSelectedRunId(result.runId);
      setUploadedFile(null);
      setCompetitorDiscovery({ status: 'idle' });
      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['run', project.id, result.runId] });
    });
  });

  const handleAutoFindCompetitors = () => {
    startCompetitorDiscovery(async () => {
      try {
        const values = form.getValues();
        const response = await fetch('/api/competitors/discover', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            homepageUrl: project.homepageUrl,
            aboutUrl: project.aboutUrl,
            sitemapUrl: project.sitemapUrl,
            brandName: project.brandName,
            language: project.language,
            market: project.market,
            competitorUrls: values.competitorUrls,
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          const message = result?.error || 'Unable to discover competitors automatically.';
          setCompetitorDiscovery({ status: 'error', message });
          addToast(message, 'error');
          return;
        }
        const discoveredUrls = (result?.competitors || []).map((competitor: { url: string }) => competitor.url);
        const nextValue = [...new Set([...values.competitorUrls.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean), ...discoveredUrls])].join('\n');
        form.setValue('competitorUrls', nextValue, { shouldDirty: true, shouldValidate: true });
        const discoveryMeta = result?.metadata ?? result?.discoveryMeta ?? undefined;
        setCompetitorDiscovery({
          status: discoveredUrls.length ? 'success' : 'empty',
          message: discoveredUrls.length
            ? `Found ${discoveredUrls.length} competitor${discoveredUrls.length === 1 ? '' : 's'} and added to the list.`
            : 'No strong competitors found. The system tried multiple discovery approaches but couldn\u2019t find relevant competitors for this niche.',
          metadata: discoveryMeta,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to discover competitors automatically.';
        setCompetitorDiscovery({ status: 'error', message });
        addToast(message, 'error');
      }
    });
  };

  const handleDeleteRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      if (selectedRunId === runId) setSelectedRunId(null);
      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
      addToast('Run deleted successfully.', 'success');
    } catch {
      addToast('Failed to delete run.', 'error');
    } finally {
      setDeletingRunId(null);
    }
  };

  return (
    <div className="min-w-0 page-stack">
      {/* ── Hero section ── */}
      <section className="animate-enter grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr] [&>*]:min-w-0">
        <Card variant="hero" className="space-y-5">
          <div>
            <p className="eyebrow">Selected workspace</p>
            <h1 className="mt-2 text-heading-1 sm:text-2xl">{project.name}</h1>
            <p className="mt-2 max-w-xl text-body leading-relaxed text-text-secondary">
              This workspace is scoped to {project.brandName}. Every run, log, preview, and export stays attached to this site.
            </p>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <Metric label="Brand" value={project.brandName} helper={`${project.language} · ${project.market}`} />
            <Metric label="Runs" value={String(project.runCount)} helper={runsQuery.data?.[0] ? `Latest ${formatRelativeLabel(runsQuery.data[0].queuedAt)}` : 'No runs yet'} />
            <Metric label="Sitemap" value="Validated" helper={project.sitemapUrl} />
          </div>
        </Card>
        <Card className="space-y-5">
          <div>
            <p className="eyebrow">Website profile</p>
            <h2 className="mt-2 section-subtitle">Locked profile inputs</h2>
            <p className="mt-1.5 section-copy">Fixed for this workspace. Change them in the project selector if needed.</p>
          </div>
          <div className="space-y-2">
            <InfoRow label="Homepage" value={project.homepageUrl} />
            <div className="grid gap-2 sm:grid-cols-2">
              <InfoRow label="About page" value={project.aboutUrl} />
              <InfoRow label="Sitemap" value={project.sitemapUrl} />
            </div>
            {project.notes ? <InfoRow label="Notes" value={project.notes} multiline /> : null}
          </div>
        </Card>
      </section>

      {/* ── New run + Live run ── */}
      <section id="new-research" className="animate-enter-delayed grid gap-6 lg:grid-cols-2 xl:grid-cols-[1.03fr_0.97fr] [&>*]:min-w-0">
        <Card className="space-y-5">
          <div className="section-header">
            <div>
              <p className="eyebrow">New run</p>
              <h2 className="section-subtitle mt-2">Launch a research run</h2>
              <p className="section-copy mt-1.5">Update competitors, notes, mode, and output size.</p>
            </div>
            <div className="toolbar-chip flex flex-wrap items-center gap-1.5 max-w-[12rem] sm:max-w-[14rem]">
              <UploadCloud className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="truncate min-w-0 text-caption">{uploadedFile ? uploadedFile.name : 'No workbook'}</span>
            </div>
          </div>
          <form id="new-run-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Mode" error={form.formState.errors.mode?.message}>
                <select className="field-select" {...form.register('mode')}>
                  <option value="fresh">Create completely fresh research</option>
                  <option value="expand">Expand existing research</option>
                </select>
              </Field>
              <Field label="Target rows" error={form.formState.errors.targetRows?.message}>
                <input className="field-input" type="number" min={120} max={320} step={5} {...form.register('targetRows', { valueAsNumber: true })} />
              </Field>
            </div>
            <Field label="Competitor URLs" error={form.formState.errors.competitorUrls?.message as string | undefined} hint="One per line, or auto-discover.">
              <div className="form-section space-y-3">
                <div className="action-row sm:justify-between">
                  <div className="max-w-2xl min-w-0">
                    <p className="text-body font-medium text-text-primary">Auto-discover competitors</p>
                    <p className="mt-0.5 text-body-sm text-text-secondary">Scan your site profile and find relevant competitors.</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Radar className="h-3.5 w-3.5" />}
                    loading={isDiscoveringCompetitors}
                    disabled={isDiscoveringCompetitors}
                    onClick={handleAutoFindCompetitors}
                    className="w-full shrink-0 sm:w-auto"
                  >
                    Find Competitors
                  </Button>
                </div>
                {competitorDiscovery.status === 'success' ? (
                  <Alert variant="success" title="Discovery complete">
                    <p>{competitorDiscovery.message}</p>
                    {competitorDiscovery.metadata?.methods && (
                      <p className="mt-1 text-body-sm text-text-secondary">
                        Methods used: {competitorDiscovery.metadata.methods.join(', ')}
                        {competitorDiscovery.metadata.totalCandidates != null && (
                          <> &middot; {competitorDiscovery.metadata.totalCandidates} candidates evaluated</>
                        )}
                      </p>
                    )}
                  </Alert>
                ) : competitorDiscovery.status === 'empty' ? (
                  <Alert variant="warning" title="No results">
                    {competitorDiscovery.message}
                  </Alert>
                ) : competitorDiscovery.status === 'error' ? (
                  <Alert variant="error" title="Discovery failed">
                    {competitorDiscovery.message}
                  </Alert>
                ) : null}
                <textarea
                  className="field-textarea"
                  placeholder="https://competitor-one.com&#10;https://competitor-two.com"
                  {...form.register('competitorUrls')}
                />
              </div>
            </Field>
            <Field label="Notes / instructions" error={form.formState.errors.notes?.message} hint="Optional.">
              <textarea className="field-textarea" placeholder="Add any research constraints, exclusions, or audience notes" {...form.register('notes')} />
            </Field>
            <Field label="Existing workbook" hint="Upload to seed expansion mode.">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 bg-surface-raised/50 px-4 py-3 text-body text-text-secondary transition-all hover:border-accent/20 hover:bg-surface">
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">{uploadedFile ? uploadedFile.name : 'Upload optional workbook'}</p>
                  <p className="mt-0.5 text-caption text-text-muted">.xlsx, .xls, or .csv up to 10 MB</p>
                </div>
                <span className="toolbar-chip shrink-0 border-accent/15 bg-accent/[0.05] text-accent">{uploadedFile ? 'Replace' : 'Choose file'}</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => setUploadedFile(event.target.files?.[0] || null)} />
              </label>
            </Field>
            <div className="action-row border-t border-border/40 pt-4">
              <Button type="submit" size="md" loading={isPending} className="w-full sm:w-auto">
                Run research
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                className="w-full sm:w-auto"
                onClick={() => {
                  form.reset(buildDefaultValues(project));
                  setCompetitorDiscovery({ status: 'idle' });
                  setUploadedFile(null);
                }}
              >
                Reset form
              </Button>
            </div>
          </form>
        </Card>

        <Card className="space-y-5">
          <div className="section-header">
            <div>
              <p className="eyebrow">Live run</p>
              <h2 className="section-subtitle mt-2">Status, logs, preview, and export</h2>
            </div>
            {selectedRun ? (
              <Badge variant={(statusBadgeMap[selectedRun.status as ResearchRunSummary['status']] ?? { variant: 'info' as const }).variant}>
                {(statusBadgeMap[selectedRun.status as ResearchRunSummary['status']] ?? { label: selectedRun.status }).label}
              </Badge>
            ) : (
              <Badge variant="neutral">
                No run selected
              </Badge>
            )}
          </div>
          {!selectedRun ? (
            <EmptyState
              icon={<FileSpreadsheet className="h-8 w-8 text-text-muted" />}
              title="No run selected"
              description="Queue a new research run or select from history below."
              action={{
                label: 'Start a run',
                onClick: () => {
                  const newRunSection = document.getElementById('new-run-form');
                  newRunSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                },
              }}
            />
          ) : (
            <div className="space-y-4">
              {/* Success banner — primary action hub when research is complete */}
              {selectedRun.status === 'completed' && selectedRun.workbookName ? (
                <div className="rounded-xl border border-success/20 bg-success/[0.04] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-success/15 bg-success/[0.08]">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-body font-semibold text-text-primary">Research complete</p>
                        <p className="mt-0.5 text-body-sm text-text-secondary truncate">{selectedRun.rows.length} rows &middot; {selectedRun.workbookName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button type="button" variant="primary" size="sm" icon={<Download className="h-3.5 w-3.5" />} loading={isDownloading} onClick={handleDownload} className="w-full shrink-0 sm:w-auto">
                        Download XLSX
                      </Button>
                      <Button type="button" variant="secondary" size="sm" icon={<RefreshCcw className="h-3.5 w-3.5" />} loading={isRefreshingResearch} onClick={handleRefreshResearch} className="shrink-0">
                        Refresh Research
                      </Button>
                      <Button type="button" variant="ghost" size="sm" icon={<RefreshCcw className="h-3.5 w-3.5" />} loading={isRerunning} onClick={handleRerun} className="shrink-0">
                        Rerun
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Failed banner */}
              {selectedRun.status === 'failed' ? (
                <div className="space-y-3">
                  <Alert variant="error" title="Run failed">
                    {selectedRun.errorMessage || 'An unexpected error occurred during processing.'}
                  </Alert>
                  <Button type="button" variant="secondary" size="sm" icon={<RefreshCcw className="h-3.5 w-3.5" />} loading={isRerunning} onClick={handleRerun} className="w-full sm:w-auto">
                    Rerun with same settings
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-2.5 sm:grid-cols-2">
                <Metric label="Brand" value={selectedRun.brandName} helper={`${selectedRun.language} · ${selectedRun.market}`} />
                <Metric label="Queued" value={formatDateTimeLabel(selectedRun.queuedAt)} helper={selectedRun.step || 'Awaiting updates'} />
              </div>
              <ResearchProcessTracker run={selectedRun} onCancel={handleCancel} isCancelling={isCancelling} />
              <div className="action-row">
                {/* Only show Download/Rerun here when success banner is NOT visible (i.e. not completed+workbook) */}
                {!(selectedRun.status === 'completed' && selectedRun.workbookName) && (
                  <>
                    <Button type="button" variant="primary" size="sm" icon={<Download className="h-3.5 w-3.5" />} disabled={!selectedRun.workbookName} loading={isDownloading} onClick={handleDownload} className="w-full sm:w-auto">
                      Download XLSX
                    </Button>
                    {(selectedRun.status === 'completed' || selectedRun.status === 'failed') ? (
                      <Button type="button" variant="secondary" size="sm" icon={<RefreshCcw className="h-3.5 w-3.5" />} loading={isRerunning} onClick={handleRerun} className="w-full sm:w-auto">
                        Rerun
                      </Button>
                    ) : null}
                  </>
                )}
                <Button type="button" variant="ghost" size="sm" icon={<RefreshCcw className="h-3.5 w-3.5" />} loading={runQuery.isRefetching} onClick={() => runQuery.refetch()} className="w-full sm:w-auto">
                  Refresh
                </Button>
                {selectedRun.status === 'failed' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={async () => {
                      const response = await fetch(`/api/runs/${selectedRun.id}/retry`, { method: 'POST' });
                      if (!response.ok) {
                        addToast('Unable to retry the run.', 'error');
                        return;
                      }
                      addToast('Run queued for retry.', 'success');
                      await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
                      await runQuery.refetch();
                    }}
                  >
                    Retry same run
                  </Button>
                ) : null}
              </div>
              <Tabs
                activeTab={activeTab}
                onChange={(value) => {
                  setActiveTab(value as typeof activeTab);
                  // Set seed keyword for questions tab from the selected run's brand
                  if (value === 'questions' && selectedRun && !questionSeedKeyword) {
                    setQuestionSeedKeyword(selectedRun.brandName || '');
                  }
                }}
                tabs={[
                  { id: 'preview', label: 'Preview', hasContent: filteredPreviewRows.length > 0 },
                  { id: 'logs', label: 'Logs', hasContent: Boolean(selectedRun.logs.length) },
                  { id: 'summary', label: 'Summary', hasContent: Boolean(selectedRun.resultSummary) },
                  { id: 'questions', label: 'Questions', hasContent: questionSeedKeyword.length > 0 },
                  { id: 'content-map', label: 'Content Map', hasContent: Boolean(selectedRun?.rows?.length) },
                  { id: 'clusters', label: 'Clusters', hasContent: Boolean(selectedRun?.rows?.length) },
                ]}
              />
              {activeTab === 'preview' ? (
                <>
                  {/* ── Filter Toolbar ── */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px] max-w-[320px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                      <input
                        type="text"
                        value={filterSearchQuery}
                        onChange={(e) => {
                          setFilterSearchQuery(e.target.value);
                          handlePageChange(1);
                        }}
                        onFocus={() => {}}
                        placeholder="Search keywords…"
                        className="field-input pl-8 pr-14 text-sm h-8"
                      />
                      <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded p-1 text-text-muted hover:text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer"
                          onClick={() => {
                            setShowSavedSearches(true);
                            setTriggerSaveDialog(true);
                          }}
                          title="Save this search (Ctrl+Shift+S)"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </button>
                        {filterSearchQuery && (
                          <button
                            type="button"
                            className="rounded p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                            onClick={() => setFilterSearchQuery('')}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Intent filter chips */}
                    <div className="flex items-center gap-1">
                      {(['Informational', 'Commercial', 'Transactional', 'Navigational'] as const).map((intent) => {
                        const active = filterIntents.includes(intent);
                        return (
                          <button
                            key={intent}
                            type="button"
                            onClick={() => {
                              setFilterIntents((prev) =>
                                active
                                  ? prev.filter((i) => i !== intent)
                                  : [...prev, intent],
                              );
                              handlePageChange(1);
                            }}
                            className={cn(
                              'rounded-md border px-2 py-0.5 text-caption font-medium transition-colors',
                              active
                                ? 'border-accent/30 bg-accent/[0.08] text-accent'
                                : 'border-transparent bg-surface-inset text-text-muted hover:text-text-primary',
                            )}
                          >
                            {intent}
                          </button>
                        );
                      })}
                      {filterIntents.length > 0 && (
                        <button
                          type="button"
                          className="rounded px-1.5 py-0.5 text-caption text-text-muted hover:text-red-500"
                          onClick={() => setFilterIntents([])}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Difficulty range */}
                    <div className="flex items-center gap-1">
                      <span className="text-caption text-text-muted hidden lg:inline">KD</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={filterMinDifficulty}
                        onChange={(e) => {
                          setFilterMinDifficulty(Number(e.target.value));
                          handlePageChange(1);
                        }}
                        className="field-input w-14 text-sm h-8 px-1.5 text-center"
                        title="Min difficulty"
                      />
                      <span className="text-caption text-text-muted">–</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={filterMaxDifficulty}
                        onChange={(e) => {
                          setFilterMaxDifficulty(Number(e.target.value));
                          handlePageChange(1);
                        }}
                        className="field-input w-14 text-sm h-8 px-1.5 text-center"
                        title="Max difficulty"
                      />
                    </div>

                    {/* Volume range */}
                    <div className="flex items-center gap-1">
                      <span className="text-caption text-text-muted hidden lg:inline">Vol</span>
                      <input
                        type="number"
                        min={0}
                        max={1_000_000}
                        step={10}
                        value={filterMinVolume}
                        onChange={(e) => {
                          setFilterMinVolume(Number(e.target.value));
                          handlePageChange(1);
                        }}
                        className="field-input w-16 text-sm h-8 px-1.5 text-center"
                        title="Min volume"
                      />
                      <span className="text-caption text-text-muted">–</span>
                      <input
                        type="number"
                        max={1_000_000}
                        step={10}
                        value={filterMaxVolume}
                        onChange={(e) => {
                          setFilterMaxVolume(Number(e.target.value));
                          handlePageChange(1);
                        }}
                        className="field-input w-16 text-sm h-8 px-1.5 text-center"
                        title="Max volume"
                      />
                    </div>

                    {/* FilterPresets (save/load) */}
                    <FilterPresets
                      currentFilters={currentFilterState}
                      onLoadPreset={handleLoadPreset}
                    />

                    {/* Saved Searches trigger */}
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface-raised px-2.5 py-1.5 text-caption font-medium text-text-muted hover:text-text-primary hover:border-accent/30 transition-colors cursor-pointer"
                      onClick={() => setShowSavedSearches(true)}
                      title="Search history & saved searches"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Saved</span>
                    </button>

                    {/* Active filter count badge */}
                    {(filterIntents.length > 0 ||
                      filterMinDifficulty > 0 ||
                      filterMaxDifficulty < 100 ||
                      filterMinVolume > 0 ||
                      filterMaxVolume < 1_000_000 ||
                      filterSearchQuery) && (
                      <button
                        type="button"
                        className="rounded-md border border-border/50 px-2 py-0.5 text-caption text-text-muted hover:text-red-500 hover:border-red-500/30"
                        onClick={() => {
                          setFilterIntents([]);
                          setFilterMinDifficulty(0);
                          setFilterMaxDifficulty(100);
                          setFilterMinVolume(0);
                          setFilterMaxVolume(1_000_000);
                          setFilterSearchQuery('');
                          handlePageChange(1);
                        }}
                      >
                        Reset filters
                      </button>
                    )}

                    {/* Filter result count */}
                    {filteredPreviewRows.length !== previewRows.length && (
                      <span className="text-caption text-text-muted whitespace-nowrap">
                        {filteredPreviewRows.length} of {previewRows.length}
                      </span>
                    )}
                  </div>

                  {/* Desktop: full table */}
                  <div className="hidden md:block">
                    {/* Volume Trends Panel */}
                    {showTrends && (
                      <div className="mb-3 rounded-lg border border-accent/20 bg-surface-raised/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-accent" />
                            <span className="text-body font-semibold text-text-primary">Search Volume Trends</span>
                            <span className="text-caption text-text-muted">Last 12 months · AI-estimated</span>
                          </div>
                          <button
                            type="button"
                            className="rounded p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                            onClick={() => { setShowTrends(false); setTrendData(null); }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <VolumeTrendChart data={trendData ?? []} loading={trendLoading} width={640} height={200} />
                      </div>
                    )}
                    <PreviewTable
                      previewRows={filteredPreviewRows}
                      rowCount={pagination.total}
                      status={selectedRun.status}
                      currentPage={previewPage}
                      totalPages={pagination.totalPages}
                      pageSize={previewPageSize}
                      isLoading={isLoadingKeywords}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                      sort={previewSort}
                      sortOrder={previewSortOrder}
                      onSortChange={(field) => {
                        if (field === previewSort) {
                          setPreviewSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
                        } else {
                          setPreviewSort(field);
                          setPreviewSortOrder('desc');
                        }
                        handlePageChange(1);
                      }}
                      onKeywordClick={(row) => setDetailKeyword(row)}
                      onClassifyIntents={handleClassifyIntents}
                      classifyingIntents={isClassifyingIntents}
                      selectedKeywords={selectedKeywordSet}
                      onSelectionChange={handleKeywordSelection}
                      onCompareSerp={() => setShowSerpCompare(true)}
                      serpFeaturesData={serpFeaturesData}
                      analyzingSerpFeatures={analyzingSerpFeatures}
                      onAnalyzeSerpFeatures={handleAnalyzeSerpFeatures}
                      personalDifficultyMap={personalDifficultyMap}
                      loadingPersonalDifficulty={loadingPersonalDifficulty}
                      hasDomain={hasDomain}
                      onShowTrends={handleToggleTrends}
                      showTrends={showTrends}
                    />
                  </div>
                  {/* Mobile: card/table view */}
                  <div className="md:hidden">
                    <MobileKeywordView
                      keywords={filteredPreviewRows}
                      onSelectKeyword={(row) => setDetailKeyword(row)}
                    />
                  </div>
                </>
              ) : null}
              {activeTab === 'logs' ? (
                <RunLogs entries={selectedRun.logs} status={selectedRun.status} formatRelativeLabel={formatRelativeLabel} />
              ) : null}
              {activeTab === 'summary' ? (
                selectedRun.synthesisSnapshot ? (
                  <ReportSynthesisView synthesis={selectedRun.synthesisSnapshot} />
                ) : (
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <Metric label="Run status" value={selectedRun.status} helper={selectedRun.step || 'No step reported'} />
                    <Metric label="Workbook" value={selectedRun.workbookName || 'Pending'} helper={selectedRun.completedAt ? `Completed ${formatRelativeLabel(selectedRun.completedAt)}` : 'Not finished yet'} />
                    <Metric label="Rows" value={String(selectedRun.rows.length || 0)} helper="Generated research rows" />
                    <Metric label="Mode" value={selectedRun.mode === 'expand' ? 'Expand existing' : 'Fresh research'} helper={`Target ${selectedRun.targetRows} rows`} />
                  </div>
                )
              ) : null}
              {activeTab === 'questions' ? (
                <div className="space-y-4">
                  {!questionSeedKeyword && selectedRun ? (
                    <div className="rounded-xl border border-border/40 bg-surface-raised/50 p-4">
                      <p className="text-body text-text-secondary mb-3">
                        Enter a keyword to discover related search questions (People Also Ask).
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="field-input flex-1"
                          placeholder={`e.g., "${selectedRun.brandName} marketing"`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setQuestionSeedKeyword((e.target as HTMLInputElement).value.trim());
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          icon={<Search className="h-4 w-4" />}
                          onClick={() => {
                            const input = document.querySelector<HTMLInputElement>('.field-input.flex-1');
                            if (input) setQuestionSeedKeyword(input.value.trim());
                          }}
                        >
                          Search
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <QuestionsTab
                    seedKeyword={questionSeedKeyword}
                    onAddKeyword={(keyword) => {
                      addToast(`"${keyword}" ready — add it in a new research run.`, 'success');
                    }}
                  />
                </div>
              ) : null}
              {activeTab === 'content-map' ? (
                <ContentMap
                  keywords={selectedRun?.rows ?? []}
                  projectId={project.id}
                />
              ) : null}
              {activeTab === 'clusters' ? (
                <KeywordClusters
                  keywords={selectedRun?.rows ?? []}
                  onGenerateContentBrief={(clusterName, clusterKeywords) => {
                    addToast(
                      `Content brief requested for "${clusterName}" with ${clusterKeywords.length} keywords.`,
                      'success',
                    );
                  }}
                />
              ) : null}
            </div>
          )}

          {/* ── Floating Bulk Actions Toolbar ── */}
          {selectedRun && (
            <BulkActionsToolbar
              selectedCount={selectedKeywordSet.size}
              totalCount={filteredPreviewRows.length}
              allSelected={
                selectedKeywordSet.size > 0 &&
                filteredPreviewRows.every((r) => selectedKeywordSet.has(r.primaryKeyword))
              }
              onSelectAll={handleSelectAllVisible}
              onAction={handleBulkAction}
              onDismiss={handleClearSelection}
              processingAction={processingBulkAction}
            />
          )}

          {/* ── SERP Compare ── */}
          {showSerpCompare && selectedRun && (
            <div className="mt-4">
              <SERPCompare
                selectedKeywords={filteredPreviewRows.filter((r) =>
                  selectedKeywordSet.has(r.primaryKeyword),
                )}
                onClose={() => {
                  setShowSerpCompare(false);
                  handleClearSelection();
                }}
              />
            </div>
          )}
        </Card>
      </section>

      {/* ── History ── */}
      <section id="history" className="animate-enter-delayed-2 section-shell space-y-5">
        <div className="section-header">
          <div>
            <p className="eyebrow">Workspace history</p>
            <h2 className="section-subtitle mt-2">Previous research runs</h2>
            <p className="section-copy mt-1.5">Reopen past results, review progress, and download completed workbooks.</p>
          </div>
          <div className="toolbar-chip flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />
            {runsQuery.data?.length || 0} tracked
          </div>
          <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
            onClick={() => setShowListCompare(true)}
          >
            Compare Lists
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<UploadCloud className="h-3.5 w-3.5" />}
            onClick={() => setShowBulkImport(true)}
          >
            Import Keywords
          </Button>
          </div>
        </div>
        {!runsQuery.data?.length ? (
          <EmptyState
            icon={<History className="h-8 w-8 text-text-muted" />}
            title="No research runs yet"
            description="Queue your first run above to get started."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {runsQuery.data.map((run) => (
              <article
                key={run.id}
                className={cn(
                  'list-card cursor-pointer',
                  selectedRunId === run.id
                    ? 'border-accent/30 bg-accent/[0.03] ring-1 ring-accent/12'
                    : 'hover:border-accent/15 hover:-translate-y-px hover:shadow-elevation-2',
                )}
                onClick={() => setSelectedRunId(run.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-heading-3 text-text-primary">{run.projectName}</p>
                    <p className="mt-1 text-caption uppercase tracking-[0.18em] text-text-muted">
                      {run.brandName} · {run.language} · {run.market}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={run.status} />
                    <button
                      type="button"
                      className="rounded p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setDeletingRunId(run.id); }}
                      title="Delete run"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {deletingRunId === run.id && (
                  <div className="mt-2 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm" onClick={(e) => e.stopPropagation()}>
                    <span className="flex-1 text-text-secondary">Delete this run?</span>
                    <button type="button" className="text-text-muted hover:text-text-primary" onClick={() => setDeletingRunId(null)}>Cancel</button>
                    <button type="button" className="font-medium text-red-500 hover:text-red-600" onClick={() => handleDeleteRun(run.id)}>Delete</button>
                  </div>
                )}
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <Metric label="Queued" value={formatDateTimeLabel(run.queuedAt)} helper={formatRelativeLabel(run.queuedAt)} compact />
                  <Metric label="Workbook" value={run.workbookName || 'Pending'} helper={run.errorMessage || run.step || 'No errors'} compact />
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <Button type="button" variant={selectedRunId === run.id ? 'primary' : 'secondary'} size="sm" className="w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); setSelectedRunId(run.id); }}>
                      {selectedRunId === run.id ? 'Selected' : 'Open in workspace'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<RefreshCcw className="h-3.5 w-3.5" />}
                      className="w-full sm:w-auto"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const payload = new FormData();
                        payload.set('projectId', project.id);
                        payload.set('competitorUrls', project.competitorUrls.join('\n'));
                        payload.set('notes', project.notes || '');
                        payload.set('mode', 'fresh');
                        payload.set('targetRows', String(run.targetRows));
                        const response = await fetch('/api/runs', { method: 'POST', body: payload });
                        const result = await response.json().catch(() => null);
                        if (!response.ok) {
                          addToast(result?.error || 'Unable to start rerun.', 'error');
                          return;
                        }
                        addToast('Rerun queued successfully.', 'success');
                        setSelectedRunId(result.runId);
                        await queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
                      }}
                    >
                      Rerun
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="text-caption font-medium text-text-muted transition-colors hover:text-accent cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); router.push(buildProjectRunPath(project.id, run.id)); }}
                  >
                    Full page view
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Keyword Detail Slide-in Panel ── */}
      <KeywordDetailPanel
        keyword={detailKeyword}
        runId={selectedRunId}
        onClose={() => setDetailKeyword(null)}
      />

      {/* ── List Compare Section ── */}
      {showListCompare && (
        <section className="animate-enter space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-2 text-text-primary">Compare &amp; Merge Lists</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<X className="h-4 w-4" />}
              onClick={() => {
                setShowListCompare(false);
                queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
                if (selectedRunId) {
                  queryClient.invalidateQueries({ queryKey: ['run', project.id, selectedRunId] });
                }
              }}
            >
              Close
            </Button>
          </div>
          <ListCompare projectId={project.id} />
        </section>
      )}

      {/* ── Bulk Keyword Import Dialog ── */}
      <BulkKeywordImport
        open={showBulkImport}
        onClose={() => {
          setShowBulkImport(false);
          // Refresh data after import
          queryClient.invalidateQueries({ queryKey: ['runs', project.id] });
          if (selectedRunId) {
            queryClient.invalidateQueries({ queryKey: ['run', project.id, selectedRunId] });
          }
        }}
        projectId={project.id}
        existingKeywords={(() => {
          const kws = new Set<string>();
          if (selectedRun?.rows) {
            for (const row of selectedRun.rows) {
              if (row.primaryKeyword) kws.add(row.primaryKeyword);
              if (row.keywords) row.keywords.forEach((k) => kws.add(k));
            }
          }
          return [...kws];
        })()}
      />

      {/* ── Saved Searches & History Panel ── */}
      <SavedSearches
        open={showSavedSearches}
        onClose={() => {
          setShowSavedSearches(false);
          setTriggerSaveDialog(false);
        }}
        history={savedSearches.history}
        saved={savedSearches.saved}
        onHistoryClick={handleHistoryClick}
        onSavedClick={handleSavedClick}
        onClearHistory={savedSearches.clearHistory}
        onDeleteSaved={savedSearches.deleteSavedSearch}
        onRenameSaved={savedSearches.renameSavedSearch}
        onSaveCurrent={handleSaveCurrent}
        currentQuery={filterSearchQuery}
        currentFilters={{
          minDifficulty: filterMinDifficulty,
          maxDifficulty: filterMaxDifficulty,
          minVolume: filterMinVolume,
          maxVolume: filterMaxVolume,
          intents: filterIntents,
        }}
        mounted={savedSearches.mounted}
        triggerSave={triggerSaveDialog}
        onSaveDialogHandled={() => setTriggerSaveDialog(false)}
      />
    </div>
  );
}

function InfoRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="subtle-surface min-w-0 px-4 py-2.5">
      <p className="eyebrow">{label}</p>
      {multiline ? <p className="mt-1.5 text-body leading-relaxed text-text-secondary break-words">{value}</p> : (
        <a href={value} target="_blank" rel="noreferrer" className="mt-1.5 block truncate text-body text-accent hover:underline break-all" title={value}>
          {value}
        </a>
      )}
    </div>
  );
}

type SortableField = 'volume' | 'cpc' | 'primaryKeyword' | 'pillar' | 'cluster' | 'intent' | 'difficulty';

function SortIndicator({ field, currentSort, order }: { field: SortableField; currentSort: string; order: string }) {
  if (field !== currentSort) {
    return <span className="ml-1 text-text-muted/40 inline-block">↕</span>;
  }
  return <span className="ml-1 text-accent inline-block">{order === 'asc' ? '↑' : '↓'}</span>;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-2 px-3 py-3 border-b border-border/20">
          <div className="h-4 bg-border/30 rounded w-1/6" />
          <div className="h-4 bg-border/20 rounded w-1/6" />
          <div className="h-4 bg-border/20 rounded w-1/6" />
          <div className="h-4 bg-border/20 rounded w-[10%]" />
          <div className="h-4 bg-border/30 rounded w-1/6" />
          <div className="h-4 bg-border/20 rounded w-[8%]" />
          <div className="h-4 bg-border/20 rounded w-[8%]" />
          <div className="h-4 bg-border/20 rounded w-1/6" />
        </div>
      ))}
    </div>
  );
}

function PreviewTable({
  previewRows,
  rowCount,
  status,
  currentPage,
  totalPages,
  pageSize,
  isLoading,
  onPageChange,
  onPageSizeChange,
  sort,
  sortOrder,
  onSortChange,
  onKeywordClick,
  onClassifyIntents,
  classifyingIntents = false,
  selectedKeywords,
  onSelectionChange,
  onCompareSerp,
  serpFeaturesData,
  analyzingSerpFeatures = false,
  onAnalyzeSerpFeatures,
  onShowTrends,
  showTrends = false,
  personalDifficultyMap,
  loadingPersonalDifficulty = false,
  hasDomain = false,
}: {
  previewRows: ResearchRow[];
  rowCount: number;
  status: ResearchRunDetail['status'];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sort: string;
  sortOrder: string;
  onSortChange: (field: SortableField) => void;
  onKeywordClick?: (row: ResearchRow) => void;
  onClassifyIntents?: () => void;
  classifyingIntents?: boolean;
  selectedKeywords: Set<string>;
  onSelectionChange: (keyword: string, selected: boolean) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onCompareSerp?: () => void;
  serpFeaturesData?: Map<string, SerpFeature[]>;
  analyzingSerpFeatures?: boolean;
  onAnalyzeSerpFeatures?: () => void;
  onShowTrends?: () => void;
  showTrends?: boolean;
  personalDifficultyMap?: Map<string, PersonalDifficultyData>;
  loadingPersonalDifficulty?: boolean;
  hasDomain?: boolean;
}) {
  // All page numbers are 1-based from the API
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, rowCount);
  const hasData = previewRows.length > 0;

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-raised/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
        <div className="flex items-center gap-3 text-body font-semibold text-text-primary">
          <TableProperties className="h-4 w-4 text-accent" />
          Output preview
        </div>
        <div className="flex items-center gap-3">
          {onClassifyIntents && (
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-caption font-medium text-accent hover:bg-accent/[0.06] transition-colors flex items-center gap-1.5 border border-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onClassifyIntents}
              disabled={classifyingIntents}
              title="Use AI to classify search intent for all visible keywords"
            >
              {classifyingIntents ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Classifying…
                </>
              ) : (
                'Classify Intents'
              )}
            </button>
          )}
          {onAnalyzeSerpFeatures && (
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-caption font-medium text-accent hover:bg-accent/[0.06] transition-colors flex items-center gap-1.5 border border-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onAnalyzeSerpFeatures}
              disabled={analyzingSerpFeatures}
              title="Detect SERP features (featured snippets, PAA, video, local pack, etc.)"
            >
              {analyzingSerpFeatures ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing SERP…
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  SERP Features
                </>
              )}
            </button>
          )}
          {onShowTrends && (
            <button
              type="button"
              className={cn(
                'rounded-md px-3 py-1.5 text-caption font-medium transition-colors flex items-center gap-1.5 border disabled:opacity-50 disabled:cursor-not-allowed',
                showTrends
                  ? 'bg-accent/[0.08] text-accent border-accent/30'
                  : 'text-accent hover:bg-accent/[0.06] border-accent/20',
              )}
              onClick={onShowTrends}
              title="View search volume trends over the last 12 months"
            >
              {showTrends ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Hide Trends
                </>
              ) : (
                <>
                  <TrendingUp className="h-3.5 w-3.5" />
                  Trends
                </>
              )}
            </button>
          )}
          {onCompareSerp && selectedKeywords.size >= 2 && selectedKeywords.size <= 3 && (
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-caption font-medium text-info hover:bg-info/[0.06] transition-colors flex items-center gap-1.5 border border-info/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onCompareSerp}
              title="Compare SERP results side-by-side for selected keywords"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Compare SERPs ({selectedKeywords.size})
            </button>
          )}
          <DifficultyVariantToggle />
          <span className="text-caption text-text-muted">
            {rowCount > 0 ? `Showing ${startRow}–${endRow} of ${rowCount} rows` : '0 rows'}
          </span>
        </div>
      </div>
      <div className="max-h-[480px] overflow-x-auto overflow-y-auto">
        {isLoading && !hasData ? (
          <LoadingSkeleton />
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <TableProperties className="h-7 w-7 text-text-muted/40 mb-2" />
            <p className="text-body font-medium text-text-primary">
              {status === 'completed' ? 'No preview rows were stored.' : 'Waiting for results'}
            </p>
            <p className="mt-1 text-caption text-text-muted">
              {status === 'completed' ? '' : 'Preview will appear once the run reaches the generation phase.'}
            </p>
          </div>
        ) : (
          <div className={cn('relative', isLoading && 'opacity-60 transition-opacity')}>
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-raised/30">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
              </div>
            )}
            <table className="min-w-[900px] w-full text-left">
              <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
                <tr className="text-text-muted">
                  <th className="px-2 py-2.5 w-10 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border/60 accent-accent cursor-pointer"
                      checked={previewRows.length > 0 && previewRows.every((r) => selectedKeywords.has(r.primaryKeyword))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          previewRows.forEach((r) => onSelectionChange(r.primaryKeyword, true));
                        } else {
                          previewRows.forEach((r) => onSelectionChange(r.primaryKeyword, false));
                        }
                      }}
                      aria-label="Select all visible keywords"
                    />
                  </th>
                  <th className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5">
                    Parent Page
                  </th>
                  <th
                    className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 cursor-pointer hover:text-accent transition-colors select-none"
                    onClick={() => onSortChange('pillar')}
                  >
                    Pillar<SortIndicator field="pillar" currentSort={sort} order={sortOrder} />
                  </th>
                  <th
                    className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 cursor-pointer hover:text-accent transition-colors select-none"
                    onClick={() => onSortChange('cluster')}
                  >
                    Cluster<SortIndicator field="cluster" currentSort={sort} order={sortOrder} />
                  </th>
                  <th
                    className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 cursor-pointer hover:text-accent transition-colors select-none"
                    onClick={() => onSortChange('intent')}
                  >
                    Intent<SortIndicator field="intent" currentSort={sort} order={sortOrder} />
                  </th>
                  <th
                    className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 cursor-pointer hover:text-accent transition-colors select-none"
                    onClick={() => onSortChange('primaryKeyword')}
                  >
                    Primary Keyword<SortIndicator field="primaryKeyword" currentSort={sort} order={sortOrder} />
                  </th>
                  <th
                    className="px-2.5 py-2.5 text-center text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 cursor-pointer hover:text-accent transition-colors select-none"
                    onClick={() => onSortChange('volume')}
                  >
                    Volume<SortIndicator field="volume" currentSort={sort} order={sortOrder} />
                  </th>
                  <th
                    className="px-2.5 py-2.5 text-center text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 cursor-pointer hover:text-accent transition-colors select-none"
                    onClick={() => onSortChange('cpc')}
                  >
                    CPC<SortIndicator field="cpc" currentSort={sort} order={sortOrder} />
                  </th>
                  <th
                    className="px-2.5 py-2.5 text-center text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 cursor-pointer hover:text-accent transition-colors select-none"
                    onClick={() => onSortChange('difficulty')}
                  >
                    Difficulty<SortIndicator field="difficulty" currentSort={sort} order={sortOrder} />
                  </th>
                  {hasDomain && (
                    <th className="px-2.5 py-2.5 text-center text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5">
                      Pers. Diff
                    </th>
                  )}
                  <th className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5">
                    Keywords
                  </th>
                  {serpFeaturesData !== undefined && (
                    <th className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5 w-[130px]">
                      SERP Features
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {previewRows.map((row, index) => {
                  const isSelected = selectedKeywords.has(row.primaryKeyword);
                  return (
                  <tr
                    key={`${row.cluster}-${index}`}
                    className={cn(
                      'align-top transition-colors hover:bg-accent/[0.02] cursor-pointer',
                      index % 2 === 1 && 'bg-surface-inset/30',
                      isSelected && 'bg-accent/[0.06]',
                    )}
                    onClick={() => onKeywordClick?.(row)}
                  >
                    <td className="px-2 py-2.5 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border/60 accent-accent cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onSelectionChange(row.primaryKeyword, e.target.checked);
                        }}
                        aria-label={`Select ${row.primaryKeyword}`}
                      />
                    </td>
                    <td className="max-w-[140px] truncate px-2.5 py-2.5 text-body-sm text-text-secondary sm:px-3.5 md:max-w-[200px]" title={row.existingParentPage}>
                      {row.existingParentPage}
                    </td>
                    <td className="max-w-[120px] truncate px-2.5 py-2.5 font-medium text-body-sm sm:px-3.5 md:max-w-[160px]" title={row.pillar}>
                      {row.pillar}
                    </td>
                    <td className="max-w-[120px] truncate px-2.5 py-2.5 text-body-sm text-text-secondary sm:px-3.5 md:max-w-[160px]" title={row.cluster}>
                      {row.cluster}
                    </td>
                    <td className="px-2.5 py-2.5 sm:px-3.5">
                      <IntentBadge intent={row.intent || ''} />
                    </td>
                    <td className="max-w-[120px] truncate px-2.5 py-2.5 font-medium text-body-sm sm:px-3.5 md:max-w-[160px]" title={row.primaryKeyword}>
                      {row.primaryKeyword}
                    </td>
                    <td className="px-2.5 py-2.5 text-center font-mono text-body-sm text-text-secondary sm:px-3.5" title={row.searchVolume != null ? String(row.searchVolume) : 'N/A'}>
                      {row.searchVolume != null ? row.searchVolume.toLocaleString() : '—'}
                    </td>
                    <td className="px-2.5 py-2.5 text-center font-mono text-body-sm text-text-secondary sm:px-3.5" title={row.cpc != null ? String(row.cpc) : 'N/A'}>
                      {row.cpc != null ? `$${row.cpc.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-2.5 py-2.5 text-center sm:px-3.5">
                      {row.difficulty != null ? (
                        <DifficultyBadge difficulty={row.difficulty} showLabel={false} />
                      ) : (
                        <span className="text-body-sm text-text-muted">—</span>
                      )}
                    </td>
                    {hasDomain && (
                      <td className="px-2.5 py-2.5 text-center sm:px-3.5">
                        <PersonalDifficultyBadge
                          genericDifficulty={row.difficulty ?? null}
                          personalData={personalDifficultyMap?.get(row.primaryKeyword) ?? null}
                          loading={loadingPersonalDifficulty && !personalDifficultyMap?.has(row.primaryKeyword)}
                          unavailable={!hasDomain}
                          compact
                        />
                      </td>
                    )}
                    <td className="max-w-[140px] truncate px-2.5 py-2.5 text-body-sm text-text-secondary sm:px-3.5 md:max-w-[200px]" title={row.keywords.join(', ')}>
                      {row.keywords.join(', ')}
                    </td>
                    {serpFeaturesData !== undefined && (
                      <td className="px-2.5 py-2.5 sm:px-3.5">
                        {analyzingSerpFeatures && !serpFeaturesData.has(row.primaryKeyword) ? (
                          <span className="inline-flex items-center gap-1 text-text-muted">
                            <span className="h-3 w-3 rounded-full border-2 border-text-muted/30 border-t-accent animate-spin" />
                          </span>
                        ) : (() => {
                          const features = serpFeaturesData.get(row.primaryKeyword);
                          return features && features.length > 0 ? (
                            <SerpFeatureIcons features={features} size="sm" />
                          ) : (
                            <span className="text-text-muted/40 text-caption">—</span>
                          );
                        })()}
                      </td>
                    )}
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(hasData || rowCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center gap-2">
            <span className="text-caption text-text-muted hidden sm:inline">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-md border border-border/50 bg-surface-raised px-2 py-1 text-caption text-text-primary focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-caption text-text-muted">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer min-h-tap min-w-[32px] flex items-center justify-center"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer min-h-tap min-w-[32px] flex items-center justify-center"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RunLogs({
  entries,
  status,
  formatRelativeLabel,
}: {
  entries: ResearchRunDetail['logs'];
  status: ResearchRunDetail['status'];
  formatRelativeLabel: (value: string | number | Date | null | undefined, fallback?: string) => string;
}) {
  if (!entries.length) {
    return (
      <Alert variant="info" title="Waiting for logs">
        Logs will stream here as the worker advances through stages.
      </Alert>
    );
  }

  const lastEntry = entries[entries.length - 1];

  return (
    <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={cn('rounded-lg border border-border/40 bg-surface-raised/60 px-4 py-2.5', entry === lastEntry && status === 'processing' ? 'ring-1 ring-info/20' : null)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-body-sm font-medium text-text-primary">
              {status === 'processing' && entry === lastEntry ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-info" /> : <Search className="h-3.5 w-3.5 shrink-0 text-accent" />}
              <span className="truncate">{entry.message}</span>
            </div>
            <span className="shrink-0 text-caption text-text-muted">{formatRelativeLabel(entry.createdAt)}</span>
          </div>
          <p className="mt-1 eyebrow">{entry.stage}</p>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchRunSummary['status'] | ResearchRunDetail['status'] }) {
  const meta = statusBadgeMap[status as ResearchRunSummary['status']] ?? { variant: 'info' as const, label: status };

  return (
    <Badge variant={meta.variant}>
      {meta.label}
    </Badge>
  );
}

type SynthesisSnapshot = Record<string, unknown>;

function ReportSynthesisView({ synthesis }: { synthesis: SynthesisSnapshot }) {
  const executiveSummary = synthesis.executiveSummary as SynthesisSnapshot | undefined;
  const metricsAnalysis = synthesis.metricsAnalysis as SynthesisSnapshot | undefined;
  const mainKeywordsTable = (synthesis.mainKeywordsTable as Array<SynthesisSnapshot> | undefined) ?? [];
  const keyInsights = (synthesis.keyInsights as string[] | undefined) ?? [];
  const contentStrategy = synthesis.contentStrategy as SynthesisSnapshot | undefined;
  const intentDistribution = synthesis.intentDistribution as SynthesisSnapshot | undefined;

  const volumeDist = (metricsAnalysis?.volumeDistribution as SynthesisSnapshot | undefined);
  const highVolumeCount = typeof volumeDist?.high === 'number' ? volumeDist.high : 0;
  const totalVolume = metricsAnalysis?.totalMonthlyVolume as number | undefined;
  const avgCpc = metricsAnalysis?.avgCpc as number | undefined;
  const highestVolKw = metricsAnalysis?.highestVolumeKeyword as string | undefined;
  const highestCpcKw = metricsAnalysis?.highestCpcKeyword as string | undefined;

  return (
    <div className="space-y-4">
      {executiveSummary && (
        <div className="rounded-lg border border-border/50 bg-surface-raised/60 p-5">
          <div className="flex items-center gap-2 mb-2.5">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="text-heading-3 text-text-primary">{String(executiveSummary.title ?? 'Keyword Research Report')}</h3>
          </div>
          <p className="text-body text-text-secondary">{String(executiveSummary.subtitle ?? '')}</p>
          <div className="mt-2.5 flex flex-wrap gap-3 text-caption text-text-muted">
            <span>{String(executiveSummary.brandName ?? '')}</span>
            <span>·</span>
            <span>{String(executiveSummary.language ?? '')} · {String(executiveSummary.market ?? '')}</span>
            <span>·</span>
            <span>{String(executiveSummary.pillarCount ?? 0)} pillars</span>
            <span>·</span>
            <span>{String(executiveSummary.clusterCount ?? 0)} clusters</span>
          </div>
        </div>
      )}

      {metricsAnalysis && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {totalVolume != null ? totalVolume.toLocaleString() : '-'}
            </p>
            <p className="mt-1 text-caption text-text-muted">Total Monthly Volume</p>
            {highestVolKw && <p className="mt-1 text-caption text-text-secondary truncate" title={highestVolKw}>Top: {highestVolKw}</p>}
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {avgCpc != null ? `$${avgCpc.toFixed(2)}` : '-'}
            </p>
            <p className="mt-1 text-caption text-text-muted">Average CPC</p>
            {highestCpcKw && <p className="mt-1 text-caption text-text-secondary truncate" title={highestCpcKw}>Top: {highestCpcKw}</p>}
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {highVolumeCount > 0 ? highVolumeCount : '-'}
            </p>
            <p className="mt-1 text-caption text-text-muted">High-Volume Keywords</p>
            <p className="mt-1 text-caption text-text-secondary">&gt;1K monthly searches</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xl font-bold text-accent tabular-nums">
              {mainKeywordsTable.length}
            </p>
            <p className="mt-1 text-caption text-text-muted">Tracked Keywords</p>
            <p className="mt-1 text-caption text-text-secondary">with real volume &amp; CPC</p>
          </Card>
        </div>
      )}

      {mainKeywordsTable.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-raised/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2 text-body font-semibold text-text-primary">
              <TableProperties className="h-4 w-4 text-accent" />
              Main Keywords — Volume &amp; CPC
            </div>
            <span className="text-caption text-text-muted">{mainKeywordsTable.length} keywords</span>
          </div>
          <div className="max-h-[400px] overflow-x-auto overflow-y-auto">
            <table className="min-w-[600px] w-full text-left">
              <thead className="sticky top-0 z-10 bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
                <tr className="text-text-muted">
                  {['Keyword', 'Volume', 'CPC', 'Intent', 'Pillar', 'Priority'].map((label) => (
                    <th key={label} className="px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {mainKeywordsTable.slice(0, 30).map((row, index) => (
                  <tr key={`${String(row.keyword)}-${index}`} className={cn('align-top transition-colors hover:bg-accent/[0.02]', index % 2 === 1 && 'bg-surface-inset/30')}>
                    <td className="max-w-[180px] truncate px-2.5 py-2.5 font-medium text-text-primary sm:px-3.5 md:max-w-[240px]" title={String(row.keyword ?? '')}>
                      {String(row.keyword ?? '')}
                    </td>
                    <td className="px-2.5 py-2.5 font-mono text-body-sm text-text-secondary tabular-nums sm:px-3.5">
                      {row.searchVolume != null ? Number(row.searchVolume).toLocaleString() : '-'}
                    </td>
                    <td className="px-2.5 py-2.5 font-mono text-body-sm text-text-secondary tabular-nums sm:px-3.5">
                      {row.cpc != null ? `$${Number(row.cpc).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-2.5 py-2.5 sm:px-3.5">
                      <span className={cn(
                        'inline-block rounded-md px-2 py-0.5 text-caption font-medium',
                        String(row.intent) === 'Informational' && 'bg-info/[0.08] text-info',
                        String(row.intent) === 'Commercial' && 'bg-warning/[0.08] text-warning',
                        String(row.intent) === 'Transactional' && 'bg-success/[0.08] text-success',
                        String(row.intent) === 'Navigational' && 'bg-accent/[0.08] text-accent',
                      )}>
                        {String(row.intent ?? '')}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-2.5 py-2.5 text-body-sm text-text-secondary sm:px-3.5">{String(row.pillar ?? '')}</td>
                    <td className="px-2.5 py-2.5 text-body-sm text-text-secondary sm:px-3.5">{String(row.priority ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {keyInsights.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-surface-raised/60 p-5">
          <h3 className="text-heading-3 text-text-primary mb-3">Key Insights</h3>
          <ul className="space-y-2">
            {keyInsights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2 text-body text-text-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {contentStrategy && (
        <div className="rounded-lg border border-border/50 bg-surface-raised/60 p-5">
          <h3 className="text-heading-3 text-text-primary mb-3">Content Strategy</h3>
          <p className="text-body text-text-secondary">{String(contentStrategy.overview ?? '')}</p>
        </div>
      )}

      {intentDistribution && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(intentDistribution).map(([intent, count]) => (
            <div key={intent} className="rounded-lg border border-border/50 bg-surface-raised/60 p-3 text-center">
              <p className="text-heading-3 text-accent tabular-nums">{String(count)}</p>
              <p className="mt-0.5 text-caption text-text-muted">{intent}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
