export default function ProjectLoading() {
  return (
    <div className="min-w-0 space-y-5 animate-pulse">
      <div className="h-24 rounded-2xl bg-surface-raised" />
      <div className="h-12 rounded-lg bg-surface-raised" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}
