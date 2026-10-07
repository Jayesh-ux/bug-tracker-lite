import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, ImageOff, Pencil, Trash2 } from 'lucide-react'
import { useBug } from '../hooks/useBug.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { useDocumentTitle } from '../hooks/useUi.js'
import { SeverityBadge, StatusBadge } from '../components/Badges.jsx'
import { ErrorBanner } from '../components/ErrorBanner.jsx'
import { PageSkeleton } from '../components/Skeletons.jsx'
import { ConfirmModal } from '../components/ConfirmModal.jsx'
import { Lightbox, Screenshot } from '../components/Lightbox.jsx'
import { api } from '../api/client.js'
import { formatDate } from '../lib/format.js'

export default function BugDetail() {
  const { id } = useParams()
  const { bug, loading, error, reload, refresh } = useBug(id)
  const lastImageRefreshRef = useRef(0)

  // Pre-signed imageUrl expires ~5 minutes after page load; when the img 403s,
  // silently refetch the bug for a fresh URL (keeps the page mounted).
  const handleImageExpired = () => {
    const now = Date.now()
    if (now - lastImageRefreshRef.current < 5000) return
    lastImageRefreshRef.current = now
    refresh()
  }
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useDocumentTitle(bug ? `${bug.title}` : 'Bug')

  if (error && error.status === 404) {
    return (
      <NotFoundContent
        user={user}
        message="Bugs are private to the person who reported them — this one doesn't exist, was deleted, or belongs to someone else."
      />
    )
  }

  const onDelete = async () => {
    setDeleting(true)
    try {
      await api.del(`/bugs/${id}`)
      toast('Bug deleted.')
      navigate('/', { replace: true })
    } catch (err) {
      setDeleting(false)
      setConfirmOpen(false)
      toast(err.message, 'error')
    }
  }

  return (
    <div className="space-y-5">
      {loading && <PageSkeleton />}

      {!loading && !bug && !error && <PageSkeleton />}

      {!loading && bug && (
        <>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All bugs
          </Link>

          {error && <ErrorBanner message={error.message} onRetry={reload} />}

          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
                {bug.title}
              </h1>
              <div className="flex shrink-0 gap-2">
                <Link to={`/bugs/${bug.id}/edit`} className="btn-secondary">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Link>
                <button onClick={() => setConfirmOpen(true)} className="btn-danger">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={bug.severity} />
              <StatusBadge status={bug.status} />
            </div>

            <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 dark:border-slate-800/70">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                <dt className="sr-only">Created</dt>
                <dd>
                  Created {formatDate(bug.createdAt)}
                  {bug.updatedAt !== bug.createdAt && <> · Updated {formatDate(bug.updatedAt)}</>}
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              <h2 className="label">Description</h2>
              {bug.description ? (
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300">{bug.description}</p>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">No description provided.</p>
              )}
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <h2 className="label">Screenshot</h2>
            {bug.hasImage && bug.imageUrl ? (
              <Screenshot src={bug.imageUrl} alt="Screenshot attached to this bug" onView={() => setLightboxOpen(true)} onExpire={handleImageExpired} />
            ) : (
              <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-500">
                <ImageOff className="h-4.5 w-4.5 text-slate-400 dark:text-slate-600" aria-hidden="true" />
                No screenshot attached.
              </div>
            )}
          </div>

          <ConfirmModal
            open={confirmOpen}
            title="Delete this bug?"
            body={`This permanently deletes the bug${bug.hasImage ? ' and its screenshot' : ''}. This can't be undone.`}
            confirmLabel="Delete bug"
            busy={deleting}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={onDelete}
          />

          {lightboxOpen && bug.imageUrl && (
            <Lightbox src={bug.imageUrl} alt="Screenshot attached to this bug" onClose={() => setLightboxOpen(false)} onExpire={handleImageExpired} />
          )}
        </>
      )}
    </div>
  )
}

function NotFoundContent({ user, message }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Bug not found</h1>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{message}</p>
      <Link to="/" className="btn-primary mt-2">
        Back to your bugs
      </Link>
    </div>
  )
}