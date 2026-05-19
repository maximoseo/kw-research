'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, Clock, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { Button, Card } from '@/components/ui';

interface ExportWorkbook {
  id: string;
  name: string;
  format: 'xlsx' | 'csv';
  createdAt: string;
  fileSizeBytes: number;
  runId?: string;
  runLabel?: string;
}

interface ExportCenterProps {
  workbooks: ExportWorkbook[];
  isLoading?: boolean;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExportCenter({ workbooks, isLoading = false, className }: ExportCenterProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className={cn('space-y-4', className)}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-surface-raised border border-border/40 animate-shimmer bg-[length:200%_100%]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-surface-raised border border-border/40 animate-shimmer bg-[length:200%_100%]" />
            <div className="h-3 w-24 rounded bg-surface-raised border border-border/40 animate-shimmer bg-[length:200%_100%]" />
          </div>
        </div>
      </Card>
    );
  }

  if (workbooks.length === 0) {
    return (
      <Card className={cn(className)}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/40 bg-surface-raised">
            <FileSpreadsheet className="h-5 w-5 text-text-muted" />
          </div>
          <div>
            <p className="text-body-sm font-semibold text-text-primary">No exports yet</p>
            <p className="mt-1 text-caption text-text-muted">
              Exported workbooks will appear here after your research runs complete.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const latest = workbooks[0];
  const previous = workbooks.slice(1);

  const handleDownload = async (wb: ExportWorkbook) => {
    setDownloading(wb.id);
    try {
      const res = await fetch(`/api/exports/${wb.id}/download`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${wb.name}.${wb.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — parent can add toast integration later
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* ── Latest workbook ── */}
      <Card padding="lg" variant="muted">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-caption font-semibold uppercase tracking-wider text-text-muted">
              Latest Export
            </p>
            <h3 className="mt-2 text-heading-2 text-text-primary truncate">{latest.name}</h3>
            {latest.runLabel && (
              <p className="mt-1 text-body-sm text-text-secondary">{latest.runLabel}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-caption text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {formatDateTime(latest.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                {formatFileSize(latest.fileSizeBytes)}
              </span>
              <span className="rounded-full border border-border/50 bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase text-text-secondary">
                {latest.format}
              </span>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={downloading === latest.id}
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => handleDownload(latest)}
          >
            Download
          </Button>
        </div>
      </Card>

      {/* ── Previous workbooks ── */}
      {previous.length > 0 && (
        <div>
          <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-text-muted">
            Previous Exports
          </p>
          <div className="space-y-2">
            {previous.map((wb) => (
              <div
                key={wb.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface px-4 py-3 transition-all hover:border-accent/30 hover:bg-surface-hover"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-text-muted" />
                    <p className="truncate text-body-sm font-semibold text-text-primary">
                      {wb.name}
                    </p>
                    <span className="shrink-0 rounded-full border border-border/50 bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
                      {wb.format}
                    </span>
                  </div>
                  {wb.runLabel && (
                    <p className="mt-0.5 ml-6 text-caption text-text-secondary">{wb.runLabel}</p>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-3 text-caption text-text-muted shrink-0">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDateTime(wb.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {formatFileSize(wb.fileSizeBytes)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={downloading === wb.id}
                  icon={<Download className="h-3.5 w-3.5" />}
                  onClick={() => handleDownload(wb)}
                  className="shrink-0"
                >
                  <span className="hidden sm:inline">Download</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
