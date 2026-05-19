'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Dashboard error boundary:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-5 rounded-xl border border-border/60 bg-surface px-8 py-12 text-center shadow-elevation-1 max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/12 bg-destructive/[0.04]">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-heading-2 text-text-primary">Something went wrong</h2>
          <p className="mt-2 text-body-sm text-text-secondary leading-relaxed">
            The dashboard couldn&apos;t load properly. This might be temporary — try again.
          </p>
          {error.digest && (
            <p className="mt-2 text-caption text-text-muted font-mono">
              ID: {error.digest}
            </p>
          )}
        </div>
        <Button
          size="md"
          variant="secondary"
          icon={<RefreshCcw className="h-4 w-4" />}
          onClick={reset}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
