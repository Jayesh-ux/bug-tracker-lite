import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cx } from '../lib/format.js'

const ToastContext = createContext(null)

let nextId = 0

const TYPE_META = {
  success: { icon: CheckCircle2, ring: 'text-emerald-500', label: 'Success' },
  error: { icon: AlertTriangle, ring: 'text-rose-500', label: 'Error' },
  info: { icon: Info, ring: 'text-sky-500', label: 'Notice' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const toast = useCallback(
    (message, type = 'success') => {
      const id = ++nextId
      setToasts((t) => [...t.slice(-3), { id, message, type }])
      window.setTimeout(() => dismiss(id), 5000)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6"
      >
        {toasts.map(({ id, message, type }) => {
          const meta = TYPE_META[type]
          const Icon = meta.icon
          return (
            <div
              key={id}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-800"
            >
              <Icon className={cx('mt-0.5 h-4.5 w-4.5 shrink-0', meta.ring)} aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">{message}</p>
              <button
                onClick={() => dismiss(id)}
                className="cursor-pointer rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}