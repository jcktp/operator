'use client'
import { useRef, useEffect, useState } from 'react'
import { ImageIcon, X } from 'lucide-react'

interface FilePickerProps {
  onChange: (file: File | null) => void
  value: File | null
  label?: string
  disabled?: boolean
}

export default function FilePicker({ onChange, value, label = 'Choose image', disabled = false }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!value) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

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
      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled}
        className="relative flex flex-col items-center justify-center w-full min-h-[100px] rounded-[8px] border-2 border-dashed border-[var(--border-mid)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-40 disabled:pointer-events-none overflow-hidden"
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Selected"
              className="w-full h-full object-cover max-h-[160px]"
              style={{ display: 'block' }}
            />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/40">
              <p className="text-[11px] text-white truncate">{value?.name}</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-4 px-3 text-center">
            <ImageIcon size={20} className="text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-subtle)]">{label}</span>
            <span className="text-[11px] text-[var(--text-muted)]">PNG, JPG, WEBP</span>
          </div>
        )}
      </button>

      {value && (
        <button
          type="button"
          onClick={clear}
          className="absolute top-1.5 right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Remove image"
        >
          <X size={11} />
        </button>
      )}
    </div>
  )
}
