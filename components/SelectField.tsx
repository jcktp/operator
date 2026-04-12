'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}

export default function SelectField({ value, onChange, options, placeholder = 'Select…', className }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="w-full flex items-center gap-2 rounded-[4px] pl-2.5 pr-2 py-1.5 text-xs cursor-pointer overflow-hidden transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
        style={{
          border:      '1px solid var(--border-mid)',
          background:  'var(--surface)',
          color:       'var(--text-body)',
        }}
      >
        <span
          className="flex-1 min-w-0 truncate text-left"
          style={{ color: selected ? 'var(--text-body)' : 'var(--text-muted)' }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={12} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 rounded-[4px] shadow-lg py-1 z-50 max-h-60 overflow-y-auto"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-mid)' }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-body)' }}
            >
              {opt.label}
              {opt.value === value && <Check size={11} className="shrink-0" style={{ color: 'var(--ink)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
