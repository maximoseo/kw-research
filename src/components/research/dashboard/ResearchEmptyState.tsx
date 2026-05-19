'use client';

import { Button } from '@/components/ui';
import { Radar } from 'lucide-react';

interface ResearchEmptyStateProps {
  hasProject: boolean;
  hasRuns: boolean;
  onCreateRun: () => void;
}

export default function ResearchEmptyState({ hasProject, hasRuns, onCreateRun }: ResearchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/60 bg-surface px-6 py-12 text-center shadow-elevation-1">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/15 bg-accent/[0.06]">
        <Radar className="h-6 w-6 text-accent" />
      </div>

      {!hasProject ? (
        <>
          <div>
            <h3 className="text-heading-2 text-text-primary">No project selected</h3>
            <p className="mt-1 max-w-sm text-body-sm text-text-secondary">
              Select a website workspace to start keyword research.
            </p>
          </div>
        </>
      ) : !hasRuns ? (
        <>
          <div>
            <h3 className="text-heading-2 text-text-primary">Start your first research run</h3>
            <p className="mt-1 max-w-sm text-body-sm text-text-secondary">
              Launch a keyword research run to discover opportunities, analyze difficulty, and generate content briefs.
            </p>
          </div>
          <Button size="lg" icon={<Radar className="h-4 w-4" />} onClick={onCreateRun}>
            Start Research
          </Button>
        </>
      ) : (
        <>
          <div>
            <h3 className="text-heading-2 text-text-primary">No results to show</h3>
            <p className="mt-1 max-w-sm text-body-sm text-text-secondary">
              Select a completed run from history to view keyword results.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
