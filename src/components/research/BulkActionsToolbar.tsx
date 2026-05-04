'use client';

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CheckSquare,
  FileDown,
  FileText,
  Layers,
  ListPlus,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

export type BulkAction =
  | 'add-to-list'
  | 'export-csv'
  | 'generate-brief'
  | 'cluster-selected'
  | 'clear-selection'
  | 'select-all';

export interface BulkActionsToolbarProps {
  /** Number of currently selected items */
  selectedCount: number;
  /** Total number of visible/selectable items */
  totalCount: number;
  /** Whether all visible items are selected */
  allSelected: boolean;
  /** Called when user clicks "Select All" */
  onSelectAll: () => void;
  /** Called when user triggers an action */
  onAction: (action: BulkAction) => void;
  /** Called when user dismisses the toolbar (Escape or X) */
  onDismiss: () => void;
  /** Whether an action is currently processing */
  processingAction?: BulkAction | null;
  /** Custom class for the container */
  className?: string;
}

/* ─────────────────────────────────────────────
   Component
   ───────────────────────────────────────────── */

export default function BulkActionsToolbar({
  selectedCount,
  totalCount,
  allSelected,
  onSelectAll,
  onAction,
  onDismiss,
  processingAction = null,
  className,
}: BulkActionsToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  /* ── Show/hide with animation ── */
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (selectedCount > 0) {
      setExiting(false);
      // Small delay to ensure the initial render has the off-screen transform
      timeout = setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
      // Wait for exit animation
      timeout = setTimeout(() => setExiting(true), 300);
    }
    return () => clearTimeout(timeout);
  }, [selectedCount]);

  /* ── Escape key handler ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCount > 0) {
        onDismiss();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedCount, onDismiss]);

  /* ── Don't render if hidden and exiting ── */
  if (selectedCount === 0 && exiting) return null;

  const isProcessing = processingAction !== null;

  return (
    <>
      {/* Backdrop overlay on mobile to prevent interactions below */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 md:hidden',
          visible && selectedCount > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onDismiss}
      />

      {/* Toolbar */}
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Bulk actions"
        className={cn(
          // Base positioning
          'fixed bottom-0 left-0 right-0 z-50',
          // Slide-up animation
          'transition-transform duration-300 ease-out',
          visible && selectedCount > 0
            ? 'translate-y-0'
            : 'translate-y-full',
          // Desktop: centered floating bar
          'md:bottom-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-max',
          // Mobile: full-width bottom sheet
          className,
        )}
      >
        <div
          className={cn(
            // Styling
            'flex items-center gap-3',
            'border border-border/60',
            'bg-surface shadow-elevation-3',
            // Desktop
            'md:rounded-xl md:px-4 md:py-3 md:gap-3',
            // Mobile
            'rounded-t-xl px-3 py-3 gap-2',
            // Processing state
            isProcessing && 'opacity-90',
          )}
        >
          {/* ── Selection count ── */}
          <div className="flex items-center gap-2 shrink-0">
            <CheckSquare className="h-4 w-4 text-accent hidden sm:block" />
            <span className="text-body-sm font-semibold text-text-primary whitespace-nowrap">
              <span className="text-accent">{selectedCount}</span>
              <span className="hidden sm:inline"> selected</span>
            </span>
          </div>

          {/* ── Select All hint ── */}
          {!allSelected && selectedCount < totalCount && (
            <button
              type="button"
              className="text-caption text-text-muted hover:text-accent transition-colors whitespace-nowrap hidden sm:block"
              onClick={onSelectAll}
            >
              Select all {totalCount}
            </button>
          )}
          {allSelected && totalCount > selectedCount && (
            <span className="text-caption text-text-muted whitespace-nowrap hidden sm:block">
              All {totalCount} selected
            </span>
          )}

          {/* ── Spacer ── */}
          <div className="flex-1 md:hidden" />

          {/* ── Action buttons ── */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <ToolbarButton
              icon={<ListPlus className="h-4 w-4" />}
              label="Add to List"
              mobileLabel="List"
              processing={processingAction === 'add-to-list'}
              disabled={isProcessing}
              onClick={() => onAction('add-to-list')}
            />
            <ToolbarButton
              icon={<FileDown className="h-4 w-4" />}
              label="Export CSV"
              mobileLabel="CSV"
              processing={processingAction === 'export-csv'}
              disabled={isProcessing}
              onClick={() => onAction('export-csv')}
            />
            <ToolbarButton
              icon={<FileText className="h-4 w-4" />}
              label="Generate Brief"
              mobileLabel="Brief"
              processing={processingAction === 'generate-brief'}
              disabled={isProcessing}
              onClick={() => onAction('generate-brief')}
              variant="accent"
            />
            <ToolbarButton
              icon={<Layers className="h-4 w-4" />}
              label="Cluster"
              mobileLabel="Cluster"
              processing={processingAction === 'cluster-selected'}
              disabled={isProcessing}
              onClick={() => onAction('cluster-selected')}
              variant="accent"
            />
            {!allSelected && (
              <ToolbarButton
                icon={<CheckSquare className="h-4 w-4" />}
                label="Select All"
                mobileLabel="All"
                disabled={isProcessing}
                onClick={onSelectAll}
                variant="ghost"
              />
            )}
          </div>

          {/* ── Divider ── */}
          <div className="w-px h-6 bg-border/30 hidden sm:block" />

          {/* ── Dismiss button ── */}
          <button
            type="button"
            className={cn(
              'rounded-lg p-1.5 transition-colors flex items-center justify-center',
              'text-text-muted hover:text-text-primary hover:bg-surface-inset',
              'sm:p-1.5',
            )}
            onClick={onDismiss}
            title="Clear selection (Escape)"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   Toolbar Button (responsive label)
   ───────────────────────────────────────────── */

function ToolbarButton({
  icon,
  label,
  mobileLabel,
  processing = false,
  disabled = false,
  onClick,
  variant = 'default',
}: {
  icon: ReactNode;
  label: string;
  mobileLabel?: string;
  processing?: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant?: 'default' | 'accent' | 'ghost';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // Base styles
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5',
        'text-caption font-medium transition-colors',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        // Mobile: icon-only with smaller padding
        'sm:px-2.5 sm:py-1.5',
        // Variant
        variant === 'accent'
          ? 'bg-accent/[0.08] text-accent hover:bg-accent/[0.14] border border-accent/10'
          : variant === 'ghost'
            ? 'text-text-muted hover:text-text-primary hover:bg-surface-inset'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-inset border border-border/30',
      )}
      title={label}
    >
      {processing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        icon
      )}
      {/* Label: hidden on mobile unless mobileLabel is provided, always shows on sm+ */}
      <span className="hidden sm:inline">{label}</span>
      {mobileLabel && <span className="sm:hidden">{mobileLabel}</span>}
    </button>
  );
}
