export function BugListSkeleton({ rows = 4 }) {
  return (
    <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800/70" role="status" aria-label="Loading bugs">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="h-4 w-1/2 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-3 w-1/4 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="hidden h-6 w-20 animate-pulse rounded-full bg-slate-100 sm:block dark:bg-slate-800" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
      <div className="card h-56 animate-pulse p-8">
        <div className="h-4 w-2/3 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
        <div className="mt-4 h-4 w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  )
}