import { useEffect } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import { cx } from '../lib/format.js'

export function ConfirmModal({ open, title, body, confirmLabel = 'Delete', busy = false, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={busy ? undefined : onCancel} />
      <div className="card relative z-10 w-full max-w-sm p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
            <TriangleAlert className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="mt-1 mb-5 text-sm text-slate-600 dark:text-slate-400">{body}</p>
          </div>
          <button onClick={busy ? undefined : onCancel} className="btn-ghost-icon -mr-1 -mt-1" aria-label="Cancel">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={cx('flex justify-end gap-2', 'mt-4')}>
          <button onClick={onCancel} disabled={busy} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy} className="btn-danger">
            {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-rose-400 border-t-transparent" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}