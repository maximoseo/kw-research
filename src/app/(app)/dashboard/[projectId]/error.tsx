'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { LayoutDashboard } from 'lucide-react';

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-shell flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-heading-1 text-text-primary">Failed to load project</h2>
        <p className="text-body text-text-secondary">
          {error.message || 'The project could not be loaded. It may have been deleted or you may not have access.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} variant="secondary">
            Try again
          </Button>
          <Link href="/dashboard">
            <Button icon={<LayoutDashboard className="h-4 w-4" />}>
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
