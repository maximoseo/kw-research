'use client';

import { Alert, Button } from '@/components/ui';
import { RefreshCcw } from 'lucide-react';

interface ResearchErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ResearchErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: ResearchErrorStateProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface p-6 shadow-elevation-1">
      <Alert variant="error" title={title}>
        {message}
      </Alert>
      {onRetry && (
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRetry}
            icon={<RefreshCcw className="h-3.5 w-3.5" />}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
