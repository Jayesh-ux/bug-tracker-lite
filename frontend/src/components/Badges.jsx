import { cx } from '../lib/format.js'
import { SEVERITY_META, STATUS_META } from '../lib/bugMeta.js'

export function SeverityBadge({ severity }) {
  const m = SEVERITY_META[severity]
  if (!m) return null
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        m.badge
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} aria-hidden="true" />
      {m.label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const m = STATUS_META[status]
  if (!m) return null
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        m.badge
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} aria-hidden="true" />
      {m.label}
    </span>
  )
}