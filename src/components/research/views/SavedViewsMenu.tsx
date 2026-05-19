'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, ChevronDown, Save, Trash2, X } from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SavedView {
  id: string;
  name: string;
  viewType: string;
  state: Record<string, unknown>;
  savedAt: number;
}

// ── localStorage key ─────────────────────────────────────────────────────────

const SAVED_VIEWS_KEY = 'kw-research-saved-views';
const MAX_VIEWS = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadViews(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

function saveViews(views: SavedView[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSavedViews() {
  const [views, setViews] = useState<SavedView[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setViews(loadViews());
    setMounted(true);
  }, []);

  const saveView = useCallback(
    (name: string, viewType: string, state: Record<string, unknown>): SavedView => {
      const entry: SavedView = {
        id: generateId(),
        name: name.trim() || 'Untitled View',
        viewType,
        state,
        savedAt: Date.now(),
      };
      setViews((prev) => {
        const next = [entry, ...prev].slice(0, MAX_VIEWS);
        saveViews(next);
        return next;
      });
      return entry;
    },
    [],
  );

  const deleteView = useCallback((id: string) => {
    setViews((prev) => {
      const next = prev.filter((v) => v.id !== id);
      saveViews(next);
      return next;
    });
  }, []);

  return { views, mounted, saveView, deleteView };
}

// ── Component ────────────────────────────────────────────────────────────────

export interface SavedViewsMenuProps {
  views: SavedView[];
  mounted: boolean;
  onLoad: (view: SavedView) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  viewType: string;
  currentState: Record<string, unknown>;
}

export default function SavedViewsMenu({
  views,
  mounted,
  onLoad,
  onSave,
  onDelete,
  viewType,
  currentState,
}: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowSaveInput(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSaveInput) {
          setShowSaveInput(false);
          setSaveName('');
        } else {
          setOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, showSaveInput]);

  // Focus save input
  useEffect(() => {
    if (showSaveInput && saveInputRef.current) {
      saveInputRef.current.focus();
    }
  }, [showSaveInput]);

  const handleSave = useCallback(() => {
    const name = saveName.trim() || `View ${views.length + 1}`;
    onSave(name);
    setSaveName('');
    setShowSaveInput(false);
  }, [saveName, views.length, onSave]);

  const hasState = useMemo(
    () => Object.keys(currentState).length > 0,
    [currentState],
  );

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface px-3 py-1.5 text-body-sm font-medium text-text-primary hover:bg-surface-raised transition-colors cursor-pointer',
          open && 'bg-surface-raised border-accent/30',
        )}
      >
        <Bookmark className="h-3.5 w-3.5 text-accent" />
        <span>Views{views.length > 0 ? ` (${views.length})` : ''}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-border/50 bg-surface shadow-elevation-3 overflow-hidden animate-enter">
          {/* Save button */}
          <div className="border-b border-border/50 px-3 py-2">
            {showSaveInput ? (
              <div className="flex items-center gap-2">
                <input
                  ref={saveInputRef}
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="View name…"
                  className="flex-1 rounded-md border border-border/50 bg-surface-raised px-2 py-1 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') {
                      setShowSaveInput(false);
                      setSaveName('');
                    }
                  }}
                />
                <button
                  onClick={handleSave}
                  className="rounded-md bg-accent px-2.5 py-1 text-body-sm font-medium text-white hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowSaveInput(false);
                    setSaveName('');
                  }}
                  className="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                disabled={!hasState}
                className="w-full flex items-center gap-2 rounded-md border border-dashed border-accent/30 bg-accent/[0.02] px-3 py-2 text-body-sm font-medium text-accent hover:bg-accent/[0.06] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="h-3.5 w-3.5" />
                Save current view
              </button>
            )}
          </div>

          {/* View list */}
          <div className="max-h-56 overflow-y-auto">
            {!mounted ? (
              <div className="px-3 py-6 text-center text-body-sm text-text-muted">
                Loading…
              </div>
            ) : views.length === 0 ? (
              <div className="px-3 py-6 text-center text-body-sm text-text-muted">
                No saved views yet
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {views.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent/[0.03] transition-colors group"
                  >
                    <button
                      onClick={() => {
                        onLoad(view);
                        setOpen(false);
                      }}
                      className="flex-1 text-left min-w-0 cursor-pointer"
                    >
                      <p className="text-body-sm font-medium text-text-primary truncate">
                        {view.name}
                      </p>
                      <p className="text-caption text-text-muted truncate">
                        {view.viewType} · {formatRelative(view.savedAt, 'Just now')}
                      </p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(view.id);
                      }}
                      className="p-1 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
