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
    <div className="rounded-xl border border-accent/[0.10] bg-surface-raised/[0.58] px-4 py-4 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-2 font-semibold text-text-primary break-words', compact ? 'text-base' : 'text-xl tracking-tight sm:text-2xl')}>{value}</p>
      <p className="mt-1.5 text-sm leading-5 text-text-secondary line-clamp-2">{helper}</p>
    </div>
  );
}
