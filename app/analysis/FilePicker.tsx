'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { ImageIcon, X, Expand } from 'lucide-react'

interface FilePickerProps {
  onChange: (file: File | null) => void
  value: File | null
  label?: string
  disabled?: boolean
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] rounded-[8px] overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="block max-w-[90vw] max-h-[90vh] object-contain"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          aria-label="Close"
        >
          <X size={14} />
        </button>
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-[11px] text-white truncate">{alt}</p>
        </div>
      </div>
    </div>
  )
}

export default function FilePicker({ onChange, value, label = 'Choose image', disabled = false }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    if (!value) {
      setPreview(null)
      setLightboxOpen(false)
      return
    }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null)
    e.target.value = ''
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const openLightbox = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setLightboxOpen(true)
  }, [])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      {/* When no image: full-area click-to-select */}
      {!preview ? (
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          disabled={disabled}
          className="relative flex flex-col items-center justify-center w-full min-h-[100px] rounded-[8px] border-2 border-dashed border-[var(--border-mid)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <div className="flex flex-col items-center gap-1.5 py-4 px-3 text-center">
            <ImageIcon size={20} className="text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-subtle)]">{label}</span>
            <span className="text-[11px] text-[var(--text-muted)]">PNG, JPG, WEBP</span>
          </div>
        </button>
      ) : (
        /* When image is loaded: thumbnail that's clickable to preview, with a "change" strip below */
        <div className="rounded-[8px] border-2 border-[var(--border-mid)] bg-[var(--surface-2)] overflow-hidden">
          {/* Image — click to open lightbox */}
          <button
            type="button"
            onClick={openLightbox}
            disabled={disabled}
            className="relative w-full h-[180px] block overflow-hidden group"
            title="Click to preview full image"
          >
            <img
              src={preview}
              alt={value?.name ?? 'Selected image'}
              className="w-full h-full object-contain bg-[var(--surface-3)]"
            />
            {/* Expand icon on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-1.5">
                <Expand size={14} className="text-white" />
              </span>
            </div>
          </button>
          {/* Bottom bar: filename + change button */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--surface-3)] border-t border-[var(--border)]">
            <span className="text-[11px] text-[var(--text-muted)] truncate flex-1">{value?.name}</span>
            <button
              type="button"
              onClick={() => !disabled && inputRef.current?.click()}
              disabled={disabled}
              className="shrink-0 text-[10px] font-medium text-[var(--text-body)] hover:text-[var(--blue)] transition-colors"
            >
              Change
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              className="shrink-0 text-[var(--text-muted)] hover:text-[var(--red)] transition-colors"
              aria-label="Remove image"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && preview && (
        <ImageLightbox
          src={preview}
          alt={value?.name ?? 'Image preview'}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}
