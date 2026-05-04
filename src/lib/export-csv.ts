/**
 * Enhanced CSV export utility for keyword research data.
 *
 * Features:
 * - All available columns (keyword, volume, difficulty, CPC, intent, SERP features, etc.)
 * - Proper CSV escaping for values containing commas, quotes, or newlines
 * - UTF-8 BOM for Excel compatibility (auto-detects UTF-8 with BOM)
 * - Date-stamped filename
 * - Blob-based download (no popup blocker issues)
 */

import type { ResearchRow } from '@/lib/research';

/* ─────────────────────────────────────────────
   Column definitions
   ───────────────────────────────────────────── */

export interface ExportColumn {
  id: string;
  label: string;
  getValue: (row: ResearchRow) => string;
}

/**
 * All available export columns — add new columns here to include them.
 * Order matters: first column listed comes first in the CSV.
 */
const ALL_EXPORT_COLUMNS: ExportColumn[] = [
  { id: 'primaryKeyword', label: 'Keyword', getValue: (r) => r.primaryKeyword ?? '' },
  { id: 'searchVolume', label: 'Volume', getValue: (r) => (r.searchVolume != null ? String(r.searchVolume) : '') },
  { id: 'trafficPotential', label: 'Traffic Pot.', getValue: (r) => (r.trafficPotential != null ? String(r.trafficPotential) : '') },
  { id: 'difficulty', label: 'Difficulty', getValue: (r) => (r.difficulty != null ? String(r.difficulty) : '') },
  { id: 'cpc', label: 'CPC', getValue: (r) => (r.cpc != null ? r.cpc.toFixed(2) : '') },
  { id: 'intent', label: 'Intent', getValue: (r) => r.intent ?? '' },
  { id: 'pillar', label: 'Pillar', getValue: (r) => r.pillar ?? '' },
  { id: 'cluster', label: 'Cluster', getValue: (r) => r.cluster ?? '' },
  { id: 'keywords', label: 'Keywords', getValue: (r) => (r.keywords ?? []).join('; ') },
  { id: 'existingParentPage', label: 'Parent Page', getValue: (r) => r.existingParentPage ?? '' },
  { id: 'existingParentPageUrl', label: 'Parent Page URL', getValue: (r) => r.existingParentPageUrl ?? '' },
  { id: 'rowType', label: 'Row Type', getValue: (r) => r.rowType ?? '' },
  { id: 'slugPath', label: 'Slug Path', getValue: (r) => r.slugPath ?? '' },
  { id: 'notes', label: 'Notes', getValue: (r) => (r.notes ?? []).join('; ') },
];

/* ─────────────────────────────────────────────
   CSV escaping
   ───────────────────────────────────────────── */

/**
 * Escape a single CSV field value.
 * - Wraps in double quotes if the value contains commas, double quotes, or newlines
 * - Escapes embedded double quotes by doubling them (RFC 4180)
 */
export function escapeCsvField(value: string): string {
  if (!value) return '""';

  const needsQuoting = value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r');

  if (!needsQuoting) {
    // Even numeric-like values are fine without quotes
    return value;
  }

  // Double up any embedded quotes, then wrap in quotes
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Convert an array of ResearchRow objects to a CSV string.
 * Includes UTF-8 BOM for Excel compatibility.
 */
export function rowsToCsv(rows: ResearchRow[], columns?: ExportColumn[]): string {
  const cols = columns ?? ALL_EXPORT_COLUMNS;

  // Build header row
  const header = cols.map((col) => escapeCsvField(col.label)).join(',');

  // Build data rows
  const dataRows = rows.map((row) =>
    cols.map((col) => escapeCsvField(col.getValue(row))).join(','),
  );

  // UTF-8 BOM (byte order mark) so Excel recognises the encoding
  const BOM = '\uFEFF';

  return BOM + [header, ...dataRows].join('\n');
}

/**
 * Generate a date-stamped filename for CSV exports.
 */
export function generateExportFilename(stem = 'keyword-research-export'): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${stem}-${date}.csv`;
}

/**
 * Trigger a CSV file download via a temporary Blob URL.
 * Handles cleanup automatically.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  // Create a Blob with proper MIME type and charset
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create a temporary URL
  const url = URL.createObjectURL(blob);

  // Create a hidden anchor element to trigger download
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * All-in-one: convert rows to CSV and trigger download.
 */
export function exportKeywordsToCsv(rows: ResearchRow[], filename?: string): void {
  const csv = rowsToCsv(rows);
  downloadCsv(csv, filename ?? generateExportFilename());
}

/**
 * Export selected columns only (useful for custom exports).
 */
export function exportKeywordsToCsvColumns(
  rows: ResearchRow[],
  columns: ExportColumn[],
  filename?: string,
): void {
  const csv = rowsToCsv(rows, columns);
  downloadCsv(csv, filename ?? generateExportFilename());
}
