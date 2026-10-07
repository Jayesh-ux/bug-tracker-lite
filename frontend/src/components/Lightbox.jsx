import { useEffect } from 'react'
import { ZoomIn, X } from 'lucide-react'

export function Lightbox({ src, alt = 'Screenshot', onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Screenshot preview">
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" onClick={onClose} />
      <button
        onClick={onClose}
        className="btn-ghost-icon absolute top-4 right-4 z-10 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        aria-label="Close preview"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        onClick={onClose}
        className="relative max-w-full cursor-zoom-out focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
        tabIndex={0}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl"
          draggable={false}
        />
      </button>
    </div>
  )
}

export function Screenshot({ src, alt = 'Screenshot', onView }) {
  return (
    <button
      onClick={onView}
      className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:outline-none dark:border-slate-800"
      aria-label="View screenshot"
    >
      <img src={src} alt={alt} className="h-72 w-full object-cover" loading="lazy" />
      <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition group-hover:bg-slate-950/35 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm">
          <ZoomIn className="h-4 w-4" aria-hidden="true" />
          View
        </span>
      </span>
    </button>
  )
}