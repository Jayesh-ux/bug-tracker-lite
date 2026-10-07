import { Link } from 'react-router-dom'
import { ArrowLeft, Bug } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useUi.js'

export default function NotFound() {
  useDocumentTitle('Not found')
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-100/70 px-4 text-center dark:bg-slate-950">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
        <Bug className="h-7 w-7" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-mono font-medium text-indigo-500">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          This page doesn't exist
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          It may have moved, or the link is broken.
        </p>
      </div>
      <Link to="/" className="btn-primary">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Go home
      </Link>
    </div>
  )
}