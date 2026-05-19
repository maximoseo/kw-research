'use client';

import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Download, Search, SlidersHorizontal } from 'lucide-react';

interface ResearchToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onExport?: () => void;
  isExporting?: boolean;
  onToggleFilters?: () => void;
  filtersActive?: boolean;
  className?: string;
}

export default function ResearchToolbar({
  searchValue,
  onSearchChange,
  onExport,
  isExporting,
  onToggleFilters,
  filtersActive,
  className,
}: ResearchToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search keywords, pillars, clusters…"
          className="field-input min-w-0 w-full pl-9 text-body-sm"
        />
      </div>

      {/* View + Export */}
      <div className="flex items-center gap-2">
        {onToggleFilters && (
          <Button
            type="button"
            size="sm"
            variant={filtersActive ? 'primary' : 'secondary'}
            onClick={onToggleFilters}
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          >
            Filters
          </Button>
        )}
        {onExport && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onExport}
            loading={isExporting}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            Export
          </Button>
        )}
      </div>
    </div>
  );
}
