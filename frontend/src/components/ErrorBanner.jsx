import { AlertTriangle, RefreshCw } from 'lucide-react'

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/60 dark:bg-rose-950/40">
      <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-rose-700 dark:text-rose-400">Something went wrong</p>
        <p className="mt-0.5 text-sm text-rose-600/90 dark:text-rose-400/80">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary shrink-0 border-transparent bg-white/70">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  )
}