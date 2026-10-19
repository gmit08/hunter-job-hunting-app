export function DashboardSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-10 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-card ring-1 ring-foreground/10" />
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">Loading your applications…</p>
    </main>
  );
}
