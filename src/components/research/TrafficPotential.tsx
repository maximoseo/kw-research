'use client';

import React, { useState } from 'react';
import { TrendingUp, Loader2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

export interface TrafficPotentialData {
  keyword: string;
  volume: number | null;
  trafficPotential: number | null;
  relatedKeywordCount: number | null;
  explanation: string | null;
  factor: number | null;
}

type TPState = 'idle' | 'calculating' | 'shown' | 'unavailable';

/* ─────────────────────────────────────────────
   Color logic
   ───────────────────────────────────────────── */

function getTPColor(tp: number, volume: number): string {
  if (!volume || volume === 0) return 'text-text-muted';
  const ratio = tp / volume;
  if (ratio > 2.0) return 'text-green-500';
  if (ratio >= 1.0) return 'text-yellow-500';
  return 'text-text-muted';
}

function getTPBgClass(tp: number, volume: number): string {
  if (!volume || volume === 0) return 'bg-surface-inset';
  const ratio = tp / volume;
  if (ratio > 2.0) return 'bg-green-500/10 border-green-500/20';
  if (ratio >= 1.0) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-surface-inset border-border/30';
}

function getTpMultiplierLabel(tp: number, volume: number): string {
  if (!volume || volume === 0) return '';
  const ratio = tp / volume;
  if (ratio >= 3.5) return '🔥';
  if (ratio >= 2.5) return '📈';
  if (ratio >= 1.5) return '👍';
  return '';
}

/* ─────────────────────────────────────────────
   Tooltip Component
   ───────────────────────────────────────────── */

function TPTooltip({
  keyword,
  volume,
  trafficPotential,
  relatedKeywordCount,
  explanation,
  factor,
  onClose,
}: TrafficPotentialData & { onClose: () => void }) {
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const ratio =
    volume && trafficPotential && volume > 0
      ? (trafficPotential / volume).toFixed(1)
      : null;

  return (
    <div
      ref={tooltipRef}
      className="absolute bottom-full left-1/2 -translate-x-1/2 z-30 mb-2 w-72 rounded-lg border border-border/60 bg-surface shadow-elevation-2 p-3"
    >
      <div className="text-body-sm font-semibold text-text-primary mb-1">
        Traffic Potential: {trafficPotential?.toLocaleString() ?? '—'}
      </div>
      <div className="text-caption text-text-secondary space-y-1">
        <p>
          <span className="font-medium">Target volume:</span>{' '}
          {volume?.toLocaleString() ?? '—'}
          {ratio && (
            <span className="ml-1 text-text-muted">
              ({ratio}×)
            </span>
          )}
        </p>
        {relatedKeywordCount != null && (
          <p>
            <span className="font-medium">Related keywords:</span> ~
            {relatedKeywordCount} terms
          </p>
        )}
        {explanation && (
          <p className="text-text-muted italic">{explanation}</p>
        )}
      </div>
      <div className="mt-2 pt-2 border-t border-border/30">
        <p className="text-caption text-text-muted leading-relaxed">
          Traffic Potential estimates total organic traffic a top-ranking page
          gets from <strong>all</strong> keywords it ranks for, not just the
          target keyword. A page ranking #1 for "{keyword}" typically also ranks
          for {relatedKeywordCount != null ? `~${relatedKeywordCount}` : 'many'}{' '}
          related long-tail variants.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Skeleton (calculating state)
   ───────────────────────────────────────────── */

function TPSkeleton() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/30 px-2 py-0.5 bg-surface-inset animate-pulse">
      <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
      <span className="text-caption text-text-muted">TP...</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────── */

interface TrafficPotentialBadgeProps {
  /** Traffic potential data (null = not available) */
  data?: TrafficPotentialData | null;
  /** Whether the TP is currently being calculated */
  calculating?: boolean;
  /** Show volume next to TP (e.g., "Vol: 12,400 (TP: ~28,000)") */
  showVolumeLabel?: boolean;
  /** Compact mode: just the TP number */
  compact?: boolean;
  /** Additional class name */
  className?: string;
}

export default function TrafficPotentialBadge({
  data,
  calculating = false,
  showVolumeLabel = false,
  compact = false,
  className,
}: TrafficPotentialBadgeProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // Calculating state
  if (calculating) {
    return <TPSkeleton />;
  }

  // No data / unavailable state
  if (!data || data.trafficPotential == null) {
    if (compact) return null;
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-border/20 px-1.5 py-0.5 text-caption text-text-muted/50',
          className,
        )}
        title="Traffic Potential not available"
      >
        <TrendingUp className="h-3 w-3 opacity-30" />
        —
      </span>
    );
  }

  const { volume, trafficPotential } = data;
  const colorClass = volume ? getTPColor(trafficPotential, volume) : 'text-text-muted';
  const bgClass = volume ? getTPBgClass(trafficPotential, volume) : 'bg-surface-inset';
  const emojiLabel = volume ? getTpMultiplierLabel(trafficPotential, volume) : '';

  if (compact) {
    return (
      <div className="relative inline-flex items-center">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-caption font-mono tabular-nums cursor-help',
            bgClass,
            colorClass,
            className,
          )}
          onClick={() => setTooltipOpen(!tooltipOpen)}
          title="Traffic Potential — click for details"
        >
          {trafficPotential.toLocaleString()}
          {emojiLabel}
        </span>
        {tooltipOpen && (
          <TPTooltip {...data} onClose={() => setTooltipOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative inline-flex items-center gap-1.5', className)}>
      {/* Volume label */}
      {showVolumeLabel && volume != null && (
        <span className="text-caption text-text-secondary font-mono tabular-nums">
          Vol: {volume.toLocaleString()}
        </span>
      )}

      {/* TP Badge */}
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-caption font-mono tabular-nums cursor-help transition-colors',
          bgClass,
          colorClass,
        )}
        onClick={() => setTooltipOpen(!tooltipOpen)}
        title="Traffic Potential — click for details"
      >
        <TrendingUp className="h-3 w-3" />
        <span>TP: ~{trafficPotential.toLocaleString()}</span>
        {emojiLabel}
      </span>

      {/* Tooltip */}
      {tooltipOpen && (
        <TPTooltip {...data} onClose={() => setTooltipOpen(false)} />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Helper: Format for table cell (no container)
   ───────────────────────────────────────────── */

interface TrafficPotentialCellProps {
  data?: TrafficPotentialData | null;
  calculating?: boolean;
}

export function TrafficPotentialCell({
  data,
  calculating,
}: TrafficPotentialCellProps) {
  if (calculating) {
    return (
      <div className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
        <span className="text-caption text-text-muted">…</span>
      </div>
    );
  }

  if (!data || data.trafficPotential == null) {
    return (
      <span className="text-caption text-text-muted/40 font-mono tabular-nums">
        —
      </span>
    );
  }

  const { volume, trafficPotential } = data;
  const colorClass = volume ? getTPColor(trafficPotential, volume) : 'text-text-muted';
  const bgClass = volume ? getTPBgClass(trafficPotential, volume) : 'bg-surface-inset';
  const emojiLabel = volume ? getTpMultiplierLabel(trafficPotential, volume) : '';

  // For cell: compact inline display
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-caption font-mono tabular-nums',
        bgClass,
        colorClass,
      )}
      title={
        data.explanation
          ? `TP: ${trafficPotential.toLocaleString()} — ${data.explanation}`
          : `Traffic Potential: ${trafficPotential.toLocaleString()}`
      }
    >
      {trafficPotential.toLocaleString()}
      {emojiLabel}
    </span>
  );
}
