import { useNavigate, useParams } from 'react-router-dom'
import { useBug } from '../hooks/useBug.js'
import { useToast } from '../components/ToastProvider.jsx'
import { BugForm } from '../components/BugForm.jsx'
import { PageSkeleton } from '../components/Skeletons.jsx'
import { ErrorBanner } from '../components/ErrorBanner.jsx'
import { useDocumentTitle } from '../hooks/useUi.js'
import { api } from '../api/client.js'

export default function BugEdit() {
  const { id } = useParams()
  const { bug, loading, error, reload, refresh } = useBug(id)
  const { toast } = useToast()
  const navigate = useNavigate()

  useDocumentTitle(bug ? `Edit ${bug.title}` : 'Edit bug')

  const onSubmit = async ({ title, description, severity, status, image }) => {
    const body = { title, description, severity, status }
    if (image.action === 'add') body.imageKey = image.key
    if (image.action === 'remove') body.imageKey = null
    await api.put(`/bugs/${id}`, body)
    toast('Bug updated.')
    navigate(`/bugs/${id}`, { replace: true })
  }

  if (loading) return <PageSkeleton />

  if (error && error.status === 404) {
    return (
      <div className="card px-6 py-14 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Bug not found</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          It may have been deleted, or it belongs to someone else.
        </p>
      </div>
    )
  }

  if (!bug) {
    return (
      <div className="space-y-4">
        {error && <ErrorBanner message={error.message} onRetry={reload} />}
        <PageSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Edit bug</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Update the details below and save.</p>
      </div>
      <BugForm
        key={bug.id}
        initial={{ title: bug.title, description: bug.description || '', severity: bug.severity, status: bug.status }}
        existingImage={bug.hasImage ? { imageUrl: bug.imageUrl } : null}
        onImageExpired={refresh}
        submitLabel="Save changes"
        submitHint="Replacing the screenshot deletes the previous one."
        onSubmit={onSubmit}
      />
    </div>
  )
}