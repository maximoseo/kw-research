export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-border/40 bg-gradient-to-r from-surface-raised via-surface-overlay to-surface-raised bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}
