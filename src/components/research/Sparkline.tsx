'use client';

import { useMemo } from 'react';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type TrendDirection = 'up' | 'down' | 'stable';

function detectTrend(data: number[]): TrendDirection {
  if (data.length < 6) return 'stable';

  const firstHalf = data.slice(0, 3);
  const lastHalf = data.slice(-3);

  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const lastAvg = lastHalf.reduce((sum, v) => sum + v, 0) / lastHalf.length;

  if (firstAvg === 0 && lastAvg === 0) return 'stable';
  const change = firstAvg === 0 ? lastAvg : (lastAvg - firstAvg) / Math.abs(firstAvg);

  if (change > 0.15) return 'up';
  if (change < -0.15) return 'down';
  return 'stable';
}

const TREND_COLORS: Record<TrendDirection, string> = {
  up: '#16a34a',
  down: '#dc2626',
  stable: '#6b7280',
};

const TREND_ICONS: Record<TrendDirection, string> = {
  up: '🔼',
  down: '🔽',
  stable: '➡️',
};

function computeChangePercent(data: number[]): number | null {
  if (data.length < 6) return null;

  const firstAvg = data.slice(0, 3).reduce((s, v) => s + v, 0) / 3;
  const lastAvg = data.slice(-3).reduce((s, v) => s + v, 0) / 3;

  if (firstAvg === 0) return null;
  return Math.round(((lastAvg - firstAvg) / firstAvg) * 100);
}

function buildPath(data: number[], width: number, height: number, padding: number): string {
  if (data.length === 0) return '';

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);

  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const y = padding + innerHeight - ((value - min) / range) * innerHeight;
    return `${x},${y}`;
  });

  const pointsStr = points.join(' ');
  return `M${pointsStr}`;
}

function buildAreaPath(data: number[], width: number, height: number, padding: number): string {
  if (data.length === 0) return '';

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);

  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * innerWidth;
    const y = padding + innerHeight - ((value - min) / range) * innerHeight;
    return `${x},${y}`;
  });

  return `M${points.join(' ')} L${width - padding},${height - padding} L${padding},${height - padding} Z`;
}

function buildTooltip(data: number[]): string {
  if (data.length === 0) return 'No data';

  return data
    .map((value, index) => {
      const month = MONTH_LABELS[index] ?? `M${index + 1}`;
      return `${month}: ${value.toLocaleString()}`;
    })
    .join(', ');
}

export interface SparklineProps {
  /** Array of 12 monthly search volume values */
  data: number[];
  /** Width in pixels (default 60) */
  width?: number;
  /** Height in pixels (default 20) */
  height?: number;
  /** Show direction indicator icon (default false) */
  showDirection?: boolean;
  /** Show percent change next to the sparkline (default false) */
  showPercent?: boolean;
  /** Show area fill under the line (default true) */
  showFill?: boolean;
  /** Line stroke width (default 1.2) */
  strokeWidth?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Sparkline — renders a tiny inline SVG trend chart for keyword volume data.
 *
 * Props:
 * - `data`: number[] (monthly values)
 * - `width`: number (default 60)
 * - `height`: number (default 20)
 * - `showDirection`: boolean — show 🔼/🔽/➡️ icon
 * - `showPercent`: boolean — show +/-X% change
 *
 * Trend detection: comparing first 3 months average vs last 3 months average.
 * Colors: green (up), red (down), gray (stable).
 * Graceful fallback: renders an em dash "—" when data is empty or all zeros.
 */
export default function Sparkline({
  data,
  width = 60,
  height = 20,
  showDirection = false,
  showPercent = false,
  showFill = true,
  strokeWidth = 1.2,
  className,
}: SparklineProps) {
  const trend = useMemo(() => detectTrend(data), [data]);
  const changePercent = useMemo(() => (showPercent ? computeChangePercent(data) : null), [data, showPercent]);
  const color = TREND_COLORS[trend];
  const tooltip = useMemo(() => buildTooltip(data), [data]);

  // Graceful fallback: empty or missing data
  if (!data || data.length === 0) {
    return <span className="text-text-muted" aria-label="No trend data">—</span>;
  }

  // All zeros → no meaningful trend
  const allZero = data.every((v) => v === 0);
  if (allZero) {
    return <span className="text-text-muted" aria-label="No volume data">—</span>;
  }

  const padding = 2;
  const path = buildPath(data, width, height, padding);

  if (!path) {
    return <span className="text-text-muted" aria-label="No trend data">—</span>;
  }

  const changeStr =
    changePercent !== null
      ? `${changePercent > 0 ? '+' : ''}${changePercent}%`
      : null;

  const icon = showDirection ? TREND_ICONS[trend] : null;

  const svg = (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
      aria-label={`Trend: ${trend}${changeStr ? ` (${changeStr})` : ''}`}
      role="img"
    >
      <title>{tooltip}</title>
      {/* Subtle fill under the line */}
      {showFill && (
        <path
          d={buildAreaPath(data, width, height, padding)}
          fill={color}
          fillOpacity={0.08}
        />
      )}
      {/* The line itself */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // If no extra indicators, just return the SVG
  if (!showDirection && !showPercent) {
    return svg;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      {svg}
      {icon && (
        <span className="text-[11px] leading-none" aria-hidden="true">
          {icon}
        </span>
      )}
      {changeStr && (
        <span
          className="font-mono text-[10px] font-semibold leading-none"
          style={{ color }}
        >
          {changeStr}
        </span>
      )}
    </span>
  );
}
