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
        className="w-full flex items-center gap-2 border border-gray-200 dark:border-zinc-700 rounded-lg pl-3 pr-2.5 py-2 text-sm bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 cursor-pointer overflow-hidden"
      >
        <span className={`flex-1 min-w-0 truncate text-left ${selected ? '' : 'text-gray-400 dark:text-zinc-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 text-gray-400 dark:text-zinc-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 z-50 max-h-60 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors text-left"
            >
              {opt.label}
              {opt.value === value && <Check size={12} className="text-indigo-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
