'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import Skeleton from '@/components/ui/Skeleton';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

export type TrendDirection = 'rising' | 'falling' | 'stable' | 'seasonal';

export interface MonthlyDataPoint {
  month: string; // "YYYY-MM"
  volume: number;
}

export interface VolumeTrendData {
  keyword: string;
  monthlyData: MonthlyDataPoint[];
  trend: TrendDirection;
  changePercent: number;
  changePeriod: '3 months' | '6 months' | 'YoY';
  seasonality: string | null;
  color?: string; // Optional override for multi-keyword overlay
}

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */

const MONTH_SHORT_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TREND_ICONS: Record<TrendDirection, React.ReactNode> = {
  rising: <TrendingUp className="h-4 w-4" />,
  falling: <TrendingDown className="h-4 w-4" />,
  stable: <Minus className="h-4 w-4" />,
  seasonal: <TrendingUp className="h-4 w-4" />,
};

const TREND_COLORS: Record<TrendDirection, string> = {
  rising: '#16a34a',
  falling: '#dc2626',
  stable: '#6b7280',
  seasonal: '#7c3aed',
};

const TREND_LABELS: Record<TrendDirection, string> = {
  rising: 'Rising',
  falling: 'Falling',
  stable: 'Stable',
  seasonal: 'Seasonal',
};

/** Color palette for multiple keyword overlays */
const PALETTE = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

function formatMonthLabel(month: string): string {
  const parts = month.split('-');
  const m = parseInt(parts[1], 10);
  return MONTH_SHORT_LABELS[m - 1] ?? month;
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatChange(pct: number, period: string): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}% vs ${period}`;
}

/* ─────────────────────────────────────────────
   Chart building helpers
   ───────────────────────────────────────────── */

interface ChartDimensions {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

function buildPath(
  data: MonthlyDataPoint[],
  dims: ChartDimensions,
): string {
  if (data.length < 2) return '';

  const { width, height, padding } = dims;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const volumes = data.map((d) => d.volume);
  const max = Math.max(...volumes, 1);
  const min = Math.min(...volumes, 0);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * innerWidth;
    const y = padding.top + innerHeight - ((d.volume - min) / range) * innerHeight;
    return `${x},${y}`;
  });

  return `M${points.join(' L')}`;
}

function buildAreaPath(
  data: MonthlyDataPoint[],
  dims: ChartDimensions,
): string {
  if (data.length < 2) return '';

  const { width, height, padding } = dims;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const volumes = data.map((d) => d.volume);
  const max = Math.max(...volumes, 1);
  const min = Math.min(...volumes, 0);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * innerWidth;
    const y = padding.top + innerHeight - ((d.volume - min) / range) * innerHeight;
    return `${x},${y}`;
  });

  const firstX = padding.left;
  const lastX = padding.left + innerWidth;
  const bottomY = padding.top + innerHeight;

  return `M${points.join(' L')} L${lastX},${bottomY} L${firstX},${bottomY} Z`;
}

/* ─────────────────────────────────────────────
   Tooltip state
   ───────────────────────────────────────────── */

interface TooltipInfo {
  x: number;
  y: number;
  month: string;
  monthLabel: string;
  volumes: Array<{ keyword: string; volume: number; color: string }>;
}

/* ─────────────────────────────────────────────
   Skeleton (loading state)
   ───────────────────────────────────────────── */

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-[180px] w-full rounded-lg" />
      <div className="flex justify-between">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */

export interface VolumeTrendChartProps {
  /** Trend data for one or more keywords */
  data: VolumeTrendData[];
  /** Chart width (default 640) */
  width?: number;
  /** Chart height (default 200) */
  height?: number;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Called when the trend data needs to be fetched */
  onRequestTrends?: (keywords: string[]) => void;
  /** External className */
  className?: string;
}

export default function VolumeTrendChart({
  data,
  width = 640,
  height = 200,
  loading = false,
  className,
}: VolumeTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  // Responsive width
  const [chartWidth, setChartWidth] = useState(width);
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setChartWidth(Math.min(w, width));
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [width]);

  const dims: ChartDimensions = useMemo(
    () => ({
      width: chartWidth,
      height,
      padding: { top: 16, right: 16, bottom: 28, left: 56 },
    }),
    [chartWidth, height],
  );

  // Assign colors to keywords
  const coloredData = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        color: d.color ?? PALETTE[i % PALETTE.length],
      })),
    [data],
  );

  // Y-axis ticks
  const yTicks = useMemo(() => {
    if (coloredData.length === 0) return [];
    const allVolumes = coloredData.flatMap((d) => d.monthlyData.map((m) => m.volume));
    const max = Math.max(...allVolumes, 1);
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    const niceMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push(Math.round((niceMax / 4) * i));
    }
    return ticks;
  }, [coloredData]);

  // X-axis labels
  const xLabels = useMemo(() => {
    if (coloredData.length === 0) return [];
    const months = coloredData[0].monthlyData;
    // Show every other month if > 12, otherwise all
    const step = months.length > 10 ? 2 : 1;
    return months
      .map((d, i) => (i % step === 0 ? formatMonthLabel(d.month) : ''))
      .filter((_, i) => i % step === 0 ? true : false);
  }, [coloredData]);

  // Format labels with spacing
  const totalMonths = coloredData.length > 0 ? coloredData[0].monthlyData.length : 0;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (coloredData.length === 0) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      const { padding } = dims;
      const innerWidth = chartWidth - padding.left - padding.right;
      const months = coloredData[0].monthlyData;
      const index = Math.round(
        ((mouseX - padding.left) / innerWidth) * (months.length - 1),
      );
      const clamped = Math.max(0, Math.min(months.length - 1, index));

      const point = months[clamped];
      if (!point) return;

      const x = padding.left + (clamped / Math.max(months.length - 1, 1)) * innerWidth;

      const volumes = coloredData.map((d) => ({
        keyword: d.keyword,
        volume: d.monthlyData[clamped]?.volume ?? 0,
        color: d.color ?? '#6b7280',
      }));

      setTooltip({
        x,
        y: padding.top,
        month: point.month,
        monthLabel: formatMonthLabel(point.month),
        volumes,
      });
    },
    [coloredData, dims, chartWidth],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // ── States ──

  if (loading) {
    return <ChartSkeleton />;
  }

  if (!data || data.length === 0 || data.every((d) => d.monthlyData.length === 0)) {
    return (
      <div className="flex items-center justify-center h-[200px] border border-dashed border-border/40 rounded-lg bg-surface-raised/30">
        <p className="text-body-sm text-text-muted">No trend data available</p>
      </div>
    );
  }

  if (data.every((d) => d.monthlyData.every((m) => m.volume === 0))) {
    return (
      <div className="flex items-center justify-center h-[200px] border border-dashed border-border/40 rounded-lg bg-surface-raised/30">
        <p className="text-body-sm text-text-muted">No volume data for these keywords</p>
      </div>
    );
  }

  const firstTrend = coloredData[0];
  const trendColor = firstTrend?.color ?? TREND_COLORS[firstTrend?.trend ?? 'stable'];
  const trendIcon = TREND_ICONS[firstTrend?.trend ?? 'stable'];
  const trendLabel = TREND_LABELS[firstTrend?.trend ?? 'stable'];

  return (
    <div ref={containerRef} className={cn('space-y-3', className)}>
      {/* ── Summary bar ── */}
      {coloredData.length === 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: `${trendColor}14`,
              color: trendColor,
              border: `1px solid ${trendColor}33`,
            }}
          >
            {trendIcon}
            <span>{trendLabel}</span>
          </div>
          <span
            className="text-caption font-mono font-semibold"
            style={{ color: firstTrend.changePercent > 0 ? '#16a34a' : firstTrend.changePercent < 0 ? '#dc2626' : '#6b7280' }}
          >
            {formatChange(firstTrend.changePercent, firstTrend.changePeriod)}
          </span>
          {firstTrend.seasonality && (
            <span className="text-caption text-text-muted italic">
              {firstTrend.seasonality}
            </span>
          )}
        </div>
      )}

      {/* ── Multi-keyword legend ── */}
      {coloredData.length >= 2 && (
        <div className="flex items-center gap-4 flex-wrap">
          {coloredData.map((d, i) => (
            <button
              key={d.keyword}
              type="button"
              className={cn(
                'inline-flex items-center gap-1.5 text-caption transition-opacity',
                hoveredLine !== null && hoveredLine !== i && 'opacity-40',
              )}
              onMouseEnter={() => setHoveredLine(i)}
              onMouseLeave={() => setHoveredLine(null)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-text-secondary truncate max-w-[120px]">
                {d.keyword}
              </span>
              <span
                className="font-mono text-[10px] font-semibold"
                style={{
                  color: d.changePercent > 0 ? '#16a34a' : d.changePercent < 0 ? '#dc2626' : '#6b7280',
                }}
              >
                {d.changePercent > 0 ? '+' : ''}{d.changePercent}%
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Chart ── */}
      <div className="relative rounded-lg border border-border/40 bg-surface-raised/50">
        <svg
          width={chartWidth}
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="w-full"
          role="img"
          aria-label={`Volume trend chart for ${coloredData.map((d) => d.keyword).join(', ')}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Gradient definitions */}
          <defs>
            {coloredData.map((d, i) => (
              <linearGradient key={i} id={`area-grad-${i}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={d.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={d.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const { padding } = dims;
            const innerHeight = height - padding.top - padding.bottom;
            const y = padding.top + innerHeight - (tick / yTicks[yTicks.length - 1]) * innerHeight;
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="hsl(var(--border) / 0.3)"
                  strokeDasharray="4 3"
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-text-muted text-[9px]"
                >
                  {formatVolume(tick)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {coloredData.length > 0 &&
            coloredData[0].monthlyData.map((d, i) => {
              const { padding } = dims;
              const innerWidth = chartWidth - padding.left - padding.right;
              const x = padding.left + (i / Math.max(totalMonths - 1, 1)) * innerWidth;
              const showLabel = totalMonths <= 10 || i % 2 === 0;
              if (!showLabel) return null;
              return (
                <text
                  key={i}
                  x={x}
                  y={height - 4}
                  textAnchor="middle"
                  className="fill-text-muted text-[9px]"
                >
                  {formatMonthLabel(d.month)}
                </text>
              );
            })}

          {/* Zero baseline */}
          <line
            x1={dims.padding.left}
            y1={height - dims.padding.bottom}
            x2={chartWidth - dims.padding.right}
            y2={height - dims.padding.bottom}
            stroke="hsl(var(--border) / 0.4)"
            strokeWidth={0.5}
          />

          {/* Area fills (bottom layer) */}
          {coloredData.map((d, i) => (
            <path
              key={`area-${i}`}
              d={buildAreaPath(d.monthlyData, dims)}
              fill={`url(#area-grad-${i})`}
              className={cn(
                'transition-opacity duration-150',
                hoveredLine !== null && hoveredLine !== i && 'opacity-20',
              )}
            />
          ))}

          {/* Lines (middle layer) */}
          {coloredData.map((d, i) => (
            <path
              key={`line-${i}`}
              d={buildPath(d.monthlyData, dims)}
              fill="none"
              stroke={d.color}
              strokeWidth={hoveredLine === i ? 2.5 : 1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                'transition-all duration-150',
                hoveredLine !== null && hoveredLine !== i && 'opacity-30',
              )}
            />
          ))}

          {/* Last point dot (single keyword mode) */}
          {coloredData.length === 1 && coloredData[0].monthlyData.length > 0 && (() => {
            const lastData = coloredData[0];
            const last = lastData.monthlyData[lastData.monthlyData.length - 1];
            const { padding } = dims;
            const innerWidth = chartWidth - padding.left - padding.right;
            const innerHeight = height - padding.top - padding.bottom;
            const max = Math.max(...lastData.monthlyData.map((d) => d.volume), 1);
            const min = Math.min(...lastData.monthlyData.map((d) => d.volume), 0);
            const range = max - min || 1;
            const x = padding.left + innerWidth;
            const y = padding.top + innerHeight - ((last.volume - min) / range) * innerHeight;
            return (
              <circle
                cx={x}
                cy={y}
                r={3.5}
                fill="white"
                stroke={lastData.color}
                strokeWidth={2}
              />
            );
          })()}

          {/* Tooltip line and content */}
          {tooltip && (
            <>
              <line
                x1={tooltip.x}
                y1={dims.padding.top}
                x2={tooltip.x}
                y2={height - dims.padding.bottom}
                stroke="hsl(var(--text-muted) / 0.3)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {/* Tooltip background */}
              <rect
                x={Math.min(Math.max(tooltip.x - 60, 4), chartWidth - 124)}
                y={4}
                width={120}
                height={18 + tooltip.volumes.length * 14}
                rx={6}
                fill="hsl(var(--surface))"
                stroke="hsl(var(--border) / 0.6)"
              />
              <text
                x={Math.min(Math.max(tooltip.x, 64), chartWidth - 64)}
                y={16}
                textAnchor="middle"
                className="fill-text-primary font-semibold text-[10px]"
              >
                {tooltip.monthLabel} {tooltip.month.split('-')[0]}
              </text>
              {tooltip.volumes.map((v, vi) => (
                <text
                  key={vi}
                  x={Math.min(Math.max(tooltip.x, 64), chartWidth - 64)}
                  y={30 + vi * 14}
                  textAnchor="middle"
                  className="fill-text-secondary text-[9px]"
                >
                  <tspan fill={v.color}>●</tspan>{' '}
                  {coloredData.length > 1 ? `${v.keyword}: ` : ''}
                  {v.volume.toLocaleString()}
                </text>
              ))}
            </>
          )}
        </svg>
      </div>

      {/* ── Multi-keyword detail cards ── */}
      {coloredData.length >= 2 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {coloredData.map((d, i) => (
            <div
              key={d.keyword}
              className={cn(
                'rounded-lg border border-border/30 bg-surface-raised/30 px-3 py-2',
                hoveredLine === i && 'border-accent/40 bg-accent/[0.03]',
                hoveredLine !== null && hoveredLine !== i && 'opacity-50',
              )}
              onMouseEnter={() => setHoveredLine(i)}
              onMouseLeave={() => setHoveredLine(null)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-body-sm font-medium text-text-primary truncate">
                  {d.keyword}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-caption text-text-muted">
                <span
                  className="inline-flex items-center gap-0.5 font-mono font-semibold"
                  style={{
                    color: d.changePercent > 0 ? '#16a34a' : d.changePercent < 0 ? '#dc2626' : '#6b7280',
                  }}
                >
                  {d.changePercent > 0 ? '+' : ''}{d.changePercent}%
                </span>
                <span>vs {d.changePeriod}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Export: Mini trend sparkline with direction + % change
   ───────────────────────────────────────────── */

export interface MiniTrendIndicatorProps {
  trend: VolumeTrendData;
  width?: number;
  height?: number;
  showPercent?: boolean;
  className?: string;
}

export function MiniTrendIndicator({
  trend,
  width = 80,
  height = 24,
  showPercent = true,
  className,
}: MiniTrendIndicatorProps) {
  const paddedDims: ChartDimensions = {
    width,
    height,
    padding: { top: 4, right: 2, bottom: 2, left: 2 },
  };

  if (!trend || !trend.monthlyData || trend.monthlyData.length < 2) {
    return <span className="text-text-muted text-caption">—</span>;
  }

  const color = trend.color ?? TREND_COLORS[trend.trend];

  const path = buildPath(trend.monthlyData, paddedDims);
  if (!path) return <span className="text-text-muted text-caption">—</span>;

  const areaPath = buildAreaPath(trend.monthlyData, paddedDims);

  const icon =
    trend.trend === 'rising' ? '🔼' : trend.trend === 'falling' ? '🔽' : '➡️';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="inline-block align-middle shrink-0"
        role="img"
        aria-label={`${trend.trend} trend: ${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}%`}
      >
        <defs>
          <linearGradient id={`mini-grad`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#mini-grad)`} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-caption text-text-muted">{icon}</span>
      {showPercent && (
        <span
          className="font-mono text-[10px] font-semibold whitespace-nowrap"
          style={{
            color: trend.changePercent > 0 ? '#16a34a' : trend.changePercent < 0 ? '#dc2626' : '#6b7280',
          }}
        >
          {trend.changePercent > 0 ? '+' : ''}{trend.changePercent}%
        </span>
      )}
    </span>
  );
}
