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
    <div className="flex flex-col rounded-xl border border-border/50 bg-surface-raised/60 px-4 py-3.5 overflow-hidden">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent/60">{label}</p>
      <p className={cn('mt-1 font-semibold text-text-primary break-words leading-snug', compact ? 'text-sm' : 'text-lg')}>{value}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-text-muted line-clamp-2">{helper}</p>
    </div>
  );
}
