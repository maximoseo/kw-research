'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, ChevronDown, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────

export interface FilterPreset {
  name: string;
  minDifficulty: number;
  maxDifficulty: number;
  minVolume: number;
  maxVolume: number;
  intents: string[]; // ['Informational', 'Commercial', etc.]
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
  createdAt: number;
}

export interface CurrentFilters {
  minDifficulty: number;
  maxDifficulty: number;
  minVolume: number;
  maxVolume: number;
  intents: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
}

const STORAGE_KEY = 'kw-research-filter-presets';
const MAX_PRESETS = 10;

// ── Storage helpers ────────────────────────────────────

function loadPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

// ── Helpers ────────────────────────────────────────────

function filtersMatch(a: CurrentFilters, b: FilterPreset): boolean {
  return (
    a.minDifficulty === b.minDifficulty &&
    a.maxDifficulty === b.maxDifficulty &&
    a.minVolume === b.minVolume &&
    a.maxVolume === b.maxVolume &&
    arraysEqual(a.intents.sort(), b.intents.sort()) &&
    a.sortBy === b.sortBy &&
    a.sortOrder === b.sortOrder &&
    a.searchQuery === b.searchQuery
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getDefaultPresetName(existing: FilterPreset[]): string {
  let i = 1;
  while (existing.some((p) => p.name === `Filter ${i}`)) {
    i++;
  }
  return `Filter ${i}`;
}

// ── Component ──────────────────────────────────────────

interface FilterPresetsProps {
  currentFilters: CurrentFilters;
  onLoadPreset: (preset: FilterPreset) => void;
  className?: string;
}

export default function FilterPresets({ currentFilters, onLoadPreset, className }: FilterPresetsProps) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [hasMounted, setHasMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setPresets(loadPresets());
    setHasMounted(true);
  }, []);

  // Persist whenever presets change (after mount)
  useEffect(() => {
    if (hasMounted) {
      savePresets(presets);
    }
  }, [presets, hasMounted]);

  // Find if current filters match a saved preset
  const matchingPreset = useMemo(
    () => presets.find((p) => filtersMatch(currentFilters, p)),
    [presets, currentFilters],
  );

  // ── Actions ──────────────────────────────────────────

  const handleSave = useCallback(() => {
    const name = saveName.trim() || getDefaultPresetName(presets);

    // Check for existing name
    const existing = presets.find((p) => p.name === name);
    if (existing) {
      const confirmed = window.confirm(
        `A preset named "${name}" already exists. Overwrite it?`,
      );
      if (!confirmed) return;
    }

    // Enforce max 10
    let next: FilterPreset[];
    const newPreset: FilterPreset = {
      name,
      ...currentFilters,
      createdAt: Date.now(),
    };

    if (existing) {
      next = presets.map((p) => (p.name === name ? newPreset : p));
    } else {
      if (presets.length >= MAX_PRESETS) {
        // Remove oldest
        const sorted = [...presets].sort((a, b) => a.createdAt - b.createdAt);
        next = [...sorted.slice(1), newPreset];
      } else {
        next = [...presets, newPreset];
      }
    }

    setPresets(next);
    setSaveOpen(false);
    setSaveName('');
  }, [saveName, presets, currentFilters]);

  const handleDelete = useCallback(
    (name: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setPresets((prev) => prev.filter((p) => p.name !== name));
    },
    [],
  );

  const handleLoad = useCallback(
    (preset: FilterPreset) => {
      onLoadPreset(preset);
      setOpen(false);
    },
    [onLoadPreset],
  );

  // ── UI States ─────────────────────────────────────────

  if (!hasMounted) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <div className="h-8 w-20 animate-pulse rounded-md bg-border/30" />
      </div>
    );
  }

  const isAtMax = presets.length >= MAX_PRESETS;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* ── Save button ── */}
      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={<Save className="h-3.5 w-3.5" />}
          onClick={() => {
            setSaveName(getDefaultPresetName(presets));
            setSaveOpen(true);
          }}
          disabled={isAtMax && !matchingPreset}
          className="text-text-muted hover:text-accent"
          title={isAtMax && !matchingPreset ? 'Max 10 presets — delete one first' : 'Save current filters'}
        >
          Save
        </Button>

        {/* Save dialog */}
        {saveOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border/50 bg-surface-raised p-3 shadow-elevation-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-caption font-semibold text-text-primary">Save Filter Preset</p>
              <button
                type="button"
                className="rounded p-0.5 text-text-muted hover:text-text-primary transition-colors"
                onClick={() => setSaveOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setSaveOpen(false);
                }}
                placeholder="Preset name"
                className="field-input text-sm w-full"
                autoFocus
              />
              {isAtMax && !matchingPreset && (
                <p className="text-caption text-warning">
                  Max {MAX_PRESETS} presets. Saving will remove the oldest one.
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="flex-1"
                  onClick={handleSave}
                >
                  Save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSaveOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Load dropdown ── */}
      {presets.length > 0 && (
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<Bookmark className="h-3.5 w-3.5" />}
            onClick={() => setOpen((prev) => !prev)}
            className={cn(
              'text-text-muted hover:text-accent gap-1',
              matchingPreset && 'text-accent border-accent/20',
            )}
          >
            <span className="max-w-[100px] truncate">
              {matchingPreset ? matchingPreset.name : 'Presets'}
            </span>
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                open && 'rotate-180',
              )}
            />
          </Button>

          {open && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              {/* Dropdown */}
              <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border/50 bg-surface-raised shadow-elevation-2 max-h-72 overflow-y-auto">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-caption font-semibold text-text-primary">
                    Saved Presets
                  </p>
                </div>
                {presets.length === 0 ? (
                  <div className="px-3 py-4 text-center text-caption text-text-muted">
                    No saved presets yet
                  </div>
                ) : (
                  <div className="py-1">
                    {presets.map((preset) => {
                      const isActive = filtersMatch(currentFilters, preset);
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          className={cn(
                            'w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-body-sm transition-colors hover:bg-surface-inset',
                            isActive && 'bg-accent/[0.04]',
                          )}
                          onClick={() => handleLoad(preset)}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'truncate font-medium',
                                isActive
                                  ? 'text-accent'
                                  : 'text-text-primary',
                              )}
                            >
                              {preset.name}
                            </p>
                            <p className="text-caption text-text-muted truncate">
                              {[
                                preset.intents.length > 0 &&
                                  preset.intents.join(', '),
                                preset.searchQuery &&
                                  `"${preset.searchQuery}"`,
                                preset.sortBy !== 'volume' &&
                                  `Sort: ${preset.sortBy}`,
                                (preset.minDifficulty > 0 ||
                                  preset.maxDifficulty < 100) &&
                                  `KD ${preset.minDifficulty}–${preset.maxDifficulty}`,
                                (preset.minVolume > 0 ||
                                  preset.maxVolume < 1_000_000) &&
                                  `Vol ${preset.minVolume}–${preset.maxVolume}`,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'No active filters'}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            onClick={(e) => handleDelete(preset.name, e)}
                            title={`Delete "${preset.name}"`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Active preset indicator when no dropdown needed */}
      {matchingPreset && presets.length === 0 && (
        <span className="text-caption text-accent truncate max-w-[120px]">
          {matchingPreset.name}
        </span>
      )}
    </div>
  );
}
