import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/ToastProvider.jsx'
import { BugForm } from '../components/BugForm.jsx'
import { useDocumentTitle } from '../hooks/useUi.js'
import { api } from '../api/client.js'

export default function BugNew() {
  useDocumentTitle('Report a bug')
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const onSubmit = async ({ title, description, severity, status, image }) => {
    const body = {
      title,
      description,
      severity,
      status,
      ...(image.action === 'add' ? { imageKey: image.key } : {}),
    }
    const bug = await api.post('/bugs', body)
    toast('Bug reported.')
    navigate(`/bugs/${bug.id}`, { replace: true })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Report a bug</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Reporting as {user.name} · only you can see this bug.
        </p>
      </div>
      <BugForm submitLabel="Report bug" onSubmit={onSubmit} />
    </div>
  )
}