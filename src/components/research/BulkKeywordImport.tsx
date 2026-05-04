'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  PlusCircle,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

type ImportKeyword = {
  keyword: string;
  volume?: number | null;
  difficulty?: number | null;
};

type PreviewKeyword = ImportKeyword & {
  isDuplicate: boolean;
  hasData: boolean;
};

type ImportState = 'idle' | 'parsing' | 'preview' | 'processing' | 'complete';

type ImportResult = {
  imported: number;
  skipped: number;
  updated: number;
};

type EnrichmentProgress = {
  total: number;
  completed: number;
};

interface BulkKeywordImportProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Existing keywords in the current workspace (for deduplication) */
  existingKeywords?: string[];
}

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */

const MAX_KEYWORDS = 500;
const ENRICH_BATCH_SIZE = 50;

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function parsePastedText(text: string): ImportKeyword[] {
  const lines = text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Check for tab/comma-separated: keyword \t volume \t difficulty
      const parts = line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      if (parts.length >= 3) {
        const vol = parseFloat(parts[1].replace(/[",]/g, ''));
        const diff = parseFloat(parts[2].replace(/[",]/g, ''));
        return {
          keyword: parts[0].replace(/^"|"$/g, '').trim(),
          volume: Number.isFinite(vol) ? vol : undefined,
          difficulty: Number.isFinite(diff) ? diff : undefined,
        };
      }
      if (parts.length === 2) {
        const vol = parseFloat(parts[1].replace(/[",]/g, ''));
        return {
          keyword: parts[0].replace(/^"|"$/g, '').trim(),
          volume: Number.isFinite(vol) ? vol : undefined,
        };
      }
      return { keyword: line };
    })
    .filter((k) => k.keyword.length > 0);

  // Deduplicate by keyword within the pasted list
  const seen = new Set<string>();
  return lines.filter((k) => {
    const lower = k.keyword.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

function parseCSVText(text: string): ImportKeyword[] {
  // Simple CSV parser — handles quoted fields
  const rows: string[][] = [];
  const lines = text.split(/[\r\n]+/).filter(Boolean);
  if (lines.length === 0) return [];

  for (const line of lines) {
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  if (rows.length < 2) return [];

  // Detect header row
  const header = rows[0].map((h) => h.toLowerCase().replace(/^"|"$/g, ''));
  const keywordIdx = header.findIndex((h) => h === 'keyword' || h === 'query' || h === 'term' || h === 'keywords');
  const volumeIdx = header.findIndex((h) => h === 'volume' || h === 'search_volume' || h === 'searchvolume' || h === 'monthly searches');
  const difficultyIdx = header.findIndex((h) => h === 'difficulty' || h === 'kd' || h === 'seo difficulty' || h === 'keyword difficulty');

  // If no header found, treat first row as data (check if it looks like header)
  const startRow = keywordIdx >= 0 ? 1 : 0;
  const useIdx = {
    keyword: keywordIdx >= 0 ? keywordIdx : 0,
    volume: volumeIdx >= 0 ? volumeIdx : -1,
    difficulty: difficultyIdx >= 0 ? difficultyIdx : -1,
  };

  const dataRows = rows.slice(startRow);
  const result: ImportKeyword[] = [];
  const seen = new Set<string>();

  for (const row of dataRows) {
    const kw = (row[useIdx.keyword] || '').replace(/^"|"$/g, '').trim();
    if (!kw) continue;

    const lower = kw.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    const item: ImportKeyword = { keyword: kw };

    if (useIdx.volume >= 0 && row[useIdx.volume]) {
      const vol = parseFloat(String(row[useIdx.volume]).replace(/[",$£€]/g, ''));
      if (Number.isFinite(vol) && vol >= 0) item.volume = vol;
    }

    if (useIdx.difficulty >= 0 && row[useIdx.difficulty]) {
      const diff = parseFloat(String(row[useIdx.difficulty]).replace(/[",]/g, ''));
      if (Number.isFinite(diff) && diff >= 0 && diff <= 100) item.difficulty = diff;
    }

    result.push(item);
  }

  return result;
}

function formatVolume(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function formatDifficulty(n: number | null | undefined): string {
  if (n == null) return '—';
  return String(n);
}

/* ─────────────────────────────────────────────
   Component
   ───────────────────────────────────────────── */

export default function BulkKeywordImport({
  open,
  onClose,
  projectId,
  existingKeywords = [],
}: BulkKeywordImportProps) {
  /* ── Tabs ── */
  const [importMethod, setImportMethod] = useState<'paste' | 'csv'>('paste');

  /* ── Paste state ── */
  const [pasteText, setPasteText] = useState('');

  /* ── CSV state ── */
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Import flow state ── */
  const [importState, setImportState] = useState<ImportState>('idle');
  const [previewKeywords, setPreviewKeywords] = useState<PreviewKeyword[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState<EnrichmentProgress | null>(null);

  const [isProcessing, startProcessing] = useTransition();

  /* ── Normalize existing keywords to lower case for comparison ── */
  const existingLower = useMemo(
    () => new Set(existingKeywords.map((k) => k.toLowerCase())),
    [existingKeywords],
  );

  /* ── Keyword count ── */
  const keywordCount = previewKeywords.length;
  const overLimit = keywordCount > MAX_KEYWORDS;
  const duplicateCount = previewKeywords.filter((k) => k.isDuplicate).length;
  const newCount = previewKeywords.filter((k) => !k.isDuplicate).length;
  const needsEnrichment = previewKeywords.filter(
    (k) => !k.isDuplicate && (k.volume == null || k.difficulty == null),
  ).length;

  /* ── Process paste text ── */
  const processPaste = useCallback(() => {
    setErrorMessage(null);

    if (!pasteText.trim()) {
      return;
    }

    const parsed = parsePastedText(pasteText);

    if (parsed.length === 0) {
      setErrorMessage('No valid keywords found. Enter one keyword per line.');
      return;
    }

    const preview: PreviewKeyword[] = parsed.map((k) => ({
      ...k,
      isDuplicate: existingLower.has(k.keyword.toLowerCase()),
      hasData: k.volume != null || k.difficulty != null,
    }));

    setPreviewKeywords(preview);
    setImportState('preview');
  }, [pasteText, existingLower]);

  /* ── Process CSV file ── */
  const processCSV = useCallback(async () => {
    setErrorMessage(null);

    if (!csvFile) {
      return;
    }

    setImportState('parsing');

    try {
      const text = await csvFile.text();
      const parsed = parseCSVText(text);

      if (parsed.length === 0) {
        setErrorMessage('No valid keywords found in the CSV. Expected a "keyword" column.');
        setImportState('idle');
        return;
      }

      const preview: PreviewKeyword[] = parsed.map((k) => ({
        ...k,
        isDuplicate: existingLower.has(k.keyword.toLowerCase()),
        hasData: k.volume != null || k.difficulty != null,
      }));

      setPreviewKeywords(preview);
      setImportState('preview');
    } catch {
      setErrorMessage('Failed to parse CSV file. Check the file format.');
      setImportState('idle');
    }
  }, [csvFile, existingLower]);

  /* ── Enrich keywords via Claude AI ── */
  const enrichKeywords = useCallback(
    async (keywords: ImportKeyword[]): Promise<ImportKeyword[]> => {
      const toEnrich = keywords.filter(
        (k) => k.volume == null || k.difficulty == null,
      );

      if (toEnrich.length === 0) return keywords;

      setEnrichmentProgress({ total: toEnrich.length, completed: 0 });

      // Batch up to ENRICH_BATCH_SIZE per call
      const batches: ImportKeyword[][] = [];
      for (let i = 0; i < toEnrich.length; i += ENRICH_BATCH_SIZE) {
        batches.push(toEnrich.slice(i, i + ENRICH_BATCH_SIZE));
      }

      let enrichedCount = 0;
      const enrichmentMap = new Map<string, { volume?: number; difficulty?: number }>();

      for (const batch of batches) {
        try {
          const response = await fetch('/api/keywords/enrich', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              keywords: batch.map((k) => k.keyword),
              projectId,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.enriched && Array.isArray(data.enriched)) {
              for (const item of data.enriched) {
                if (item.keyword && (item.searchVolume != null || item.difficulty != null)) {
                  enrichmentMap.set(item.keyword.toLowerCase(), {
                    volume: item.searchVolume ?? undefined,
                    difficulty: item.difficulty ?? undefined,
                  });
                }
              }
            }
          }
        } catch {
          // Enrichment is best-effort; continue without enriched data
        }

        enrichedCount += batch.length;
        setEnrichmentProgress({ total: toEnrich.length, completed: enrichedCount });
      }

      setEnrichmentProgress(null);

      // Merge enriched data back
      return keywords.map((k) => {
        const enriched = enrichmentMap.get(k.keyword.toLowerCase());
        if (!enriched) return k;
        return {
          ...k,
          volume: k.volume ?? enriched.volume,
          difficulty: k.difficulty ?? enriched.difficulty,
        };
      });
    },
    [projectId],
  );

  /* ── Execute import ── */
  const executeImport = useCallback(async () => {
    if (keywordCount === 0) return;

    setImportState('processing');
    setErrorMessage(null);

    try {
      // First enrich keywords that are missing data
      let toImport: { keyword: string; volume?: number | null; difficulty?: number | null }[] = previewKeywords
        .filter((k) => duplicateStrategy === 'skip' ? !k.isDuplicate : true)
        .map(({ keyword, volume, difficulty }) => ({ keyword, volume, difficulty }));

      // Enrich if needed
      if (duplicateStrategy !== 'update') {
        toImport = await enrichKeywords(toImport);
      }

      const response = await fetch('/api/keywords/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          keywords: toImport,
          duplicateStrategy,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Import failed.');
      }

      setImportResult(result);
      setImportState('complete');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Import failed.');
      setImportState('preview');
    }
  }, [previewKeywords, duplicateStrategy, projectId, keywordCount, enrichKeywords]);

  /* ── Reset on close ── */
  const handleClose = useCallback(() => {
    setImportState('idle');
    setPasteText('');
    setCsvFile(null);
    setPreviewKeywords([]);
    setImportResult(null);
    setErrorMessage(null);
    setEnrichmentProgress(null);
    setImportMethod('paste');
    onClose();
  }, [onClose]);

  /* ── CSV file dropped ── */
  const [isDragging, setIsDragging] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-background/[0.78] backdrop-blur-xl animate-fade-in"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border/60 bg-surface shadow-elevation-3 animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-xl border-b border-border/40 bg-surface/90 px-6 py-4 backdrop-blur-lg">
          <div>
            <h3 className="text-heading-2 text-text-primary flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-accent" />
              Import Keywords
            </h3>
            <p className="mt-0.5 text-body-sm text-text-secondary">
              Paste keywords or upload a CSV file. Max {MAX_KEYWORDS} keywords per import.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-muted transition-all hover:border-border/60 hover:bg-surface-raised hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {/* ── Step 1: Input ── */}
          {importState === 'idle' && (
            <>
              {/* Method tabs */}
              <div className="flex rounded-lg border border-border/50 bg-surface-inset/60 p-1">
                {(['paste', 'csv'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => {
                      setImportMethod(method);
                      setErrorMessage(null);
                    }}
                    className={cn(
                      'flex-1 rounded-md px-4 py-2 text-body-sm font-semibold transition-all cursor-pointer',
                      importMethod === method
                        ? 'bg-surface text-accent shadow-elevation-1'
                        : 'text-text-muted hover:bg-surface/50 hover:text-text-primary',
                    )}
                  >
                    {method === 'paste' ? '📝 Paste Keywords' : '📄 Upload CSV'}
                  </button>
                ))}
              </div>

              {importMethod === 'paste' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-body-sm font-semibold text-text-primary">Paste keywords</label>
                    <p className="text-caption text-text-muted">One keyword per line. Optionally add volume and difficulty with tabs: keyword[TAB]volume[TAB]difficulty</p>
                  </div>
                  <textarea
                    className="field-textarea min-h-[200px] resize-y"
                    placeholder={`seo tools\nkeyword research  \t3200\t45\ncontent marketing strategy\nbacklink analysis\t880\t62\nlocal seo services\t1400\t38`}
                    value={pasteText}
                    onChange={(e) => {
                      setPasteText(e.target.value);
                      setErrorMessage(null);
                    }}
                  />
                  {errorMessage && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] px-3 py-2 text-body-sm text-destructive">
                      {errorMessage}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={processPaste}
                    disabled={!pasteText.trim()}
                    className="w-full"
                  >
                    Parse Keywords
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-body-sm font-semibold text-text-primary">Upload CSV file</label>
                    <p className="text-caption text-text-muted">
                      Column detection: &quot;keyword&quot; (required), &quot;volume&quot; (optional), &quot;difficulty&quot; (optional).
                    </p>
                  </div>

                  {/* Drop zone */}
                  <div
                    className={cn(
                      'relative rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer text-center',
                      isDragging
                        ? 'border-accent/40 bg-accent/[0.03]'
                        : 'border-border/60 hover:border-accent/20 hover:bg-surface-raised/50',
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
                        setCsvFile(file);
                        setErrorMessage(null);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {csvFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet className="h-10 w-10 text-accent" />
                        <p className="text-body font-semibold text-text-primary">{csvFile.name}</p>
                        <p className="text-caption text-text-muted">
                          {(csvFile.size / 1024).toFixed(1)} KB &middot; Click to change
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <FileUp className="h-10 w-10 text-text-muted/60" />
                        <p className="text-body font-semibold text-text-primary">Drop CSV file here</p>
                        <p className="text-caption text-text-muted">or click to browse</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCsvFile(file);
                          setErrorMessage(null);
                        }
                      }}
                    />
                  </div>

                  {errorMessage && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] px-3 py-2 text-body-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {errorMessage}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={processCSV}
                    disabled={!csvFile || (importState as string) === 'parsing'}
                    loading={(importState as string) === 'parsing'}
                    className="w-full"
                  >
                    Parse CSV
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Preview ── */}
          {importState === 'preview' && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-surface-raised/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-accent" />
                  <span className="text-body font-semibold text-text-primary">
                    {keywordCount} keyword{keywordCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {newCount > 0 && (
                  <Badge variant="success" dot={false}>
                    {newCount} new
                  </Badge>
                )}
                {duplicateCount > 0 && (
                  <Badge variant="warning" dot={false}>
                    {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}
                  </Badge>
                )}
                {needsEnrichment > 0 && (
                  <Badge variant="info" dot={false}>
                    {needsEnrichment} need{needsEnrichment === 1 ? 's' : ''} enrichment
                  </Badge>
                )}
                {overLimit && (
                  <Badge variant="error" dot={false}>
                    Over {MAX_KEYWORDS} limit
                  </Badge>
                )}
              </div>

              {overLimit && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] px-4 py-3">
                  <p className="text-body-sm font-medium text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Too many keywords ({keywordCount}). Maximum {MAX_KEYWORDS} allowed per import.
                  </p>
                  <p className="mt-1 text-caption text-text-secondary">
                    Remove {keywordCount - MAX_KEYWORDS} keyword{keywordCount - MAX_KEYWORDS !== 1 ? 's' : ''} to proceed.
                  </p>
                </div>
              )}

              {/* Keyword preview table */}
              <div className="overflow-hidden rounded-lg border border-border/50 bg-surface-raised/60">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="min-w-full text-left">
                    <thead className="sticky top-0 z-[5] bg-surface-raised shadow-[0_1px_0_hsl(var(--border)/0.5)]">
                      <tr className="text-text-muted">
                        <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider w-8">#</th>
                        <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider">Keyword</th>
                        <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider text-right">Volume</th>
                        <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider text-right">
                          Difficulty
                        </th>
                        <th className="px-3 py-2.5 text-caption font-semibold uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {previewKeywords.map((kw, idx) => (
                        <tr
                          key={kw.keyword}
                          className={cn(
                            'text-body-sm transition-colors hover:bg-accent/[0.03]',
                            idx % 2 === 1 && 'bg-surface-inset/30',
                            kw.isDuplicate && 'bg-warning/[0.04]',
                          )}
                        >
                          <td className="px-3 py-2 text-text-muted tabular-nums">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'font-medium',
                                kw.isDuplicate ? 'text-warning' : 'text-text-primary',
                              )}
                            >
                              {kw.keyword}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">
                            {formatVolume(kw.volume)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-text-secondary">
                            {formatDifficulty(kw.difficulty)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {kw.isDuplicate ? (
                              <Badge variant="warning" dot={true}>
                                Duplicate
                              </Badge>
                            ) : kw.volume == null && kw.difficulty == null ? (
                              <Badge variant="info" dot={true}>
                                Needs data
                              </Badge>
                            ) : kw.volume != null && kw.difficulty != null ? (
                              <Badge variant="success" dot={true}>
                                Complete
                              </Badge>
                            ) : (
                              <Badge variant="neutral" dot={true}>
                                Partial
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Duplicate handling */}
              {duplicateCount > 0 && (
                <div className="rounded-lg border border-warning/20 bg-warning/[0.03] p-4 space-y-3">
                  <p className="text-body-sm font-semibold text-text-primary flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} detected
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="duplicateStrategy"
                        value="skip"
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                        className="h-4 w-4 accent-accent"
                      />
                      <span className="text-body-sm text-text-primary">
                        <span className="font-medium">Skip duplicates</span>
                        <span className="ml-1 text-text-muted">— only import new keywords ({newCount})</span>
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="duplicateStrategy"
                        value="update"
                        checked={duplicateStrategy === 'update'}
                        onChange={() => setDuplicateStrategy('update')}
                        className="h-4 w-4 accent-accent"
                      />
                      <span className="text-body-sm text-text-primary">
                        <span className="font-medium">Update existing</span>
                        <span className="ml-1 text-text-muted">— overwrite with new data ({keywordCount})</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setImportState('idle');
                    setPreviewKeywords([]);
                    setErrorMessage(null);
                  }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  icon={<UploadCloud className="h-4 w-4" />}
                  onClick={executeImport}
                  disabled={overLimit || keywordCount === 0}
                >
                  Import
                  {needsEnrichment > 0 ? ` (${needsEnrichment} will be enriched)` : ''}
                  {duplicateStrategy === 'skip' && duplicateCount > 0
                    ? ` — ${newCount} new`
                    : ` — ${keywordCount}`}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Processing ── */}
          {importState === 'processing' && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-accent" />
              <div className="text-center">
                <p className="text-heading-2 text-text-primary">
                  {enrichmentProgress
                    ? 'Enriching keywords...'
                    : 'Importing keywords...'}
                </p>
                <p className="mt-1 text-body-sm text-text-secondary">
                  {enrichmentProgress
                    ? `Analyzing ${enrichmentProgress.total} keywords with AI (${enrichmentProgress.completed}/${enrichmentProgress.total})`
                    : 'Adding keywords to your workspace'}
                </p>
              </div>

              {enrichmentProgress && (
                <div className="w-full max-w-xs">
                  <div className="h-2 w-full rounded-full bg-surface-inset overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{
                        width: `${Math.round(
                          (enrichmentProgress.completed / enrichmentProgress.total) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-center text-caption text-text-muted">
                    {Math.round(
                      (enrichmentProgress.completed / enrichmentProgress.total) * 100,
                    )}
                    %
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Complete ── */}
          {importState === 'complete' && importResult && (
            <div className="space-y-5">
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-success/20 bg-success/[0.06]">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <div className="text-center">
                  <p className="text-heading-2 text-text-primary">Import complete</p>
                  <p className="mt-1 text-body-sm text-text-secondary">
                    Keywords have been added to your workspace.
                  </p>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid gap-3 grid-cols-3">
                <div className="rounded-lg border border-success/20 bg-success/[0.04] px-4 py-3 text-center">
                  <p className="text-heading-2 text-success">{importResult.imported}</p>
                  <p className="text-caption text-text-secondary">Imported</p>
                </div>
                <div className="rounded-lg border border-warning/20 bg-warning/[0.04] px-4 py-3 text-center">
                  <p className="text-heading-2 text-warning">{importResult.skipped}</p>
                  <p className="text-caption text-text-secondary">Skipped</p>
                </div>
                <div className="rounded-lg border border-accent/20 bg-accent/[0.04] px-4 py-3 text-center">
                  <p className="text-heading-2 text-accent">{importResult.updated}</p>
                  <p className="text-caption text-text-secondary">Updated</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    // Reset for another import
                    setImportState('idle');
                    setPasteText('');
                    setCsvFile(null);
                    setPreviewKeywords([]);
                    setImportResult(null);
                    setErrorMessage(null);
                  }}
                  icon={<PlusCircle className="h-4 w-4" />}
                >
                  Import more
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {/* ── Error during processing ── */}
          {importState === 'preview' && errorMessage && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/[0.04] px-4 py-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-body-sm font-semibold text-destructive">Import failed</p>
                <p className="mt-0.5 text-body-sm text-text-secondary">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
