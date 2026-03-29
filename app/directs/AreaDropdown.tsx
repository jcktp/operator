'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export default function AreaDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800 h-[38px]">
        <span className={value ? 'text-gray-900 dark:text-zinc-50' : 'text-gray-400 dark:text-zinc-500'}>{value || 'Select…'}</span>
        <ChevronDown size={14} className="text-gray-400 dark:text-zinc-500 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-md py-1 max-h-48 overflow-y-auto">
          {options.map(o => (
            <button key={o} type="button" onClick={() => { onChange(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-900 dark:text-zinc-50">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
