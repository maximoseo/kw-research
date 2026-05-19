import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui';

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-5 rounded-xl border border-border/60 bg-surface px-8 py-12 text-center shadow-elevation-1 max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-surface-inset/50">
          <FileQuestion className="h-6 w-6 text-text-muted" />
        </div>
        <div>
          <h2 className="text-heading-2 text-text-primary">Page not found</h2>
          <p className="mt-2 text-body-sm text-text-secondary leading-relaxed">
            The workspace or page you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
        </div>
        <Link href="/dashboard">
          <Button size="md" variant="secondary">
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
