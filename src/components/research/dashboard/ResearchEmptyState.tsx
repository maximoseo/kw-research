'use client';

import { Button } from '@/components/ui';
import { Radar } from 'lucide-react';
import { NoProjectIllustration, NoRunsIllustration, NoResultsIllustration } from './empty-illustrations';

interface ResearchEmptyStateProps {
  hasProject: boolean;
  hasRuns: boolean;
  onCreateRun: () => void;
}

export default function ResearchEmptyState({ hasProject, hasRuns, onCreateRun }: ResearchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-border/60 bg-surface px-6 py-14 text-center shadow-elevation-1">

      {!hasProject ? (
        <>
          <NoProjectIllustration className="w-40 h-auto" />
          <div>
            <h3 className="text-heading-2 text-text-primary">No project selected</h3>
            <p className="mt-1.5 max-w-xs mx-auto text-body-sm text-text-secondary leading-relaxed">
              Select a website workspace from the sidebar to start keyword research. Your projects, runs, and saved data will appear here.
            </p>
          </div>
        </>
      ) : !hasRuns ? (
        <>
          <NoRunsIllustration className="w-40 h-auto" />
          <div>
            <h3 className="text-heading-2 text-text-primary">Start your first research run</h3>
            <p className="mt-1.5 max-w-xs mx-auto text-body-sm text-text-secondary leading-relaxed">
              Launch a keyword research run to discover opportunities, analyze difficulty, and generate content briefs.
            </p>
          </div>
          <Button size="lg" icon={<Radar className="h-4 w-4" />} onClick={onCreateRun}>
            Start Research
          </Button>
        </>
      ) : (
        <>
          <NoResultsIllustration className="w-40 h-auto" />
          <div>
            <h3 className="text-heading-2 text-text-primary">No results to show</h3>
            <p className="mt-1.5 max-w-xs mx-auto text-body-sm text-text-secondary leading-relaxed">
              Select a completed run from history to view keyword results, or start a new research run.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
