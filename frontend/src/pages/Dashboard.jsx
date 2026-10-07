import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ImageIcon, Plus } from 'lucide-react'
import { useBugs } from '../hooks/useBugs.js'
import { useDocumentTitle } from '../hooks/useUi.js'
import { SeverityBadge, StatusBadge } from '../components/Badges.jsx'
import { Segmented } from '../components/Segmented.jsx'
import { ErrorBanner } from '../components/ErrorBanner.jsx'
import { BugListSkeleton } from '../components/Skeletons.jsx'
import { NoBugsEmpty } from '../components/EmptyState.jsx'
import { formatDate, cx } from '../lib/format.js'
import { STATUSES } from '../lib/bugMeta.js'

const FILTERS = [
  { value: 'all', label: 'All' },
  ...STATUSES.map((s) => ({ value: s, label: s === 'in-progress' ? 'In progress' : s[0].toUpperCase() + s.slice(1) })),
]

export default function Dashboard() {
  const { bugs, loading, error, reload } = useBugs()
  const [filter, setFilter] = useState('all')
  useDocumentTitle('')

  const counts = useMemo(() => {
    const c = { all: 0, open: 0, 'in-progress': 0, closed: 0 }
    for (const b of bugs || []) {
      c.all += 1
      if (c[b.status] !== undefined) c[b.status] += 1
    }
    return c
  }, [bugs])

  const visible = useMemo(() => {
    if (!bugs) return []
    return filter === 'all' ? bugs : bugs.filter((b) => b.status === filter)
  }, [bugs, filter])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">Your bugs</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {bugs ? `${bugs.length} total · ${counts.open} open · ${counts['in-progress']} in progress · ${counts.closed} closed` : 'Loading…'}
          </p>
        </div>
        <Link to="/bugs/new" className="btn-primary sm:hidden">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Report bug
        </Link>
      </div>

      <Segmented
        ariaLabel="Filter bugs by status"
        options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
        value={filter}
        onChange={setFilter}
      />

      {error && <ErrorBanner message={error.message} onRetry={reload} />}

      {!error && loading && <BugListSkeleton rows={4} />}

      {!error && !loading && visible.length === 0 && <NoBugsEmpty filtered={filter !== 'all'} />}

      {!error && !loading && visible.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {visible.map((b) => (
                <li key={b.id}>
                  <Link
                    to={`/bugs/${b.id}`}
                    className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/40 focus-visible:outline-none dark:hover:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[15px] font-medium text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-300">
                        {b.hasImage && <ImageIcon className="h-4 w-4 shrink-0 text-slate-400" aria-label="Has screenshot" />}
                        <span className="truncate">{b.title}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{formatDate(b.createdAt)}</p>
                    </div>
                    <SeverityBadge severity={b.severity} />
                    <StatusBadge status={b.status} />
                    <ChevronRight className="h-4.5 w-4.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {visible.map((b) => (
              <Link key={b.id} to={`/bugs/${b.id}`} className="card block px-4 py-3.5 transition active:bg-slate-50 dark:active:bg-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <p className={cx('min-w-0 flex-1 truncate text-[15px] font-medium text-slate-900 dark:text-slate-100')}>
                    {b.title}
                  </p>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={b.severity} />
                  <StatusBadge status={b.status} />
                  {b.hasImage && <ImageIcon className="h-4 w-4 text-slate-400" aria-label="Has screenshot" />}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatDate(b.createdAt)}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}