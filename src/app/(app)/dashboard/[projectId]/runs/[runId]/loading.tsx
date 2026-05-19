export default function RunDetailLoading() {
  return (
    <div className="min-w-0 animate-pulse space-y-5 p-6">
      {/* Back link */}
      <div className="h-4 w-28 rounded bg-surface-raised" />

      {/* Status header */}
      <div className="rounded-xl border border-border/60 bg-surface p-5 shadow-elevation-1 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-6 w-20 rounded-full bg-surface-raised" />
          <div className="space-y-2">
            <div className="h-4 w-36 rounded bg-surface-raised" />
            <div className="h-3 w-48 rounded bg-surface-raised" />
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-surface-raised" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/40 pb-2">
        <div className="h-8 w-24 rounded-lg bg-surface-raised" />
        <div className="h-8 w-20 rounded-lg bg-surface-raised" />
        <div className="h-8 w-24 rounded-lg bg-surface-raised" />
        <div className="h-8 w-28 rounded-lg bg-surface-raised" />
      </div>

      {/* Content area */}
      <div className="rounded-xl border border-border/60 bg-surface p-6 shadow-elevation-1 space-y-4">
        <div className="h-4 w-32 rounded bg-surface-raised" />
        <div className="space-y-2">
          <div className="h-10 rounded-lg bg-surface-raised" />
          <div className="h-10 rounded-lg bg-surface-raised" />
          <div className="h-10 rounded-lg bg-surface-raised" />
          <div className="h-10 rounded-lg bg-surface-raised" />
          <div className="h-10 rounded-lg bg-surface-raised" />
        </div>
      </div>
    </div>
  );
}
