import { cn } from '@/lib/utils';

export default function Metric({
  label,
  value,
  helper,
  compact = false,
}: {
  label: string;
  value: string;
  helper: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-surface-raised/80 px-4 py-3.5 overflow-hidden">
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-1.5 font-semibold text-text-primary break-words', compact ? 'text-body' : 'text-heading-2')}>{value}</p>
      <p className="mt-1 text-body-sm leading-5 text-text-muted line-clamp-2">{helper}</p>
    </div>
  );
}
