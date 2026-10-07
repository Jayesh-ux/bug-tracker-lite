import { cx } from '../lib/format.js'

export function Segmented({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
    >
      {options.map(({ value: v, label, count }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={v === value}
          className={cx(
            'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none',
            v === value
              ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
          )}
        >
          {label}
          {typeof count === 'number' && (
            <span
              className={cx(
                'rounded px-1 text-[11px] font-semibold tabular-nums',
                v === value
                  ? 'bg-white/15 text-white dark:bg-slate-900/15 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}