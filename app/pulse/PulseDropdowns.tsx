'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export const TYPE_LABELS: Record<string, string> = {
  rss:      'RSS',
  reddit:   'Reddit',
  youtube:  'YouTube',
  bluesky:  'Bluesky',
  mastodon: 'Mastodon',
  webhook:  'Webhook',
}

const REFRESH_OPTIONS = [
  { value: 0, label: 'No auto-refresh' },
  { value: 5, label: 'Every 5 min' },
  { value: 15, label: 'Every 15 min' },
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Every hour' },
]

export function RefreshDropdown({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label = REFRESH_OPTIONS.find(o => o.value === value)?.label ?? 'No auto-refresh'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-left flex items-center gap-1.5 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400"
      >
        <span>{label}</span>
        <ChevronDown size={13} className="text-gray-400 dark:text-zinc-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-md py-1">
          {REFRESH_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-zinc-800 ${value === o.value ? 'text-gray-900 dark:text-zinc-50 font-medium' : 'text-gray-700 dark:text-zinc-200'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TypeDropdown({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = ['rss', 'reddit', 'youtube', 'bluesky', 'mastodon', 'webhook']

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-900 ${
          compact ? 'py-1 text-xs' : 'py-2 text-sm h-[38px]'
        }`}
      >
        <span className="text-gray-900 dark:text-zinc-50">{TYPE_LABELS[value] ?? value}</span>
        <ChevronDown size={compact ? 11 : 14} className="text-gray-400 dark:text-zinc-500" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-md py-1">
          {options.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-900 dark:text-zinc-50 ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'}`}
            >
              {TYPE_LABELS[o]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
