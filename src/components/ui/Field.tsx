import { cn } from '@/lib/utils';

export default function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('field-group', className)}>
      <div className="flex items-center justify-between gap-3">
        <label className="field-label">{label}</label>
        {hint ? <span className="field-help">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="field-help text-destructive">{error}</p> : null}
    </div>
  );
}
