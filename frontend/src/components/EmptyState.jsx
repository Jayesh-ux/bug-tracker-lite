import { Link } from 'react-router-dom'
import { ArrowRight, SearchX } from 'lucide-react'
import { createElement } from 'react'

export function EmptyState({ icon = SearchX, title, body, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {createElement(icon, { className: 'h-6 w-6', 'aria-hidden': true })}
      </span>
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {body && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">{body}</p>}
      </div>
      {action}
    </div>
  )
}

export function NoBugsEmpty({ filtered = false }) {
  return filtered ? (
    <EmptyState
      title="No bugs match this filter"
      body="Try a different status filter to see your other bugs."
    />
  ) : (
    <EmptyState
      title="No bugs yet"
      body="Looks like everything is working. When something breaks, report it here — you can even attach a screenshot."
      action={
        <Link to="/bugs/new" className="btn-primary">
          Report your first bug
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
    />
  )
}