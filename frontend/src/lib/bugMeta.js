export const SEVERITIES = ['low', 'medium', 'high']
export const STATUSES = ['open', 'in-progress', 'closed']

export const SEVERITY_META = {
  low: {
    label: 'Low',
    dot: 'bg-emerald-500',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-400',
  },
  medium: {
    label: 'Medium',
    dot: 'bg-amber-500',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-400',
  },
  high: {
    label: 'High',
    dot: 'bg-rose-500',
    badge: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-400',
  },
}

export const STATUS_META = {
  open: {
    label: 'Open',
    dot: 'bg-sky-500',
    badge: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-400',
  },
  'in-progress': {
    label: 'In progress',
    dot: 'bg-violet-500',
    badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/50 dark:text-violet-400',
  },
  closed: {
    label: 'Closed',
    dot: 'bg-slate-400',
    badge: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400',
  },
}