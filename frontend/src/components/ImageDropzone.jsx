import { useRef, useState } from 'react'
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react'
import { cx } from '../lib/format.js'

export function ImageDropzone({ previewUrl, alt = 'Selected screenshot', busy = false, onPick, onClear }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const choose = () => inputRef.current?.click()

  const handleFiles = (list) => {
    const file = list && list[0]
    if (file) onPick(file)
  }

  return (
    <div>
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          <img src={previewUrl} alt={alt} className="block max-h-64 w-full object-cover" />
          <div className="absolute right-2 bottom-2 flex gap-2">
            <button type="button" onClick={choose} disabled={busy} className="btn-secondary border-white/70 bg-white/90 backdrop-blur dark:border-slate-300/30 dark:bg-slate-800/80">
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Replace
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              className="btn-danger border-white/70 bg-white/90 backdrop-blur dark:border-slate-300/30 dark:bg-slate-800/80"
              aria-label="Remove screenshot"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={choose}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          disabled={busy}
          className={cx(
            'flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none disabled:opacity-60',
            dragOver
              ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/40'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/70 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-slate-500'
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm dark:bg-slate-800 dark:text-slate-500">
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Attach a screenshot <span className="text-slate-400 dark:text-slate-500">(optional)</span>
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-500">
            Click to browse, or drag &amp; drop · JPG, PNG or WebP · up to 5 MB
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}