'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns3,
  Download,
  ListPlus,
  Loader2,
  Search,
  TableProperties,
} from 'lucide-react';
import type {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ResearchRow } from '@/lib/research';
import { cn } from '@/lib/utils';
import { exportKeywordsToCsv } from '@/lib/export-csv';
import { Button, Card } from '@/components/ui';
import IntentBadge from './IntentBadge';
import { TrafficPotentialCell, type TrafficPotentialData } from './TrafficPotential';
import PersonalDifficultyBadge, { type PersonalDifficultyData } from './PersonalDifficultyBadge';
import BulkActionsToolbar, { type BulkAction } from './BulkActionsToolbar';
import { SerpFeatureIcons, SerpFeatureTooltip } from './SERPFeaturesPanel';
import type { SerpFeature } from '@/lib/serp-features';

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

const STORAGE_KEY = 'kw-research:table-columns';

type ColumnState = {
  id: string;
  visible: boolean;
  order: number;
  width?: number;
};

const DEFAULT_COLUMNS: ColumnState[] = [
  { id: 'select', visible: true, order: 0 },
  { id: 'primaryKeyword', visible: true, order: 1, width: 200 },
  { id: 'searchVolume', visible: true, order: 2, width: 110 },
  { id: 'difficulty', visible: true, order: 3, width: 100 },
  { id: 'cpc', visible: true, order: 4, width: 100 },
  { id: 'intent', visible: true, order: 5, width: 130 },
  { id: 'trafficPotential', visible: false, order: 5.5, width: 100 },
  { id: 'serpFeatures', visible: true, order: 5.6, width: 130 },
  { id: 'personalDifficulty', visible: false, order: 5.7, width: 130 },
  { id: 'pillar', visible: true, order: 6, width: 150 },
  { id: 'cluster', visible: true, order: 7, width: 150 },
  { id: 'keywords', visible: true, order: 8, width: 200 },
  { id: 'existingParentPage', visible: true, order: 9, width: 180 },
  { id: 'actions', visible: true, order: 10 },
];

function loadColumnState(): ColumnState[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_COLUMNS;
    // Merge with defaults so new columns appear
    const merged = DEFAULT_COLUMNS.map((def) => {
      const stored = parsed.find((c: ColumnState) => c.id === def.id);
      return stored ? { ...def, ...stored } : def;
    });
    return [...merged].sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function saveColumnState(columns: ColumnState[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

function formatVolume(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function formatCpc(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${n.toFixed(2)}`;
}

const INTENT_OPTIONS = ['Informational', 'Commercial', 'Transactional', 'Navigational'] as const;

const intentTooltips: Record<string, string> = {
  Informational: 'Seeking knowledge — "how to", "what is", "guide", "tutorial"',
  Commercial: 'Comparing options — "best", "vs", "review", "top", "alternatives"',
  Transactional: 'Ready to buy — "buy", "price", "discount", "free trial", "sign up"',
  Navigational: 'Looking for a specific site — "login", brand names, product pages',
};

/* ─────────────────────────────────────────────
   Column Filter Popover (text + range)
   ───────────────────────────────────────────── */

function ColumnFilterPopover({
  columnId,
  headerLabel,
  filterType,
  filterValue,
  onFilterChange,
  onClose,
}: {
  columnId: string;
  headerLabel: string;
  filterType: 'text' | 'number-range';
  filterValue: unknown;
  onFilterChange: (columnId: string, value: unknown) => void;
  onClose: () => void;
}) {
  const [localText, setLocalText] = useState(
    typeof filterValue === 'string' ? filterValue : ''
  );
  const [min, setMin] = useState(
    typeof filterValue === 'object' && filterValue !== null
      ? String((filterValue as { min?: number }).min ?? '')
      : ''
  );
  const [max, setMax] = useState(
    typeof filterValue === 'object' && filterValue !== null
      ? String((filterValue as { max?: number }).max ?? '')
      : ''
  );

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 z-20 mt-1 min-w-[180px] rounded-lg border border-border/60 bg-surface shadow-elevation-2 p-3"
    >
      <p className="text-caption font-semibold text-text-secondary mb-2">
        Filter {headerLabel}
      </p>
      {filterType === 'text' ? (
        <input
          autoFocus
          type="text"
          className="field-input text-[13px]"
          placeholder="Search..."
          value={localText}
          onChange={(e) => {
            setLocalText(e.target.value);
            onFilterChange(columnId, e.target.value);
          }}
        />
      ) : (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="number"
            className="field-input text-[13px] w-20"
            placeholder="Min"
            value={min}
            onChange={(e) => {
              setMin(e.target.value);
              const minVal = e.target.value ? Number(e.target.value) : undefined;
              const maxVal = max ? Number(max) : undefined;
              onFilterChange(columnId, { min: minVal, max: maxVal });
            }}
          />
          <span className="text-text-muted text-[13px]">–</span>
          <input
            type="number"
            className="field-input text-[13px] w-20"
            placeholder="Max"
            value={max}
            onChange={(e) => {
              setMax(e.target.value);
              const minVal = min ? Number(min) : undefined;
              const maxVal = e.target.value ? Number(e.target.value) : undefined;
              onFilterChange(columnId, { min: minVal, max: maxVal });
            }}
          />
        </div>
      )}
      <button
        type="button"
        className="mt-2 text-[11px] text-text-muted hover:text-accent transition-colors"
        onClick={() => {
          onFilterChange(columnId, undefined);
          onClose();
        }}
      >
        Clear filter
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Columns Menu Dropdown
   ───────────────────────────────────────────── */

function ColumnsMenu({
  columns,
  onToggle,
  onClose,
}: {
  columns: ColumnState[];
  onToggle: (columnId: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-border/60 bg-surface shadow-elevation-2 p-2"
    >
      <p className="px-2 py-1 text-caption font-semibold text-text-secondary">
        Show / Hide Columns
      </p>
      <div className="mt-1 max-h-[280px] overflow-y-auto">
        {columns
          .filter((c) => c.id !== 'select' && c.id !== 'actions')
          .map((col) => (
            <label
              key={col.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-inset text-body-sm text-text-primary select-none"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border/60 accent-accent"
                checked={col.visible}
                onChange={() => onToggle(col.id)}
              />
              <span>{colHeaderLabel(col.id)}</span>
            </label>
          ))}
      </div>
    </div>
  );
}

function colHeaderLabel(id: string): string {
  const map: Record<string, string> = {
    select: '',
    primaryKeyword: 'Keyword',
    searchVolume: 'Volume',
    difficulty: 'Difficulty',
    cpc: 'CPC',
    intent: 'Intent',
    trafficPotential: 'Traffic Pot.',
    serpFeatures: 'SERP Features',
    pillar: 'Pillar',
    cluster: 'Cluster',
    keywords: 'Keywords',
    existingParentPage: 'Parent Page',
    actions: 'Actions',
  };
  return map[id] ?? id;
}

/* ─────────────────────────────────────────────
   Sort indicator (tri-state: asc / desc / none)
   ───────────────────────────────────────────── */

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (!sorted) {
    return (
      <span className="ml-1 inline-flex text-text-muted/30">
        <ChevronUp className="h-3 w-3 -mb-1" />
        <ChevronDown className="h-3 w-3" />
      </span>
    );
  }
  return sorted === 'asc' ? (
    <ChevronUp className="ml-1 h-3.5 w-3.5 inline-flex text-accent" />
  ) : (
    <ChevronDown className="ml-1 h-3.5 w-3.5 inline-flex text-accent" />
  );
}



/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */

interface KeywordTableProps {
  rows: ResearchRow[];
  /** Total row count (for pagination display) */
  rowCount: number;
  /** Called when user clicks "Add to List" on a row or via bulk action */
  onAddToList?: (rows: ResearchRow[]) => void;
  /** Called when user clicks "Analyze SERP" on a row */
  onAnalyzeSerp?: (row: ResearchRow) => void;
  /** Called when user clicks "Export" on a row or via bulk action */
  onExport?: (rows: ResearchRow[]) => void;
  /** Whether table data is loading (shows overlay) */
  loading?: boolean;
  /** Pagination info */
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  /** External class name */
  className?: string;
  /** Whether to show row-level actions column */
  showRowActions?: boolean;
  /** Called to classify intents for visible keywords */
  onClassifyIntents?: () => void;
  /** Whether intent classification is in progress */
  classifyingIntents?: boolean;
  /** Traffic potential data map (keyword → TP data) */
  trafficPotentialData?: Map<string, TrafficPotentialData>;
  /** Whether TP is being calculated */
  calculatingTP?: boolean;
  /** SERP features data map (keyword → features) */
  serpFeaturesData?: Map<string, SerpFeature[]>;
  /** Whether SERP features are being analyzed */
  analyzingSerpFeatures?: boolean;
  /** Personal difficulty data map (keyword → PersonalDifficultyData) */
  personalDifficultyMap?: Map<string, PersonalDifficultyData>;
  /** Whether personal difficulty is loading (shows skeleton in Pers. Diff column) */
  loadingPersonalDifficulty?: boolean;
  /** Whether a user domain is set (shows "—" if not) */
  hasDomain?: boolean;
}

export default function KeywordTable({
  rows,
  rowCount,
  onAddToList,
  onAnalyzeSerp,
  onExport,
  loading = false,
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  className,
  showRowActions = true,
  onClassifyIntents,
  classifyingIntents = false,
  trafficPotentialData,
  calculatingTP = false,
  serpFeaturesData,
  analyzingSerpFeatures = false,
  personalDifficultyMap,
  loadingPersonalDifficulty = false,
  hasDomain = false,
}: KeywordTableProps) {
  /* ── Column visibility & localStorage persistence ── */
  const [columnState, setColumnState] = useState<ColumnState[]>(loadColumnState);

  useEffect(() => {
    saveColumnState(columnState);
  }, [columnState]);

  const toggleColumn = useCallback((columnId: string) => {
    setColumnState((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, visible: !c.visible } : c))
    );
  }, []);

  const updateColumnWidth = useCallback(
    (columnId: string, width: number) => {
      setColumnState((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, width } : c))
      );
    },
    []
  );

  /* ── Table state ── */
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);

  /* ── Column definitions ── */
  const columns = useMemo<ColumnDef<ResearchRow>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border/60 accent-accent cursor-pointer"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border/60 accent-accent cursor-pointer"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
        size: 40,
      },
      {
        id: 'primaryKeyword',
        accessorKey: 'primaryKeyword',
        header: ({ column }) => (
          <FilterableHeader
            label="Keyword"
            column={column}
            filterType="text"
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting()}
          />
        ),
        cell: ({ getValue }) => (
          <span
            className="block max-w-[300px] truncate font-medium text-body-sm text-text-primary"
            title={String(getValue() ?? '')}
          >
            {String(getValue() ?? '') || '—'}
          </span>
        ),
        enableColumnFilter: true,
      },
      {
        id: 'searchVolume',
        accessorKey: 'searchVolume',
        header: ({ column }) => (
          <FilterableHeader
            label="Volume"
            column={column}
            filterType="number-range"
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting()}
          />
        ),
        cell: ({ getValue }) => (
          <span className="font-mono tabular-nums text-body-sm text-text-secondary">
            {formatVolume(getValue<number | null>())}
          </span>
        ),
        sortingFn: 'alphanumeric',
        filterFn: (row, _columnId, filterValue: { min?: number; max?: number } | undefined) => {
          if (!filterValue) return true;
          const val = row.original.searchVolume ?? -1;
          if (val === -1) return false;
          if (filterValue.min !== undefined && val < filterValue.min) return false;
          if (filterValue.max !== undefined && val > filterValue.max) return false;
          return true;
        },
      },
      {
        id: 'difficulty',
        accessorKey: 'difficulty',
        header: ({ column }) => (
          <FilterableHeader
            label="Difficulty"
            column={column}
            filterType="number-range"
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting()}
          />
        ),
        cell: ({ getValue }) => {
          const val = getValue<number | null>();
          if (val == null) return <span className="text-body-sm text-text-muted">—</span>;
          const color =
            val <= 30
              ? 'bg-green-500'
              : val <= 60
                ? 'bg-yellow-500'
                : 'bg-red-500';
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 rounded-full bg-surface-inset overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', color)}
                  style={{ width: `${Math.min(100, val)}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-body-sm text-text-secondary w-7 text-right">
                {val}
              </span>
            </div>
          );
        },
        sortingFn: 'alphanumeric',
        filterFn: (row, _columnId, filterValue: { min?: number; max?: number } | undefined) => {
          if (!filterValue) return true;
          const val = (row.original as ResearchRow & { difficulty?: number }).difficulty ?? -1;
          if (val === -1) return false;
          if (filterValue.min !== undefined && val < filterValue.min) return false;
          if (filterValue.max !== undefined && val > filterValue.max) return false;
          return true;
        },
      },
      {
        id: 'cpc',
        accessorKey: 'cpc',
        header: ({ column }) => (
          <FilterableHeader
            label="CPC"
            column={column}
            filterType="number-range"
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting()}
          />
        ),
        cell: ({ getValue }) => (
          <span className="font-mono tabular-nums text-body-sm text-text-secondary">
            {formatCpc(getValue<number | null>())}
          </span>
        ),
        sortingFn: 'alphanumeric',
        filterFn: (row, _columnId, filterValue: { min?: number; max?: number } | undefined) => {
          if (!filterValue) return true;
          const val = row.original.cpc ?? -1;
          if (val === -1) return false;
          if (filterValue.min !== undefined && val < filterValue.min) return false;
          if (filterValue.max !== undefined && val > filterValue.max) return false;
          return true;
        },
      },
      {
        id: 'intent',
        accessorKey: 'intent',
        header: ({ column }) => (
          <IntentFilterHeader
            column={column}
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting()}
          />
        ),
        cell: ({ getValue }) => {
          const intent = String(getValue() ?? '');
          return (
            <IntentBadge intent={intent} />
          );
        },
        sortingFn: 'alphanumeric',
        filterFn: (row, _columnId, filterValue: string | undefined) => {
          if (!filterValue) return true;
          const intent = row.original.intent;
          return intent === filterValue;
        },
      },
      {
        id: 'trafficPotential',
        accessorKey: 'trafficPotential',
        header: ({ column }) => (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-0.5 cursor-pointer hover:text-accent transition-colors"
              onClick={() => column.toggleSorting()}
            >
              <span>Traffic Pot.</span>
              <SortIcon sorted={column.getIsSorted()} />
            </button>
          </div>
        ),
        cell: ({ row }) => {
          const kw = row.original.primaryKeyword;
          const tpData = trafficPotentialData?.get(kw) ?? null;
          return <TrafficPotentialCell data={tpData} calculating={calculatingTP} />;
        },
        sortingFn: (rowA, rowB) => {
          const a = trafficPotentialData?.get(rowA.original.primaryKeyword)?.trafficPotential ?? -1;
          const b = trafficPotentialData?.get(rowB.original.primaryKeyword)?.trafficPotential ?? -1;
          return a - b;
        },
        enableColumnFilter: false,
      },
      {
        id: 'serpFeatures',
        accessorKey: 'serpFeatures',
        header: () => (
          <div className="inline-flex items-center gap-1">
            <span>SERP Features</span>
          </div>
        ),
        cell: ({ row }) => {
          const kw = row.original.primaryKeyword;
          const features = serpFeaturesData?.get(kw);
          if (analyzingSerpFeatures && features === undefined) {
            return (
              <span className="inline-flex items-center gap-1 text-text-muted">
                <span className="h-3 w-3 rounded-full border-2 border-text-muted/30 border-t-accent animate-spin" />
                <span className="text-[10px]">analyzing…</span>
              </span>
            );
          }
          if (!features || features.length === 0) {
            return <span className="text-text-muted/50 text-caption">—</span>;
          }
          return <SerpFeatureTooltip features={features} />;
        },
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        id: 'personalDifficulty',
        accessorKey: 'personalDifficulty',
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-0.5 cursor-pointer hover:text-accent transition-colors"
            onClick={() => column.toggleSorting()}
          >
            <span>Pers. Diff</span>
            <SortIcon sorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => {
          const kw = row.original.primaryKeyword;
          const pd = personalDifficultyMap?.get(kw);
          return (
            <PersonalDifficultyBadge
              genericDifficulty={row.original.difficulty ?? null}
              personalData={pd ?? null}
              loading={loadingPersonalDifficulty && !pd}
              unavailable={!hasDomain}
              compact
            />
          );
        },
        sortingFn: (rowA, rowB) => {
          const a = personalDifficultyMap?.get(rowA.original.primaryKeyword)?.personalDifficulty ?? -1;
          const b = personalDifficultyMap?.get(rowB.original.primaryKeyword)?.personalDifficulty ?? -1;
          return a - b;
        },
        enableColumnFilter: false,
      },
      {
        id: 'pillar',
        accessorKey: 'pillar',
        header: ({ column }) => (
          <FilterableHeader
            label="Pillar"
            column={column}
            filterType="text"
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting()}
          />
        ),
        cell: ({ getValue }) => (
          <span
            className="block max-w-[200px] truncate text-body-sm text-text-primary"
            title={String(getValue() ?? '')}
          >
            {String(getValue() ?? '') || '—'}
          </span>
        ),
        sortingFn: 'alphanumeric',
        filterFn: 'includesString',
      },
      {
        id: 'cluster',
        accessorKey: 'cluster',
        header: ({ column }) => (
          <FilterableHeader
            label="Cluster"
            column={column}
            filterType="text"
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting()}
          />
        ),
        cell: ({ getValue }) => (
          <span
            className="block max-w-[200px] truncate text-body-sm text-text-secondary"
            title={String(getValue() ?? '')}
          >
            {String(getValue() ?? '') || '—'}
          </span>
        ),
        sortingFn: 'alphanumeric',
        filterFn: 'includesString',
      },
      {
        id: 'keywords',
        accessorKey: 'keywords',
        header: () => <span className="text-caption font-semibold uppercase tracking-wider">Keywords</span>,
        cell: ({ getValue }) => {
          const kws = (getValue() as string[]) ?? [];
          if (kws.length === 0) return <span className="text-text-muted">—</span>;
          return (
            <span
              className="block max-w-[250px] truncate text-body-sm text-text-secondary"
              title={kws.join(', ')}
            >
              {kws.join(', ')}
            </span>
          );
        },
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        id: 'existingParentPage',
        accessorKey: 'existingParentPage',
        header: ({ column }) => (
          <FilterableHeader
            label="Parent Page"
            column={column}
            filterType="text"
            filterOpen={filterOpen}
            setFilterOpen={setFilterOpen}
            sorted={column.getIsSorted()}
            onSort={() => column.toggleSorting()}
          />
        ),
        cell: ({ getValue }) => (
          <span
            className="block max-w-[220px] truncate text-body-sm text-text-secondary"
            title={String(getValue() ?? '')}
          >
            {String(getValue() ?? '') || '—'}
          </span>
        ),
        sortingFn: 'alphanumeric',
        filterFn: 'includesString',
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5">
            {onAddToList && (
              <button
                type="button"
                className="rounded p-1.5 text-text-muted hover:text-accent hover:bg-accent/[0.06] transition-colors"
                title="Add to List"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToList([row.original]);
                }}
              >
                <ListPlus className="h-3.5 w-3.5" />
              </button>
            )}
            {onAnalyzeSerp && (
              <button
                type="button"
                className="rounded p-1.5 text-text-muted hover:text-info hover:bg-info/[0.06] transition-colors"
                title="Analyze SERP"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnalyzeSerp(row.original);
                }}
              >
                <Search className="h-3.5 w-3.5" />
              </button>
            )}
            {onExport && (
              <button
                type="button"
                className="rounded p-1.5 text-text-muted hover:text-accent hover:bg-accent/[0.06] transition-colors"
                title="Export"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport([row.original]);
                }}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 100,
      },
    ],
    [filterOpen, onAddToList, onAnalyzeSerp, onExport, trafficPotentialData, calculatingTP, serpFeaturesData, analyzingSerpFeatures, personalDifficultyMap, loadingPersonalDifficulty, hasDomain]
  );

  /* ── Column visibility map from columnState ── */
  const columnVisibility = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of columnState) {
      map[c.id] = c.visible;
    }
    return map;
  }, [columnState]);

  // Build column order from state
  const columnOrder = useMemo(
    () =>
      [...columnState].sort((a, b) => a.order - b.order).map((c) => c.id),
    [columnState]
  );

  /* ── Table instance ── */
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection as OnChangeFn<RowSelectionState>,
    onColumnVisibilityChange: (updater) => {
      if (typeof updater === 'function') {
        const next = updater(columnVisibility);
        setColumnState((prev) =>
          prev.map((c) => ({ ...c, visible: next[c.id] ?? true }))
        );
      }
    },
    onColumnOrderChange: (updater) => {
      if (typeof updater === 'function') {
        const nextOrder = updater(columnOrder);
        setColumnState((prev) =>
          prev.map((c) => {
            const idx = nextOrder.indexOf(c.id);
            return { ...c, order: idx >= 0 ? idx : c.order };
          })
        );
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
  });

  /* ── Derived state ── */
  const selectedRows = useMemo(
    () => table.getSelectedRowModel().rows.map((r) => r.original),
    [table]
  );
  const selectionCount = Object.keys(rowSelection).length;
  const filteredCount = table.getFilteredRowModel().rows.length;

  /* ── Handlers ── */
  const handleSelectAll = useCallback(() => {
    table.toggleAllRowsSelected(true);
  }, [table]);

  const handleClearSelection = useCallback(() => {
    table.toggleAllRowsSelected(false);
  }, [table]);

  const [processingBulkAction, setProcessingBulkAction] = useState<BulkAction | null>(null);

  const handleBulkAction = useCallback((action: BulkAction) => {
    const toExport = selectionCount === filteredCount ? rows : selectedRows;
    switch (action) {
      case 'add-to-list':
        if (onAddToList && selectedRows.length > 0) {
          onAddToList(selectedRows);
        }
        handleClearSelection();
        break;
      case 'export-csv':
        setProcessingBulkAction('export-csv');
        if (onExport) {
          onExport(toExport);
          setProcessingBulkAction(null);
        } else {
          // Use enhanced CSV export with all columns + UTF-8 BOM
          // Small delay to let the loading spinner show
          const exportRows = selectionCount === filteredCount ? rows : selectedRows;
          setTimeout(() => {
            exportKeywordsToCsv(exportRows);
            setProcessingBulkAction(null);
          }, 150);
        }
        break;
      case 'generate-brief':
        // Content brief generation — parent can handle this via callback or default
        if (onAddToList && selectedRows.length > 0) {
          // For now, pass through to parent; in the future a dedicated brief generator can be integrated
          console.log('Brief requested for', selectedRows.length, 'keywords');
        }
        break;
      case 'cluster-selected':
        // Send to clustering — parent handles this
        console.log('Cluster requested for', selectedRows.length, 'keywords');
        break;
      case 'select-all':
        table.toggleAllRowsSelected(true);
        break;
      case 'clear-selection':
        handleClearSelection();
        break;
    }
  }, [selectionCount, filteredCount, rows, selectedRows, onAddToList, onExport, handleClearSelection, table]);



  /* ── Pagination display ── */
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, rowCount);

  return (
    <div className={cn('space-y-3', className)}>
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-body font-semibold text-text-primary">
          <TableProperties className="h-4 w-4 text-accent" />
          Keyword Results
        </div>
        <div className="flex items-center gap-2">
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
          <span className="text-caption text-text-muted">
            {rowCount > 0
              ? `Showing ${startRow}–${endRow} of ${rowCount} rows`
              : '0 rows'}
          </span>
          <div className="relative">
            <button
              type="button"
              className="rounded-md p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-inset transition-colors"
              onClick={() => setColumnsMenuOpen(!columnsMenuOpen)}
              title="Show/hide columns"
            >
              <Columns3 className="h-4 w-4" />
            </button>
            {columnsMenuOpen && (
              <ColumnsMenu
                columns={columnState}
                onToggle={toggleColumn}
                onClose={() => setColumnsMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Bulk Actions ── */}
      <BulkActionsToolbar
        selectedCount={selectionCount}
        totalCount={filteredCount}
        allSelected={selectionCount === filteredCount && filteredCount > 0}
        onSelectAll={handleSelectAll}
        onAction={handleBulkAction}
        onDismiss={handleClearSelection}
        processingAction={processingBulkAction}
      />

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-raised/60">
        <div className="overflow-x-auto">
          <div className="relative max-h-[70vh] overflow-y-auto">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-raised/50">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
              </div>
            )}
            <table
              className="w-full text-left [&_th]:select-none"
              style={{}}
            >
              <thead className="sticky top-0 z-[5] bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="text-text-muted">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="relative px-2.5 py-2.5 text-caption font-semibold uppercase tracking-wider whitespace-nowrap sm:px-3.5"
                        style={{
                          width: header.getSize() !== 150 ? header.getSize() : undefined,
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {/* Column resize handle */}
                        <div
                          className="absolute top-0 right-0 w-1 h-full cursor-col-resize select-none hover:bg-accent/30 group/resizer"
                          onMouseDown={(e) => {
                            const startX = e.clientX;
                            const startWidth = header.getSize();
                            const columnId = header.column.id;

                            const onMouseMove = (ev: MouseEvent) => {
                              const delta = ev.clientX - startX;
                              const newWidth = Math.max(60, startWidth + delta);
                              updateColumnWidth(columnId, newWidth);
                            };

                            const onMouseUp = () => {
                              document.removeEventListener('mousemove', onMouseMove);
                              document.removeEventListener('mouseup', onMouseUp);
                              document.body.style.cursor = '';
                              document.body.style.userSelect = '';
                            };

                            document.body.style.cursor = 'col-resize';
                            document.body.style.userSelect = 'none';
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                          }}
                        />
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border/30">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-10 text-center"
                    >
                      <TableProperties className="h-7 w-7 text-text-muted/40 mx-auto mb-2" />
                      <p className="text-body font-medium text-text-primary">
                        No rows found
                      </p>
                      <p className="mt-1 text-caption text-text-muted">
                        Try adjusting your filters or search terms.
                      </p>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'align-top transition-colors hover:bg-accent/[0.03]',
                        row.getIsSelected() && 'bg-accent/[0.06]',
                        index % 2 === 1 && 'bg-surface-inset/30'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-2.5 py-2.5 sm:px-3.5"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pagination ── */}
        {(rowCount > 0) && (
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
                {currentPage}/{totalPages || 1}
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
                disabled={currentPage >= (totalPages || 1)}
                className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer min-h-tap min-w-[32px] flex items-center justify-center"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FilterableHeader (rendered inside column def)
   ───────────────────────────────────────────── */

function FilterableHeader({
  label,
  column,
  filterType,
  filterOpen,
  setFilterOpen,
  sorted,
  onSort,
}: {
  label: string;
  column: { id: string; getFilterValue: () => unknown; setFilterValue: (val: unknown) => void };
  filterType: 'text' | 'number-range';
  filterOpen: string | null;
  setFilterOpen: (id: string | null) => void;
  sorted: false | 'asc' | 'desc';
  onSort: () => void;
}) {
  const columnId = column.id;
  const isOpen = filterOpen === columnId;
  const filterValue = column.getFilterValue();
  const hasFilter = filterValue !== undefined && filterValue !== '' && !(typeof filterValue === 'object' && filterValue !== null && (filterValue as { min?: number; max?: number }).min === undefined && (filterValue as { min?: number; max?: number }).max === undefined);

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        className="inline-flex items-center gap-0.5 cursor-pointer hover:text-accent transition-colors"
        onClick={onSort}
      >
        <span>{label}</span>
        <SortIcon sorted={sorted} />
      </button>
      <button
        type="button"
        className={cn(
          'rounded p-0.5 transition-colors',
          hasFilter
            ? 'text-accent bg-accent/[0.08]'
            : 'text-text-muted/40 hover:text-text-muted'
        )}
        onClick={(e) => {
          e.stopPropagation();
          setFilterOpen(isOpen ? null : columnId);
        }}
        title="Filter"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>
      {isOpen && (
        <ColumnFilterPopover
          columnId={columnId}
          headerLabel={label}
          filterType={filterType}
          filterValue={filterValue ?? null}
          onFilterChange={(id, value) => {
            if (value === undefined) {
              column.setFilterValue(undefined);
            } else {
              column.setFilterValue(value);
            }
          }}
          onClose={() => setFilterOpen(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Intent Filter Header (dropdown picker)
   ───────────────────────────────────────────── */

function IntentFilterPopover({
  columnId,
  selectedIntent,
  onSelect,
  onClear,
  onClose,
}: {
  columnId: string;
  selectedIntent: string | null;
  onSelect: (intent: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 z-20 mt-1 min-w-[180px] rounded-lg border border-border/60 bg-surface shadow-elevation-2 p-2"
    >
      <p className="text-caption font-semibold text-text-secondary mb-2 px-1">
        Filter by Intent
      </p>
      <div className="space-y-0.5">
        {INTENT_OPTIONS.map((intent) => (
          <button
            key={intent}
            type="button"
            className={cn(
              'w-full text-left px-2 py-1.5 rounded-md text-body-sm transition-colors',
              selectedIntent === intent
                ? 'bg-accent/[0.08] text-accent font-medium'
                : 'text-text-primary hover:bg-surface-inset',
            )}
            onClick={() => {
              onSelect(intent);
              onClose();
            }}
            title={intentTooltips[intent] ?? ''}
          >
            <div className="flex items-center gap-2">
              <IntentBadge intent={intent} />
            </div>
          </button>
        ))}
      </div>
      {selectedIntent && (
        <button
          type="button"
          className="mt-2 text-[11px] text-text-muted hover:text-accent transition-colors px-1"
          onClick={() => {
            onClear();
            onClose();
          }}
        >
          Clear filter
        </button>
      )}
    </div>
  );
}

function IntentFilterHeader({
  column,
  filterOpen,
  setFilterOpen,
  sorted,
  onSort,
}: {
  column: { id: string; getFilterValue: () => unknown; setFilterValue: (val: unknown) => void };
  filterOpen: string | null;
  setFilterOpen: (id: string | null) => void;
  sorted: false | 'asc' | 'desc';
  onSort: () => void;
}) {
  const columnId = column.id;
  const isOpen = filterOpen === columnId;
  const filterValue = column.getFilterValue() as string | undefined;
  const hasFilter = filterValue !== undefined && filterValue !== '';

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        className="inline-flex items-center gap-0.5 cursor-pointer hover:text-accent transition-colors"
        onClick={onSort}
      >
        <span>Intent</span>
        <SortIcon sorted={sorted} />
      </button>
      <button
        type="button"
        className={cn(
          'rounded p-0.5 transition-colors',
          hasFilter
            ? 'text-accent bg-accent/[0.08]'
            : 'text-text-muted/40 hover:text-text-muted'
        )}
        onClick={(e) => {
          e.stopPropagation();
          setFilterOpen(isOpen ? null : columnId);
        }}
        title="Filter by intent"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      </button>
      {isOpen && (
        <IntentFilterPopover
          columnId={columnId}
          selectedIntent={filterValue || null}
          onSelect={(intent) => column.setFilterValue(intent)}
          onClear={() => column.setFilterValue(undefined)}
          onClose={() => setFilterOpen(null)}
        />
      )}
    </div>
  );
}

