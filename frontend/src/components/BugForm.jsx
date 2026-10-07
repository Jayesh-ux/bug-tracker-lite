import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ImageDropzone } from './ImageDropzone.jsx'
import { ErrorBanner } from './ErrorBanner.jsx'
import { cx } from '../lib/format.js'
import { SEVERITIES, SEVERITY_META, STATUSES } from '../lib/bugMeta.js'
import { uploadImage, validateImage } from '../api/upload.js'

const EMPTY = {
  title: '',
  description: '',
  severity: 'low',
  status: 'open',
}

export function BugForm({ initial = EMPTY, existingImage = null, submitLabel, submitHint, onSubmit, onImageExpired }) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [severity, setSeverity] = useState(initial.severity ?? 'low')
  const [status, setStatus] = useState(initial.status ?? 'open')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)

  // Image state
  const [pendingFile, setPendingFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(existingImage ? existingImage.imageUrl : null)
  const [imageKind, setImageKind] = useState(existingImage ? 'keep' : 'none') // keep | none | add | remove
  const uploadProgressRef = useRef(0)
  const lastImageRefreshRef = useRef(0)

  // Pre-signed S3 view URLs expire after 5 minutes while the form stays open.
  // When the caller re-fetches the bug (fresh imageUrl), swap the preview to
  // the new URL. Only while keeping the existing image, so a pending local
  // file preview (blob: URL) is never clobbered.
  useEffect(() => {
    if (imageKind === 'keep' && existingImage?.imageUrl) setPreviewUrl(existingImage.imageUrl)
  }, [existingImage?.imageUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageExpired = () => {
    if (!onImageExpired) return
    const now = Date.now()
    if (now - lastImageRefreshRef.current < 5000) return
    lastImageRefreshRef.current = now
    onImageExpired()
  }

  const uploading = useMemo(
    () => imageKind === 'uploading',
    [imageKind]
  )
  const [progress, setProgress] = useState(0)
  const saving = useRef(false)
  const [, force] = useState(0)

  useEffect(() => {
    return () => {
      if (previewUrl && !existingImage) URL.revokeObjectURL(previewUrl)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pickFile = (file) => {
    const { error } = validateImage(file)
    if (error) {
      setFormError(error)
      return
    }
    setFormError(null)
    setErrors((e) => ({ ...e, image: null }))
    if (previewUrl && imageKind !== 'keep') URL.revokeObjectURL(previewUrl)
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setImageKind('add')
  }

  const clearImage = () => {
    if (previewUrl && imageKind !== 'keep') URL.revokeObjectURL(previewUrl)
    setPendingFile(null)
    setPreviewUrl(null)
    setImageKind(existingImage ? 'remove' : 'none')
  }

  const validate = () => {
    const next = {}
    const t = title.trim()
    if (!t) next.title = 'Title is required.'
    else if (t.length > 200) next.title = 'Keep the title under 200 characters.'
    if (description.length > 5000) next.description = 'Keep the description under 5,000 characters.'
    if (!SEVERITIES.includes(severity)) next.severity = 'Pick a severity.'
    if (!STATUSES.includes(status)) next.status = 'Pick a status.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return
    if (saving.current) return
    saving.current = true
    force((n) => n + 1)

    try {
      let image
      if (pendingFile) {
        setImageKind('uploading')
        const key = await uploadImage(pendingFile, (p) => {
          uploadProgressRef.current = p
          setProgress(p)
        })
        image = { action: 'add', key }
      } else {
        image = { action: imageKind === 'keep' ? 'keep' : imageKind === 'remove' ? 'remove' : 'none', key: null }
      }

      setImageKind(image.action === 'add' ? 'add' : imageKind)
      await onSubmit({
        title: title.trim(),
        description,
        severity,
        status,
        image,
      })
    } catch (err) {
      setImageKind((k) => (k === 'uploading' ? 'add' : k))
      setFormError(err.message || 'Something went wrong. Please try again.')
    } finally {
      saving.current = false
      force((n) => n + 1)
    }
  }

  const setErrorsLoose = (field, val) => setErrors((e) => ({ ...e, [field]: val }))

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="card p-5 sm:p-6">
        {formError && <ErrorBanner message={formError} />}

        <div className="space-y-5">
          <div>
            <label htmlFor="title" className="label">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="title"
              className={cx('input', errors.title && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/25')}
              value={title}
              maxLength={200}
              onChange={(e) => {
                setTitle(e.target.value)
                if (errors.title) setErrorsLoose('title', null)
              }}
              placeholder="e.g. Save button does nothing when clicked"
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title ? <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{errors.title}</p> : <p className="mt-1.5 text-right text-xs text-slate-400">{title.length}/200</p>}
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(optional)</span>
            </label>
            <textarea
              id="description"
              className={cx('textarea min-h-32 resize-y', errors.description && 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/25')}
              value={description}
              maxLength={5000}
              onChange={(e) => {
                setDescription(e.target.value)
                if (errors.description) setErrorsLoose('description', null)
              }}
              placeholder={"What should happen, what actually happens, and how can it be reproduced?"}
            />
            {errors.description ? <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">{errors.description}</p> : <p className="mt-1 text-right text-xs text-slate-400">{description.length}/5,000</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <fieldset>
              <legend className="label">Severity</legend>
              <div className="flex gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    aria-pressed={severity === s}
                    className={cx(
                      'h-9 flex-1 cursor-pointer rounded-lg border text-sm font-medium capitalize transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none',
                      severity === s
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500'
                    )}
                  >
                    {SEVERITY_META[s].label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="label">Status</legend>
              <div className="flex gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    aria-pressed={status === s}
                    className={cx(
                      'h-9 flex-1 cursor-pointer rounded-lg border text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none',
                      status === s
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500'
                    )}
                  >
                    {s === 'in-progress' ? 'In progress' : s === 'open' ? 'Open' : 'Closed'}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div>
            <span className="label">Screenshot</span>
            {previewUrl && imageKind === 'uploading' && (
              <div className="mb-3 mt-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Uploading…</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <ImageDropzone previewUrl={previewUrl} busy={saving.current} onPick={pickFile} onClear={clearImage} onExpire={handleImageExpired} />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800/70">
          <p className="text-xs text-slate-400 dark:text-slate-500">{submitHint || 'Saved bugs are private to your account.'}</p>
          <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center">
            <Link to={existingImage ? '../' : '/'} className="btn-secondary justify-center">
              Cancel
            </Link>
            <button type="submit" disabled={saving.current || uploading} className="btn-primary">
              {(saving.current || uploading) && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}