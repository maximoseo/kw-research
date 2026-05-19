'use client';

import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

type ReviewStatus = 'not_reviewed' | 'in_review' | 'approved' | 'needs_rerun';

const statusConfig: Record<ReviewStatus, { variant: 'warning' | 'info' | 'success' | 'error'; label: string }> = {
  not_reviewed: { variant: 'warning', label: 'Not reviewed' },
  in_review: { variant: 'info', label: 'In review' },
  approved: { variant: 'success', label: 'Approved' },
  needs_rerun: { variant: 'error', label: 'Needs rerun' },
};

interface RunReviewStatusProps {
  status: ReviewStatus;
  onStatusChange?: (status: ReviewStatus) => void;
  className?: string;
}

export default function RunReviewStatus({ status, onStatusChange, className }: RunReviewStatusProps) {
  const config = statusConfig[status] || statusConfig.not_reviewed;

  if (!onStatusChange) {
    return <Badge variant={config.variant}>{config.label}</Badge>;
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Badge variant={config.variant}>{config.label}</Badge>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value as ReviewStatus)}
        className="rounded-md border border-border/40 bg-surface-raised px-2 py-0.5 text-caption text-text-secondary"
      >
        <option value="not_reviewed">Not reviewed</option>
        <option value="in_review">In review</option>
        <option value="approved">Approved</option>
        <option value="needs_rerun">Needs rerun</option>
      </select>
    </div>
  );
}
