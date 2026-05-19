export default function DashboardLoading() {
  return (
    <div className="page-stack animate-pulse">
      {/* Hero skeleton */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-surface p-7 shadow-elevation-1 space-y-4">
          <div className="h-5 w-36 rounded-lg bg-surface-raised" />
          <div className="h-8 w-64 rounded-lg bg-surface-raised" />
          <div className="h-4 w-96 rounded bg-surface-raised" />
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="h-16 rounded-lg bg-surface-raised" />
            <div className="h-16 rounded-lg bg-surface-raised" />
            <div className="h-16 rounded-lg bg-surface-raised" />
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface p-7 shadow-elevation-1 space-y-4">
          <div className="h-4 w-24 rounded-lg bg-surface-raised" />
          <div className="h-6 w-40 rounded-lg bg-surface-raised" />
          <div className="h-4 w-72 rounded bg-surface-raised" />
          <div className="space-y-2 mt-4">
            <div className="h-14 rounded-lg bg-surface-raised" />
            <div className="h-14 rounded-lg bg-surface-raised" />
            <div className="h-14 rounded-lg bg-surface-raised" />
          </div>
        </div>
      </section>

      {/* Cards skeleton */}
      <section className="grid gap-6 lg:grid-cols-2 mt-6">
        <div className="rounded-xl border border-border/60 bg-surface p-7 shadow-elevation-1 space-y-4">
          <div className="h-4 w-28 rounded-lg bg-surface-raised" />
          <div className="h-6 w-44 rounded-lg bg-surface-raised" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="h-32 rounded-xl bg-surface-raised" />
            <div className="h-32 rounded-xl bg-surface-raised" />
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface p-7 shadow-elevation-1 space-y-4">
          <div className="h-4 w-28 rounded-lg bg-surface-raised" />
          <div className="h-6 w-44 rounded-lg bg-surface-raised" />
          <div className="space-y-3 mt-4">
            <div className="h-12 rounded-lg bg-surface-raised" />
            <div className="h-12 rounded-lg bg-surface-raised" />
            <div className="h-12 rounded-lg bg-surface-raised" />
            <div className="h-12 rounded-lg bg-surface-raised" />
          </div>
        </div>
      </section>
    </div>
  );
}
