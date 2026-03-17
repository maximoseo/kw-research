export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-border/60 bg-gradient-to-r from-surface-raised/90 via-surface-overlay/60 to-surface-raised/90 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}
