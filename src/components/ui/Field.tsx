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
      <div className="field-header">
        <label className="field-label">{label}</label>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
