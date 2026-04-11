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
 <div className="relative"ref={ref}>
 <button type="button"onClick={() => setOpen(o => !o)}
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs text-left flex items-center justify-between focus:outline-none focus:ring-2 bg-[var(--surface)] h-[38px]">
 <span className={value ? 'text-[var(--text-bright)]' : 'text-[var(--text-muted)] '}>{value || 'Select…'}</span>
 <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
 </button>
 {open && (
 <div className="absolute z-20 mt-1 w-full bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-md py-1 max-h-48 overflow-y-auto">
 {options.map(o => (
 <button key={o} type="button"onClick={() => { onChange(o); setOpen(false) }}
 className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)] text-[var(--text-bright)]">
 {o}
 </button>
 ))}
 </div>
 )}
 </div>
 )
}
