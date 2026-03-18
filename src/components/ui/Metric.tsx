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
    <div className="rounded-lg border border-border/60 bg-surface-raised/[0.55] px-4 py-3.5 overflow-hidden">
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-1.5 font-semibold text-text-primary break-words', compact ? 'text-base' : 'text-xl tracking-tight sm:text-2xl')}>{value}</p>
      <p className="mt-1 text-sm leading-5 text-text-secondary line-clamp-2">{helper}</p>
    </div>
  );
}
