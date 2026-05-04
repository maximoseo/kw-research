'use client';

import { ArrowDown, ArrowUp, Equal, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

export interface PersonalDifficultyData {
  personalDifficulty: number;
  genericDifficulty: number;
  explanation?: string;
  confidence?: number;
  gapToTop3?: number;
}

interface PersonalDifficultyBadgeProps {
  /** Generic difficulty (0–100), from keyword research data */
  genericDifficulty?: number | null;
  /** Personal difficulty data from the API */
  personalData?: PersonalDifficultyData | null;
  /** Whether the personal diff is loading */
  loading?: boolean;
  /** If no domain is configured */
  unavailable?: boolean;
  /** Additional classes */
  className?: string;
  /** Compact mode (just icons, no bars) */
  compact?: boolean;
}

/* ─────────────────────────────────────────────
   Color helpers
   ───────────────────────────────────────────── */

function diffColor(val: number): string {
  if (val <= 30) return 'bg-green-500';
  if (val <= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

function diffTextColor(val: number): string {
  if (val <= 30) return 'text-green-600';
  if (val <= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function diffLabel(val: number): string {
  if (val <= 20) return 'Very Easy';
  if (val <= 40) return 'Easy';
  if (val <= 60) return 'Moderate';
  if (val <= 80) return 'Hard';
  return 'Very Hard';
}

/* ─────────────────────────────────────────────
   Component
   ───────────────────────────────────────────── */

export default function PersonalDifficultyBadge({
  genericDifficulty,
  personalData,
  loading = false,
  unavailable = false,
  className,
  compact = false,
}: PersonalDifficultyBadgeProps) {
  /* ── Loading state ── */
  if (loading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="h-4 w-16 animate-pulse rounded bg-surface-inset" />
        <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
      </div>
    );
  }

  /* ── Unavailable state ── */
  if (unavailable || !personalData) {
    const gd = genericDifficulty ?? null;
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <DifficultyMiniBar value={gd} />
        <span className="text-caption text-text-muted" title="Set your domain to see personal difficulty">
          —
        </span>
      </div>
    );
  }

  const { personalDifficulty, genericDifficulty: pdGeneric, explanation, confidence } = personalData;
  const pd = personalDifficulty;
  const gd = pdGeneric ?? genericDifficulty ?? null;

  /* ── Difference indicator ── */
  const diff = gd != null ? pd - gd : 0;
  const advantage = diff <= -10;
  const disadvantage = diff >= 10;
  const neutral = !advantage && !disadvantage;

  /* ── Tooltip text ── */
  const tooltipParts: string[] = [];
  if (gd != null) tooltipParts.push(`Generic: ${gd}/100`);
  tooltipParts.push(`Your site: ${pd}/100 (${diffLabel(pd)})`);
  if (diff !== 0) {
    const direction = diff < 0 ? 'easier' : 'harder';
    tooltipParts.push(`${Math.abs(diff)} pts ${direction} than average`);
  }
  if (explanation) tooltipParts.push(explanation);
  if (confidence != null) tooltipParts.push(`Confidence: ${confidence}%`);
  const tooltip = tooltipParts.join('\n');

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)} title={tooltip}>
        {advantage ? (
          <TrendingDown className="h-3.5 w-3.5 text-green-500" />
        ) : disadvantage ? (
          <TrendingUp className="h-3.5 w-3.5 text-red-500" />
        ) : (
          <Equal className="h-3 w-3 text-yellow-500" />
        )}
        <span className={cn('font-mono text-body-sm tabular-nums', diffTextColor(pd))}>
          {pd}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)} title={tooltip}>
      {/* Generic difficulty */}
      {gd != null && (
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-10 rounded-full bg-surface-inset overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', diffColor(gd))}
              style={{ width: `${Math.min(100, gd)}%` }}
            />
          </div>
          <span className="text-caption text-text-muted font-mono tabular-nums w-6 text-right">
            {gd}
          </span>
        </div>
      )}

      {/* Arrow indicator */}
      <span className="text-text-muted/40">→</span>

      {/* Personal difficulty */}
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-10 rounded-full bg-surface-inset overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              pd <= 30 ? 'bg-emerald-500' : pd <= 60 ? 'bg-amber-500' : 'bg-rose-500',
            )}
            style={{ width: `${Math.min(100, pd)}%` }}
          />
        </div>
        <span className={cn('font-mono text-body-sm font-semibold tabular-nums w-6 text-right', diffTextColor(pd))}>
          {pd}
        </span>

        {/* Advantage/disadvantage icon */}
        {advantage && (
          <ArrowDown className="h-3 w-3 text-green-500 shrink-0" />
        )}
        {disadvantage && (
          <ArrowUp className="h-3 w-3 text-red-500 shrink-0" />
        )}
        {neutral && gd != null && (
          <span className="text-yellow-500 text-caption shrink-0">≈</span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Standalone mini bar (used in unavailable state)
   ───────────────────────────────────────────── */

function DifficultyMiniBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-caption text-text-muted">—</span>;
  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-10 rounded-full bg-surface-inset overflow-hidden">
        <div
          className={cn('h-full rounded-full', diffColor(value))}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="font-mono text-body-sm text-text-secondary tabular-nums w-6 text-right">
        {value}
      </span>
    </div>
  );
}

export { DifficultyMiniBar };
