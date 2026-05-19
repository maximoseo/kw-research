'use client';

import { cn } from '@/lib/utils';
import type { ResearchRunDetail } from '@/lib/research';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface ResearchDashboardHeaderProps {
  projectName: string;
  brandName: string;
  market: string;
  language: string;
  selectedRun: ResearchRunDetail | undefined;
  mode: 'fresh' | 'expand';
  onModeToggle: () => void;
}

export default function ResearchDashboardHeader({
  projectName,
  brandName,
  market,
  language,
  selectedRun,
  mode,
  onModeToggle,
}: ResearchDashboardHeaderProps) {
  return (
    <header
      className={cn(
        'page-shell flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-5',
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-heading-2 text-text-primary truncate">{projectName}</h2>
        <p className="mt-0.5 text-body-sm text-text-secondary truncate">
          {brandName} &middot; {market} &middot; {language}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Badge variant={mode === 'fresh' ? 'info' : 'success'}>
          {mode === 'fresh' ? 'Fresh Run' : 'Expand Run'}
        </Badge>

        {selectedRun && (
          <Button variant="ghost" size="sm" onClick={onModeToggle}>
            Toggle mode
          </Button>
        )}
      </div>
    </header>
  );
}
