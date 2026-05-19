export default function ProjectDashboardLoading() {
  return (
    <div className="min-w-0 animate-pulse space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 w-48 rounded-lg bg-surface-raised" />
        <div className="h-5 w-20 rounded-full bg-surface-raised" />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-28 rounded-lg bg-surface-raised" />
        <div className="h-9 w-36 rounded-lg bg-surface-raised" />
        <div className="h-9 w-28 rounded-lg bg-surface-raised" />
        <div className="h-9 w-36 rounded-lg bg-surface-raised" />
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border/60 bg-surface p-6 shadow-elevation-1 space-y-4">
            <div className="h-5 w-32 rounded-lg bg-surface-raised" />
            <div className="h-4 w-64 rounded bg-surface-raised" />
            <div className="space-y-3">
              <div className="h-12 rounded-lg bg-surface-raised" />
              <div className="h-12 rounded-lg bg-surface-raised" />
              <div className="h-12 rounded-lg bg-surface-raised" />
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-surface p-6 shadow-elevation-1 space-y-4">
            <div className="h-5 w-40 rounded-lg bg-surface-raised" />
            <div className="h-64 rounded-lg bg-surface-raised" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-surface p-6 shadow-elevation-1 space-y-3">
            <div className="h-5 w-28 rounded-lg bg-surface-raised" />
            <div className="h-4 w-48 rounded bg-surface-raised" />
            <div className="h-24 rounded-lg bg-surface-raised" />
          </div>
          <div className="rounded-xl border border-border/60 bg-surface p-6 shadow-elevation-1 space-y-3">
            <div className="h-5 w-32 rounded-lg bg-surface-raised" />
            <div className="h-16 rounded-lg bg-surface-raised" />
          </div>
        </div>
      </div>
    </div>
  );
}
