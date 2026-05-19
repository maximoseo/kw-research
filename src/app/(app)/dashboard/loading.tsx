export default function DashboardLoading() {
  return (
    <main className="page-shell flex flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-lg bg-surface-raised" />
        <div className="h-4 w-64 rounded bg-surface-raised" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-raised" />
          ))}
        </div>
      </div>
    </main>
  );
}
