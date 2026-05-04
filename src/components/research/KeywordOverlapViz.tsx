'use client';

import { useCallback, useState, useTransition } from 'react';
import {
  AlertTriangle,
  ArrowDownAZ,
  Copy,
  Download,
  Info,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Field } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import type { OverlapResponse, OverlapSets, OverlapStats } from '@/app/api/competitors/overlap/route';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VizState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; data: OverlapResponse }
  | { status: 'error'; message: string };

type SegmentId =
  | 'domain1Only'
  | 'domain2Only'
  | 'shared'
  | 'domain3Only'
  | 'all3'
  | 'domain1SharedWith3'
  | 'domain2SharedWith3';

interface SegmentInfo {
  id: SegmentId;
  label: string;
  keywords: string[];
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = {
  domain1: { fill: 'rgba(59, 130, 246, 0.28)', stroke: '#3b82f6', label: 'Blue' },
  domain2: { fill: 'rgba(239, 68, 68, 0.28)', stroke: '#ef4444', label: 'Red' },
  domain3: { fill: 'rgba(34, 197, 94, 0.28)', stroke: '#22c55e', label: 'Green' },
};

// ---------------------------------------------------------------------------
// Sub-component: Keyword list popover
// ---------------------------------------------------------------------------

function KeywordListPopover({
  segment,
  domainLabels,
  onClose,
  onExport,
}: {
  segment: SegmentInfo;
  domainLabels: string[];
  onClose: () => void;
  onExport: (keywords: string[]) => void;
}) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(segment.keywords.join('\n'));
    setCopied(true);
    addToast(`${segment.keywords.length} keywords copied to clipboard.`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute z-50 mt-2 w-80 rounded-xl border border-border bg-surface shadow-xl animate-in fade-in slide-in-from-top-2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: segment.color.replace(/[\d.]+\)$/, '1)') }}
          />
          <span className="text-body-sm font-semibold text-text-primary">
            {segment.label}
          </span>
          <Badge variant="neutral" className="text-[10px]">
            {segment.keywords.length}
          </Badge>
        </div>
        <button
          type="button"
          className="rounded-lg p-1 text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Keywords list */}
      <div className="max-h-64 overflow-auto p-3">
        {segment.keywords.length === 0 ? (
          <p className="text-body-sm text-text-muted py-4 text-center">No keywords in this segment.</p>
        ) : (
          <ul className="space-y-1">
            {segment.keywords.slice(0, 100).map((kw, i) => (
              <li
                key={i}
                className="text-body-sm text-text-secondary px-2 py-1 rounded-md hover:bg-surface-raised truncate"
                title={kw}
              >
                {kw}
              </li>
            ))}
            {segment.keywords.length > 100 && (
              <li className="text-caption text-text-muted px-2 py-1">
                ... and {segment.keywords.length - 100} more
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border/50 px-4 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={copied ? <Copy className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          onClick={handleCopy}
          className="flex-1"
        >
          {copied ? 'Copied!' : 'Copy All'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<Download className="h-3.5 w-3.5" />}
          onClick={() => onExport(segment.keywords)}
          className="flex-1"
        >
          Export
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: 2-domain Venn diagram
// ---------------------------------------------------------------------------

function TwoDomainVenn({
  sets,
  stats,
  domains,
  onSegmentClick,
  activeSegment,
}: {
  sets: OverlapSets;
  stats: OverlapStats;
  domains: string[];
  onSegmentClick: (segment: SegmentInfo) => void;
  activeSegment: SegmentId | null;
}) {
  // SVG geometry for two overlapping circles
  const cx1 = 140;
  const cx2 = 260;
  const cy = 150;
  const r = 120;

  const segments: SegmentInfo[] = [
    {
      id: 'domain1Only',
      label: `Only ${domains[0]}`,
      keywords: sets.domain1Only,
      color: COLORS.domain1.stroke,
    },
    {
      id: 'shared',
      label: `${domains[0]} ∩ ${domains[1]}`,
      keywords: sets.shared,
      color: '#a855f7', // purple for overlap
    },
    {
      id: 'domain2Only',
      label: `Only ${domains[1]}`,
      keywords: sets.domain2Only,
      color: COLORS.domain2.stroke,
    },
  ];

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 400 300"
        className="w-full max-w-[400px] h-auto"
        style={{ maxHeight: '320px' }}
      >
        <defs>
          <clipPath id="clip-left">
            <circle cx={cx1} cy={cy} r={r} />
          </clipPath>
          <clipPath id="clip-right">
            <circle cx={cx2} cy={cy} r={r} />
          </clipPath>
        </defs>

        {/* Left circle (domain 1) */}
        <circle
          cx={cx1}
          cy={cy}
          r={r}
          fill={COLORS.domain1.fill}
          stroke={COLORS.domain1.stroke}
          strokeWidth="2"
        />

        {/* Right circle (domain 2) */}
        <circle
          cx={cx2}
          cy={cy}
          r={r}
          fill={COLORS.domain2.fill}
          stroke={COLORS.domain2.stroke}
          strokeWidth="2"
        />

        {/* Overlap region (clipped left by right circle) */}
        <circle
          cx={cx1}
          cy={cy}
          r={r}
          fill="rgba(168, 85, 247, 0.3)"
          clipPath="url(#clip-right)"
          stroke="none"
        />

        {/* Clickable regions */}
        {/* Domain 1 only (left circle minus right) */}
        <g
          className="cursor-pointer"
          onClick={() => onSegmentClick(segments[0])}
          clipPath="url(#clip-left)"
        >
          <rect x={0} y={0} width={cx2} height={300} fill="transparent" />
          <text
            x={cx1 - 25}
            y={cy}
            textAnchor="middle"
            className={cn(
              'text-lg font-bold select-none',
              activeSegment === 'domain1Only' ? 'fill-blue-600' : 'fill-blue-700/70',
            )}
          >
            {stats.domain1OnlyCount}
          </text>
        </g>

        {/* Domain 2 only (right circle minus left) */}
        <g
          className="cursor-pointer"
          onClick={() => onSegmentClick(segments[2])}
        >
          <rect
            x={cx2 - 1}
            y={0}
            width={400 - cx2 + 1}
            height={300}
            fill="transparent"
            clipPath="url(#clip-right)"
          />
          <text
            x={cx2 + 25}
            y={cy}
            textAnchor="middle"
            className={cn(
              'text-lg font-bold select-none',
              activeSegment === 'domain2Only' ? 'fill-red-600' : 'fill-red-700/70',
            )}
          >
            {stats.domain2OnlyCount}
          </text>
        </g>

        {/* Shared region */}
        <g
          className="cursor-pointer"
          onClick={() => onSegmentClick(segments[1])}
        >
          <rect
            x={cx1}
            y={cy - r}
            width={cx2 - cx1}
            height={r * 2}
            fill="transparent"
            clipPath="url(#clip-right)"
          />
          <text
            x={(cx1 + cx2) / 2}
            y={cy}
            textAnchor="middle"
            className={cn(
              'text-lg font-bold select-none',
              activeSegment === 'shared' ? 'fill-purple-600' : 'fill-purple-700/70',
            )}
          >
            {stats.sharedCount}
          </text>
        </g>

        {/* Labels under circles */}
        <text
          x={cx1}
          y={cy + r + 24}
          textAnchor="middle"
          className="fill-text-muted text-xs select-none"
        >
          <tspan x={cx1} dy="0">{domains[0]}</tspan>
          <tspan x={cx1} dy="16">{stats.totalDomain1} total</tspan>
        </text>
        <text
          x={cx2}
          y={cy + r + 24}
          textAnchor="middle"
          className="fill-text-muted text-xs select-none"
        >
          <tspan x={cx2} dy="0">{domains[1]}</tspan>
          <tspan x={cx2} dy="16">{stats.totalDomain2} total</tspan>
        </text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: 3-domain Venn diagram
// ---------------------------------------------------------------------------

function ThreeDomainVenn({
  sets,
  stats,
  domains,
  onSegmentClick,
  activeSegment,
}: {
  sets: OverlapSets;
  stats: OverlapStats;
  domains: string[];
  onSegmentClick: (segment: SegmentInfo) => void;
  activeSegment: SegmentId | null;
}) {
  // Three overlapping circles in a triangular arrangement
  const cx1 = 150;
  const cy1 = 120;
  const cx2 = 260;
  const cy2 = 120;
  const cx3 = 205;
  const cy3 = 240;
  const r = 105;

  const segments: SegmentInfo[] = [
    {
      id: 'domain1Only',
      label: `Only ${domains[0]}`,
      keywords: sets.domain1Only,
      color: COLORS.domain1.stroke,
    },
    {
      id: 'domain2Only',
      label: `Only ${domains[1]}`,
      keywords: sets.domain2Only,
      color: COLORS.domain2.stroke,
    },
    {
      id: 'domain3Only',
      label: `Only ${domains[2]}`,
      keywords: sets.domain3Only || [],
      color: COLORS.domain3.stroke,
    },
    {
      id: 'shared',
      label: `${domains[0]} ∩ ${domains[1]}`,
      keywords: sets.shared,
      color: '#a855f7',
    },
    {
      id: 'domain1SharedWith3',
      label: `${domains[0]} ∩ ${domains[2]}`,
      keywords: sets.domain1SharedWith3 || [],
      color: '#06b6d4',
    },
    {
      id: 'domain2SharedWith3',
      label: `${domains[1]} ∩ ${domains[2]}`,
      keywords: sets.domain2SharedWith3 || [],
      color: '#f59e0b',
    },
    {
      id: 'all3',
      label: `All 3 domains`,
      keywords: sets.all3 || [],
      color: '#ec4899',
    },
  ];

  // Label position for each region
  const regionLabels: { id: SegmentId; x: number; y: number }[] = [
    { id: 'domain1Only', x: cx1 - 50, y: cy1 - 15 },
    { id: 'domain2Only', x: cx2 + 50, y: cy2 - 15 },
    { id: 'domain3Only', x: cx3, y: cy3 + 60 },
    { id: 'shared', x: (cx1 + cx2) / 2, y: cy1 - 5 },
    { id: 'domain1SharedWith3', x: cx1 + 25, y: (cy1 + cy3) / 2 },
    { id: 'domain2SharedWith3', x: cx2 - 25, y: (cy2 + cy3) / 2 },
    { id: 'all3', x: (cx1 + cx2 + cx3) / 3, y: (cy1 + cy2 + cy3) / 3 },
  ];

  const getCountForId = (id: SegmentId): number => {
    switch (id) {
      case 'domain1Only': return stats.domain1OnlyCount;
      case 'domain2Only': return stats.domain2OnlyCount;
      case 'domain3Only': return stats.domain3OnlyCount ?? 0;
      case 'shared': return stats.sharedCount;
      case 'domain1SharedWith3': return (sets.domain1SharedWith3 || []).length;
      case 'domain2SharedWith3': return (sets.domain2SharedWith3 || []).length;
      case 'all3': return stats.sharedAll3Count ?? 0;
      default: return 0;
    }
  };

  const getColor = (id: SegmentId): string => {
    switch (id) {
      case 'domain1Only': return COLORS.domain1.stroke;
      case 'domain2Only': return COLORS.domain2.stroke;
      case 'domain3Only': return COLORS.domain3.stroke;
      case 'shared': return '#a855f7';
      case 'domain1SharedWith3': return '#06b6d4';
      case 'domain2SharedWith3': return '#f59e0b';
      case 'all3': return '#ec4899';
      default: return '#888';
    }
  };

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 420 370"
        className="w-full max-w-[420px] h-auto"
        style={{ maxHeight: '400px' }}
      >
        <defs>
          <clipPath id="c3-clip-c1">
            <circle cx={cx1} cy={cy1} r={r} />
          </clipPath>
          <clipPath id="c3-clip-c2">
            <circle cx={cx2} cy={cy2} r={r} />
          </clipPath>
          <clipPath id="c3-clip-c3">
            <circle cx={cx3} cy={cy3} r={r} />
          </clipPath>
        </defs>

        {/* Circles */}
        <circle cx={cx1} cy={cy1} r={r} fill={COLORS.domain1.fill} stroke={COLORS.domain1.stroke} strokeWidth="2" />
        <circle cx={cx2} cy={cy2} r={r} fill={COLORS.domain2.fill} stroke={COLORS.domain2.stroke} strokeWidth="2" />
        <circle cx={cx3} cy={cy3} r={r} fill={COLORS.domain3.fill} stroke={COLORS.domain3.stroke} strokeWidth="2" />

        {/* Overlap: c1 ∩ c2 (purple) clipped by c1 & c2 */}
        <circle cx={cx1} cy={cy1} r={r} fill="rgba(168, 85, 247, 0.35)" clipPath="url(#c3-clip-c2)" />
        {/* Overlap: c1 ∩ c3 (cyan) clipped by c3 */}
        <circle cx={cx1} cy={cy1} r={r} fill="rgba(6, 182, 212, 0.25)" clipPath="url(#c3-clip-c3)" />
        {/* Overlap: c2 ∩ c3 (amber) clipped by c3 */}
        <circle cx={cx2} cy={cy2} r={r} fill="rgba(245, 158, 11, 0.25)" clipPath="url(#c3-clip-c3)" />
        {/* Overlap: all 3 clipped by c3 */}
        <g clipPath="url(#c3-clip-c3)">
          <circle cx={cx1} cy={cy1} r={r} fill="rgba(236, 72, 153, 0.3)" clipPath="url(#c3-clip-c2)" />
        </g>

        {/* Region labels (clickable) */}
        {regionLabels.map((rl) => {
          const seg = segments.find((s) => s.id === rl.id)!;
          const count = getCountForId(rl.id);
          if (count === 0) return null;
          return (
            <g
              key={rl.id}
              className="cursor-pointer"
              onClick={() => onSegmentClick(seg)}
            >
              <text
                x={rl.x}
                y={rl.y}
                textAnchor="middle"
                className={cn(
                  'text-sm font-bold select-none',
                  activeSegment === rl.id ? 'opacity-100' : 'opacity-70',
                )}
                fill={getColor(rl.id)}
              >
                {count}
              </text>
            </g>
          );
        })}

        {/* Domain labels */}
        <text x={cx1} y={cy1 - r - 10} textAnchor="middle" className="fill-text-muted text-[11px] select-none">
          <tspan x={cx1} dy="0">{domains[0]}</tspan>
          <tspan x={cx1} dy="13">{stats.totalDomain1} kw</tspan>
        </text>
        <text x={cx2} y={cy2 - r - 10} textAnchor="middle" className="fill-text-muted text-[11px] select-none">
          <tspan x={cx2} dy="0">{domains[1]}</tspan>
          <tspan x={cx2} dy="13">{stats.totalDomain2} kw</tspan>
        </text>
        <text x={cx3} y={cy3 + r + 26} textAnchor="middle" className="fill-text-muted text-[11px] select-none">
          <tspan x={cx3} dy="0">{domains[2]}</tspan>
          <tspan x={cx3} dy="13">{stats.totalDomain3 ?? 0} kw</tspan>
        </text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Stats summary
// ---------------------------------------------------------------------------

function OverlapStatsSummary({
  stats,
  domains,
}: {
  stats: OverlapStats;
  domains: string[];
}) {
  const items = [
    {
      label: `Unique to ${domains[0]}`,
      value: stats.domain1OnlyCount,
      color: COLORS.domain1.stroke,
    },
    {
      label: `Unique to ${domains[1]}`,
      value: stats.domain2OnlyCount,
      color: COLORS.domain2.stroke,
    },
    { label: 'Shared', value: stats.sharedCount, color: '#a855f7' },
  ];

  if (domains.length >= 3) {
    items.push({
      label: `Unique to ${domains[2]}`,
      value: stats.domain3OnlyCount ?? 0,
      color: COLORS.domain3.stroke,
    });
    items.push({
      label: 'Shared by all 3',
      value: stats.sharedAll3Count ?? 0,
      color: '#ec4899',
    });
  }

  items.push({
    label: 'Total unique keywords',
    value: stats.totalUnique,
    color: '#6b7280',
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <Card key={item.label} className="!p-3">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-caption text-text-muted truncate">{item.label}</span>
          </div>
          <p className="text-heading-3 mt-1">{item.value.toLocaleString()}</p>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function KeywordOverlapViz({ projectId }: { projectId: string }) {
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [domains, setDomains] = useState<string[]>(['', '']);
  const [vizState, setVizState] = useState<VizState>({ status: 'idle' });
  const [activeSegment, setActiveSegment] = useState<SegmentId | null>(null);
  const [activeSegmentInfo, setActiveSegmentInfo] = useState<SegmentInfo | null>(null);

  const handleAddDomain = () => {
    if (domains.length >= 3) {
      addToast('Maximum 3 domains allowed for comparison.', 'error');
      return;
    }
    setDomains([...domains, '']);
  };

  const handleRemoveDomain = (index: number) => {
    if (domains.length <= 2) return;
    setDomains(domains.filter((_, i) => i !== index));
  };

  const handleDomainChange = (index: number, value: string) => {
    const updated = [...domains];
    updated[index] = value;
    setDomains(updated);
  };

  const handleCompare = useCallback(() => {
    const filledDomains = domains.filter((d) => d.trim().length > 0);
    if (filledDomains.length < 2) {
      addToast('Please enter at least 2 domains to compare.', 'error');
      return;
    }

    setActiveSegment(null);
    setActiveSegmentInfo(null);
    setVizState({ status: 'loading' });

    startTransition(async () => {
      try {
        const response = await fetch('/api/competitors/overlap', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId,
            domains: filledDomains.map((d) => d.trim()),
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setVizState({ status: 'error', message: data.error || 'Comparison failed.' });
          return;
        }

        setVizState({ status: 'result', data });
      } catch (err) {
        setVizState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Network error. Please try again.',
        });
      }
    });
  }, [domains, projectId, addToast]);

  const handleSegmentClick = useCallback((segment: SegmentInfo) => {
    setActiveSegment(segment.id);
    setActiveSegmentInfo(segment);
  }, []);

  const handleExport = useCallback((keywords: string[]) => {
    if (keywords.length === 0) {
      addToast('No keywords to export.', 'error');
      return;
    }
    const blob = new Blob([keywords.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keyword-overlap-${activeSegment || 'segment'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`Exported ${keywords.length} keywords.`, 'success');
  }, [activeSegment, addToast]);

  const resetViz = () => {
    setVizState({ status: 'idle' });
    setActiveSegment(null);
    setActiveSegmentInfo(null);
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
            <p className="eyebrow">Keyword Overlap</p>
            <h2 className="section-subtitle mt-2">
              Compare keyword sets between domains
            </h2>
            <p className="section-copy mt-1.5">
              See which keywords are unique to each domain and which are shared.
              Uses existing research data from completed runs.
            </p>
          </div>
          {vizState.status === 'result' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<ArrowDownAZ className="h-3.5 w-3.5" />}
              onClick={resetViz}
            >
              New Comparison
            </Button>
          )}
        </div>

        {/* Inputs */}
        {(vizState.status === 'idle' || vizState.status === 'error') && (
          <div className="space-y-4">
            <Field
              label="Domains to compare"
              hint={`${domains.filter((d) => d.trim()).length}/3 domains. Enter 2-3 domain names (e.g. example.com).`}
            >
              <div className="space-y-2.5">
                {domains.map((domain, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="field-input"
                      placeholder={`domain-${index + 1}.com`}
                      value={domain}
                      onChange={(e) => handleDomainChange(index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCompare();
                      }}
                    />
                    {domains.length > 2 && (
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
                    Add domain ({domains.length}/3)
                  </button>
                )}
              </div>
            </Field>

            {vizState.status === 'error' && (
              <Alert variant="error" title="Comparison failed">
                {vizState.message}
              </Alert>
            )}

            <div className="action-row pt-2 border-t border-border/40">
              <Button
                type="button"
                size="md"
                icon={<Search className="h-4 w-4" />}
                loading={isPending}
                onClick={handleCompare}
                className="w-full sm:w-auto"
              >
                Compare Overlap
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                className="w-full sm:w-auto"
                onClick={() => {
                  setDomains(['', '']);
                  setVizState({ status: 'idle' });
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {vizState.status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-accent/20" />
              <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-accent" />
            </div>
            <p className="text-body font-semibold text-text-primary">
              Calculating keyword overlap...
            </p>
            <p className="text-body-sm text-text-secondary text-center max-w-md">
              Fetching keyword data from completed runs and computing set intersections.
            </p>
          </div>
        )}
      </Card>

      {/* ── Results Section ── */}
      {vizState.status === 'result' && (
        <>
          {/* Stats summary */}
          <OverlapStatsSummary stats={vizState.data.stats} domains={vizState.data.domains} />

          {/* Venn diagram */}
          <Card className="relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-body font-semibold text-text-primary">Keyword Overlap Visualization</h3>
              <div className="flex items-center gap-3">
                {vizState.data.domains.map((d, i) => {
                  const colors = [COLORS.domain1, COLORS.domain2, COLORS.domain3];
                  return (
                    <div key={d} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: colors[i].stroke }}
                      />
                      <span className="text-caption text-text-muted">{d}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center">
              {vizState.data.domains.length === 3 ? (
                <ThreeDomainVenn
                  sets={vizState.data.sets}
                  stats={vizState.data.stats}
                  domains={vizState.data.domains}
                  onSegmentClick={handleSegmentClick}
                  activeSegment={activeSegment}
                />
              ) : (
                <TwoDomainVenn
                  sets={vizState.data.sets}
                  stats={vizState.data.stats}
                  domains={vizState.data.domains}
                  onSegmentClick={handleSegmentClick}
                  activeSegment={activeSegment}
                />
              )}
            </div>

            {/* Active segment popover */}
            {activeSegmentInfo && (
              <div className="flex justify-center">
                <KeywordListPopover
                  segment={activeSegmentInfo}
                  domainLabels={vizState.data.domains}
                  onClose={() => {
                    setActiveSegment(null);
                    setActiveSegmentInfo(null);
                  }}
                  onExport={handleExport}
                />
              </div>
            )}

            {/* Click hint */}
            {!activeSegmentInfo && (
              <p className="text-center text-caption text-text-muted mt-4">
                Click a numbered region to see the keyword list
              </p>
            )}
          </Card>

          {/* Tip */}
          <div className="rounded-lg border border-accent/10 bg-accent/[0.02] p-4 flex items-start gap-3">
            <Info className="h-4 w-4 shrink-0 text-accent mt-0.5" />
            <div>
              <p className="text-body-sm font-semibold text-text-primary">
                Understanding keyword overlap
              </p>
              <p className="mt-1 text-body-sm text-text-secondary">
                <strong>Unique keywords</strong> are keywords only one domain has — these are either your competitive advantage or gaps.<br />
                <strong>Shared keywords</strong> represent topics where domains compete directly.<br />
                Click any segment to export its keyword list for further analysis.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {vizState.status === 'idle' && !isPending && (
        <EmptyState
          icon={<Search className="h-12 w-12 text-text-muted/40" />}
          title="Compare keyword overlap"
          description="Enter 2-3 domains above and click Compare Overlap to see which keywords they share and which are unique to each."
        />
      )}
    </div>
  );
}
