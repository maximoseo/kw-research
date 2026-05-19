'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RunDetailError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Run detail error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-surface px-8 py-10 text-center shadow-elevation-1 max-w-md">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/12 bg-destructive/[0.04]">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h2 className="text-heading-3 text-text-primary">Failed to load run</h2>
          <p className="mt-1 text-body-sm text-text-secondary leading-relaxed">
            This research run may have been deleted or is temporarily unavailable.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCcw className="h-3.5 w-3.5" />}
            onClick={reset}
          >
            Retry
          </Button>
          <Link href="/dashboard">
            <Button size="sm" variant="ghost">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
