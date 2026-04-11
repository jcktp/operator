'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export const TYPE_LABELS: Record<string, string> = {
 rss: 'RSS',
 reddit: 'Reddit',
 youtube: 'YouTube',
 bluesky: 'Bluesky',
 mastodon: 'Mastodon',
 webhook: 'Webhook',
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
 <div className="relative"ref={ref}>
 <button
 type="button"
 onClick={() => setOpen(o => !o)}
 className="border border-[var(--border)] rounded-[4px] px-3 py-1.5 text-sm text-left flex items-center gap-1.5 bg-[var(--surface)] text-[var(--text-body)] hover:bg-[var(--surface-2)] focus:outline-none focus:ring-2"
 >
 <span>{label}</span>
 <ChevronDown size={13} className="text-[var(--text-muted)] " />
 </button>
 {open && (
 <div className="absolute right-0 z-20 mt-1 w-40 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-md py-1">
 {REFRESH_OPTIONS.map(o => (
 <button
 key={o.value}
 type="button"
 onClick={() => { onChange(o.value); setOpen(false) }}
 className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)] ${value === o.value ? 'text-[var(--text-bright)] font-medium' : 'text-[var(--text-body)] '}`}
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
 <div className="relative"ref={ref}>
 <button
 type="button"
 onClick={() => setOpen(o => !o)}
 className={`w-full border border-[var(--border)] rounded-[4px] px-3 text-left flex items-center justify-between focus:outline-none focus:ring-2 bg-[var(--surface)] ${
 compact ? 'py-1 text-xs' : 'py-2 text-sm h-[38px]'
 }`}
 >
 <span className="text-[var(--text-bright)]">{TYPE_LABELS[value] ?? value}</span>
 <ChevronDown size={compact ? 11 : 14} className="text-[var(--text-muted)] " />
 </button>
 {open && (
 <div className="absolute z-20 mt-1 w-full bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-md py-1">
 {options.map(o => (
 <button
 key={o}
 type="button"
 onClick={() => { onChange(o); setOpen(false) }}
 className={`w-full text-left px-3 hover:bg-[var(--surface-2)] text-[var(--text-bright)] ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'}`}
 >
 {TYPE_LABELS[o]}
 </button>
 ))}
 </div>
 )}
 </div>
 )
}
