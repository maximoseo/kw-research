'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// ── Color & label mapping ──
const DIFFICULTY_LEVELS = [
  { min: 0, max: 20, color: '#16a34a', bg: 'rgba(22,163,74,0.12)', label: 'Easy' },
  { min: 21, max: 40, color: '#65a30d', bg: 'rgba(101,163,13,0.12)', label: 'Low' },
  { min: 41, max: 60, color: '#ca8a04', bg: 'rgba(202,138,4,0.12)', label: 'Medium' },
  { min: 61, max: 80, color: '#ea580c', bg: 'rgba(234,88,12,0.12)', label: 'Hard' },
  { min: 81, max: 100, color: '#dc2626', bg: 'rgba(220,38,38,0.12)', label: 'Very Hard' },
] as const;

function getLevel(difficulty: number) {
  const clamped = Math.max(0, Math.min(100, difficulty));
  return DIFFICULTY_LEVELS.find((l) => clamped >= l.min && clamped <= l.max) ?? DIFFICULTY_LEVELS[2];
}

function getTooltip(difficulty: number): string {
  const clamped = Math.max(0, Math.min(100, difficulty));
  const level = getLevel(clamped);
  let context = '';

  if (clamped <= 20) {
    context = 'low competition, highly rankable with basic content';
  } else if (clamped <= 40) {
    context = 'manageable competition, rankable with decent content';
  } else if (clamped <= 60) {
    context = 'moderate competition, likely rankable with quality content';
  } else if (clamped <= 80) {
    context = 'strong competition, needs authoritative content and backlinks';
  } else {
    context = 'very high competition, requires exceptional content and domain authority';
  }

  return `${clamped}/100 difficulty — ${context}`;
}

// ── LocalStorage helpers ──
const STORAGE_KEY = 'difficulty-badge-variant';

function getStoredVariant(): 'badge' | 'bar' {
  if (typeof window === 'undefined') return 'badge';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'bar') return 'bar';
    return 'badge';
  } catch {
    return 'badge';
  }
}

function setStoredVariant(variant: 'badge' | 'bar') {
  try {
    localStorage.setItem(STORAGE_KEY, variant);
  } catch {
    // localStorage unavailable
  }
}

// ── URL colorblind mode check ──
function useColorblindMode(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setEnabled(params.get('colorblind') === '1');
  }, []);

  return enabled;
}

// ── Props ──
interface DifficultyBadgeProps {
  difficulty: number;
  showLabel?: boolean;
  variant?: 'badge' | 'bar';
  className?: string;
}

// ── Sub-components ──

function BadgeVariant({
  difficulty,
  showLabel,
  colorblind,
  className,
}: {
  difficulty: number;
  showLabel: boolean;
  colorblind: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(difficulty)));
  const level = getLevel(clamped);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap',
        colorblind && 'cb-striped',
        className,
      )}
      style={{
        backgroundColor: level.bg,
        color: level.color,
        border: `1px solid ${level.color}33`,
        ...(colorblind
          ? {
              backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 3px, ${level.color}18 3px, ${level.color}18 6px)`,
            }
          : {}),
      }}
      title={getTooltip(difficulty)}
    >
      {/* Colorblind icon */}
      {colorblind && <DifficultyIcon difficulty={clamped} />}
      <span>{clamped}</span>
      {showLabel && <span className="opacity-80">{level.label}</span>}
    </span>
  );
}

function BarVariant({
  difficulty,
  showLabel,
  colorblind,
  className,
}: {
  difficulty: number;
  showLabel: boolean;
  colorblind: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(difficulty)));
  const level = getLevel(clamped);

  return (
    <span
      className={cn('inline-flex items-center gap-2 min-w-[100px]', className)}
      title={getTooltip(difficulty)}
    >
      <span
        className={cn(
          'h-2 flex-1 rounded-full overflow-hidden',
          colorblind && 'cb-striped-bar',
        )}
        style={{
          backgroundColor: `${level.color}26`,
          border: `1px solid ${level.color}33`,
        }}
      >
        <span
          className={cn(
            'h-full rounded-full transition-all duration-300',
            colorblind && 'cb-striped-fill',
          )}
          style={{
            width: `${clamped}%`,
            backgroundColor: level.color,
            ...(colorblind
              ? {
                  backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(0,0,0,0.15) 4px, rgba(0,0,0,0.15) 8px)`,
                }
              : {}),
          }}
        />
      </span>
      {showLabel && (
        <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: level.color }}>
          {clamped} {level.label}
        </span>
      )}
    </span>
  );
}

function DifficultyIcon({ difficulty }: { difficulty: number }) {
  const level = getLevel(difficulty);
  // Simple geometric shapes that differ by level — recognizable even without color
  switch (level.label) {
    case 'Easy':
      // Empty circle
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'Low':
      // Circle with dot
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="7" r="2" fill="currentColor" />
        </svg>
      );
    case 'Medium':
      // Half-filled circle
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1.5 7A5.5 5.5 0 0 1 12.5 7" fill="currentColor" />
        </svg>
      );
    case 'Hard':
      // Filled with a horizontal line
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="7" r="4" fill="currentColor" />
          <line x1="3" y1="10.5" x2="11" y2="10.5" stroke="white" strokeWidth="1.2" />
        </svg>
      );
    case 'Very Hard':
      // Filled with an X
      return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="7" r="4" fill="currentColor" />
          <line x1="4.5" y1="4.5" x2="9.5" y2="9.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="9.5" y1="4.5" x2="4.5" y2="9.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
  }
}

// ── Toggle button (for user preference) ──
export function DifficultyVariantToggle({
  className,
}: {
  className?: string;
}) {
  const [variant, setVariant] = useState<'badge' | 'bar'>('badge');

  useEffect(() => {
    setVariant(getStoredVariant());
    const handler = () => setVariant(getStoredVariant());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const toggle = () => {
    const next = variant === 'badge' ? 'bar' : 'badge';
    setVariant(next);
    setStoredVariant(next);
    // Dispatch custom event so all instances update
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 text-[11px] font-medium text-text-muted transition-colors hover:bg-surface-inset hover:text-text-secondary',
        className,
      )}
      title={`Switch to ${variant === 'badge' ? 'bar' : 'badge'} view`}
    >
      {variant === 'badge' ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <rect x="0.5" y="0.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1" />
            <rect x="2" y="3" width="8" height="2" rx="1" fill="currentColor" opacity="0.5" />
            <rect x="2" y="6" width="5" height="2" rx="1" fill="currentColor" opacity="0.5" />
          </svg>
          Pill
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <rect x="0.5" y="4.5" width="11" height="3" rx="1.5" stroke="currentColor" strokeWidth="1" />
            <rect x="1" y="5" width="6" height="2" rx="1" fill="currentColor" />
          </svg>
          Bar
        </>
      )}
    </button>
  );
}

// ── Main component ──
export default function DifficultyBadge({
  difficulty,
  showLabel = true,
  variant: propVariant,
  className,
}: DifficultyBadgeProps) {
  const colorblind = useColorblindMode();
  const [storedVariant, setStoredVariant] = useState<'badge' | 'bar'>('badge');

  useEffect(() => {
    if (propVariant) return;
    setStoredVariant(getStoredVariant());
    const handler = () => setStoredVariant(getStoredVariant());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [propVariant]);

  const resolvedVariant = propVariant ?? storedVariant;

  if (resolvedVariant === 'bar') {
    return (
      <BarVariant
        difficulty={difficulty}
        showLabel={showLabel}
        colorblind={colorblind}
        className={className}
      />
    );
  }

  return (
    <BadgeVariant
      difficulty={difficulty}
      showLabel={showLabel}
      colorblind={colorblind}
      className={className}
    />
  );
}
