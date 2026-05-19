'use client';

import { Button } from '@/components/ui';
import { RefreshCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-shell flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-heading-1 text-text-primary">Something went wrong</h2>
        <p className="text-body text-text-secondary">
          {error.message || 'An unexpected error occurred while loading the dashboard.'}
        </p>
        <Button onClick={reset} icon={<RefreshCcw className="h-4 w-4" />}>
          Try again
        </Button>
      </div>
    </main>
  );
}
