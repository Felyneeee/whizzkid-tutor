export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading section" className="mx-auto max-w-6xl animate-pulse space-y-4">
      <div className="h-8 w-56 rounded-lg bg-slate-200" />
      <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl border border-slate-100 bg-white" />
        ))}
      </div>
      <span className="sr-only">Loading section…</span>
    </div>
  );
}
