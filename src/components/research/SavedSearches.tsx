'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  ChevronDown,
  Clock,
  Search,
  Star,
  Trash2,
  X,
  Pencil,
  Check,
} from 'lucide-react';
import { cn, formatRelative } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: {
    minDifficulty: number;
    maxDifficulty: number;
    minVolume: number;
    maxVolume: number;
    intents: string[];
  };
  savedAt: number;
}

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount: number;
}

export interface SavedSearchesState {
  history: SearchHistoryItem[];
  saved: SavedSearch[];
}

// ── localStorage keys ────────────────────────────────────────────────────────

const HISTORY_KEY = 'kw-research-search-history';
const SAVED_KEY = 'kw-research-saved-searches';
const MAX_HISTORY = 20;
const MAX_SAVED = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSavedSearches() {
  const [state, setState] = useState<SavedSearchesState>({ history: [], saved: [] });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setState({
      history: loadFromStorage<SearchHistoryItem[]>(HISTORY_KEY, []),
      saved: loadFromStorage<SavedSearch[]>(SAVED_KEY, []),
    });
    setMounted(true);
  }, []);

  const addToHistory = useCallback((item: Omit<SearchHistoryItem, 'timestamp'>) => {
    setState((prev) => {
      const entry: SearchHistoryItem = { ...item, timestamp: Date.now() };
      // Remove duplicate queries, keep most recent
      const filtered = prev.history.filter((h) => h.query !== item.query);
      const next = [entry, ...filtered].slice(0, MAX_HISTORY);
      saveToStorage(HISTORY_KEY, next);
      return { ...prev, history: next };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setState((prev) => ({ ...prev, history: [] }));
    saveToStorage(HISTORY_KEY, []);
  }, []);

  const saveSearch = useCallback(
    (
      name: string,
      query: string,
      filters: SavedSearch['filters'],
    ): SavedSearch => {
      const entry: SavedSearch = {
        id: generateId(),
        name: name.trim() || query,
        query,
        filters,
        savedAt: Date.now(),
      };
      setState((prev) => {
        const next = [entry, ...prev.saved].slice(0, MAX_SAVED);
        saveToStorage(SAVED_KEY, next);
        return { ...prev, saved: next };
      });
      return entry;
    },
    [],
  );

  const deleteSavedSearch = useCallback((id: string) => {
    setState((prev) => {
      const next = prev.saved.filter((s) => s.id !== id);
      saveToStorage(SAVED_KEY, next);
      return { ...prev, saved: next };
    });
  }, []);

  const renameSavedSearch = useCallback((id: string, newName: string) => {
    setState((prev) => {
      const next = prev.saved.map((s) =>
        s.id === id ? { ...s, name: newName.trim() || s.query } : s,
      );
      saveToStorage(SAVED_KEY, next);
      return { ...prev, saved: next };
    });
  }, []);

  return {
    ...state,
    mounted,
    addToHistory,
    clearHistory,
    saveSearch,
    deleteSavedSearch,
    renameSavedSearch,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export interface SavedSearchesProps {
  open: boolean;
  onClose: () => void;
  history: SearchHistoryItem[];
  saved: SavedSearch[];
  onHistoryClick: (item: SearchHistoryItem) => void;
  onSavedClick: (item: SavedSearch) => void;
  onClearHistory: () => void;
  onDeleteSaved: (id: string) => void;
  onRenameSaved: (id: string, newName: string) => void;
  onSaveCurrent: (name: string) => void;
  currentQuery: string;
  currentFilters: SavedSearch['filters'];
  mounted: boolean;
  /** External trigger for save dialog (e.g., Ctrl+Shift+S) */
  triggerSave?: boolean;
  onSaveDialogHandled?: () => void;
}

export default function SavedSearches({
  open,
  onClose,
  history,
  saved,
  onHistoryClick,
  onSavedClick,
  onClearHistory,
  onDeleteSaved,
  onRenameSaved,
  onSaveCurrent,
  currentQuery,
  currentFilters,
  mounted,
  triggerSave,
  onSaveDialogHandled,
}: SavedSearchesProps) {
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Handle external trigger for save dialog
  useEffect(() => {
    if (triggerSave && open) {
      setShowSaveDialog(true);
      onSaveDialogHandled?.();
    }
  }, [triggerSave, open, onSaveDialogHandled]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (renamingId) {
          setRenamingId(null);
          return;
        }
        if (showSaveDialog) {
          setShowSaveDialog(false);
          return;
        }
        onClose();
      }
      if (e.key === 'Enter' && showSaveDialog) {
        const name = saveName.trim() || currentQuery;
        onSaveCurrent(name);
        setSaveName('');
        setShowSaveDialog(false);
        setActiveTab('saved');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, showSaveDialog, saveName, currentQuery, onSaveCurrent, onClose, renamingId]);

  // Focus save input when dialog opens
  useEffect(() => {
    if (showSaveDialog && saveInputRef.current) {
      saveInputRef.current.focus();
    }
  }, [showSaveDialog]);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent immediate close on the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  // Stop body scroll when open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const handleSaveSubmit = useCallback(() => {
    const name = saveName.trim() || currentQuery;
    onSaveCurrent(name);
    setSaveName('');
    setShowSaveDialog(false);
    setActiveTab('saved');
  }, [saveName, currentQuery, onSaveCurrent]);

  const handleRenameSubmit = useCallback(
    (id: string) => {
      const newName = renameValue.trim();
      if (newName) {
        onRenameSaved(id, newName);
      }
      setRenamingId(null);
      setRenameValue('');
    },
    [renameValue, onRenameSaved],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 z-50 h-full max-h-screen w-full max-w-md overflow-hidden border-l border-border/50 bg-surface shadow-elevation-3 animate-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Bookmark className="h-5 w-5 text-accent" />
            <div>
              <h2 className="text-heading-2 text-text-primary">Saved Searches</h2>
              <p className="text-caption text-text-muted">
                Access your recent and saved searches
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-inset hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50">
          <button
            onClick={() => setActiveTab('recent')}
            className={cn(
              'flex-1 py-3 text-body-sm font-semibold text-center transition-colors cursor-pointer',
              activeTab === 'recent'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-primary border-b-2 border-transparent',
            )}
          >
            <Clock className="h-3.5 w-3.5 inline mr-1.5" />
            Recent
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={cn(
              'flex-1 py-3 text-body-sm font-semibold text-center transition-colors cursor-pointer',
              activeTab === 'saved'
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-primary border-b-2 border-transparent',
            )}
          >
            <Star className="h-3.5 w-3.5 inline mr-1.5" />
            Saved
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-180px)]">
          {/* Save dialog banner */}
          {showSaveDialog && (
            <div className="border-b border-border/50 bg-accent/[0.03] px-5 py-3">
              <p className="text-caption text-text-muted mb-2">
                Save current search: <span className="font-medium text-text-primary">{currentQuery}</span>
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={saveInputRef}
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Give this search a name…"
                  className="flex-1 rounded-lg border border-border/50 bg-surface-raised px-3 py-2 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveSubmit();
                    if (e.key === 'Escape') {
                      setShowSaveDialog(false);
                      setSaveName('');
                    }
                  }}
                />
                <button
                  onClick={handleSaveSubmit}
                  disabled={!currentQuery}
                  className="rounded-lg bg-accent px-3 py-2 text-body-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setSaveName('');
                  }}
                  className="rounded-lg p-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Recent tab */}
          {activeTab === 'recent' && (
            <div>
              {history.length > 0 && (
                <div className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-caption text-text-muted">
                    {history.length} recent search{history.length !== 1 ? 'es' : ''}
                  </span>
                  <button
                    onClick={onClearHistory}
                    className="text-caption text-text-muted hover:text-red-500 transition-colors cursor-pointer"
                  >
                    Clear history
                  </button>
                </div>
              )}
              {!mounted ? (
                <div className="px-5 py-8 text-center text-body-sm text-text-muted">
                  Loading…
                </div>
              ) : history.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Clock className="h-8 w-8 text-text-muted/40 mx-auto mb-3" />
                  <p className="text-body font-medium text-text-primary">No recent searches</p>
                  <p className="mt-1 text-body-sm text-text-muted">
                    Your recent searches will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {history.map((item, i) => (
                    <button
                      key={`${item.query}-${item.timestamp}-${i}`}
                      onClick={() => onHistoryClick(item)}
                      className="w-full text-left px-5 py-3 hover:bg-accent/[0.03] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 text-text-muted mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-body-sm font-medium text-text-primary truncate">
                            {item.query}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-caption text-text-muted">
                              {formatRelative(item.timestamp, 'Just now')}
                            </span>
                            <span className="text-caption text-text-muted">·</span>
                            <span className="text-caption text-text-muted">
                              {item.resultCount.toLocaleString()} results
                            </span>
                          </div>
                        </div>
                        <Search className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Saved tab */}
          {activeTab === 'saved' && (
            <div>
              {/* Save current button */}
              {currentQuery && (
                <div className="px-5 py-3 border-b border-border/50">
                  <button
                    onClick={() => {
                      setSaveName('');
                      setShowSaveDialog(true);
                    }}
                    disabled={!currentQuery}
                    className="w-full flex items-center gap-2 rounded-lg border border-dashed border-accent/30 bg-accent/[0.02] px-4 py-2.5 text-body-sm font-medium text-accent hover:bg-accent/[0.06] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Bookmark className="h-4 w-4" />
                    Save current search &ldquo;{currentQuery}&rdquo;
                  </button>
                </div>
              )}
              {!mounted ? (
                <div className="px-5 py-8 text-center text-body-sm text-text-muted">
                  Loading…
                </div>
              ) : saved.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Star className="h-8 w-8 text-text-muted/40 mx-auto mb-3" />
                  <p className="text-body font-medium text-text-primary">No saved searches</p>
                  <p className="mt-1 text-body-sm text-text-muted">
                    Save your important searches for quick access later.
                  </p>
                  {currentQuery && (
                    <button
                      onClick={() => setShowSaveDialog(true)}
                      disabled={!currentQuery}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-body-sm font-medium text-white hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Star className="h-3.5 w-3.5" />
                      Save this search
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {saved.map((item) => (
                    <div
                      key={item.id}
                      className="px-5 py-3 hover:bg-accent/[0.03] transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <Star className="h-4 w-4 text-amber-400 fill-amber-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          {renamingId === item.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                ref={renameInputRef}
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="flex-1 rounded-md border border-accent/30 bg-surface-raised px-2 py-1 text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameSubmit(item.id);
                                  if (e.key === 'Escape') setRenamingId(null);
                                }}
                                onBlur={() => handleRenameSubmit(item.id)}
                              />
                              <button
                                onClick={() => handleRenameSubmit(item.id)}
                                className="p-1 text-accent hover:bg-accent/10 rounded transition-colors cursor-pointer"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => onSavedClick(item)}
                              className="text-left w-full cursor-pointer"
                            >
                              <p className="text-body-sm font-medium text-text-primary truncate">
                                {item.name}
                              </p>
                            </button>
                          )}
                          <button
                            onClick={() => onSavedClick(item)}
                            className="text-left w-full cursor-pointer mt-0.5"
                          >
                            <p className="text-caption text-text-muted truncate">
                              {item.query}
                            </p>
                          </button>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-caption text-text-muted">
                              {formatRelative(item.savedAt, 'Just now')}
                            </span>
                            {(item.filters.minDifficulty > 0 ||
                              item.filters.maxDifficulty < 100 ||
                              item.filters.minVolume > 0 ||
                              item.filters.intents.length > 0) && (
                              <>
                                <span className="text-caption text-text-muted">·</span>
                                <span className="text-caption text-accent">
                                  {[
                                    item.filters.minDifficulty > 0 ? `KD≥${item.filters.minDifficulty}` : null,
                                    item.filters.maxDifficulty < 100 ? `KD≤${item.filters.maxDifficulty}` : null,
                                    item.filters.minVolume > 0 ? `Vol≥${item.filters.minVolume}` : null,
                                    item.filters.intents.length > 0
                                      ? `${item.filters.intents.length} intent${item.filters.intents.length !== 1 ? 's' : ''}`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(item.id);
                              setRenameValue(item.name);
                            }}
                            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-inset rounded transition-colors cursor-pointer"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSaved(item.id);
                            }}
                            className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with keyboard shortcut hint */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border/50 bg-surface-raised/80 backdrop-blur-sm px-5 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-muted">
              <kbd className="px-1.5 py-0.5 rounded border border-border/50 bg-surface-inset text-caption font-mono">Ctrl+Shift+S</kbd> to save search
            </span>
            <span className="text-caption text-text-muted">
              ESC to close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
