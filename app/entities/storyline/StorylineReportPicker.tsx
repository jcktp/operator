'use client'

import { useState } from 'react'
import { Search, Check } from 'lucide-react'
import { AreaBadge } from '@/components/Badge'

export interface PickerReport {
 id: string
 title: string
 area: string
 createdAt: string
}

interface Props {
 reports: PickerReport[]
 selected: string[]
 onChange: (ids: string[]) => void
}

export default function StorylineReportPicker({ reports, selected, onChange }: Props) {
 const [query, setQuery] = useState('')

 const filtered = query.trim()
 ? reports.filter(r =>
 r.title.toLowerCase().includes(query.toLowerCase()) ||
 r.area.toLowerCase().includes(query.toLowerCase())
 )
 : reports

 const toggle = (id: string) => {
 onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
 }

 return (
 <div className="space-y-2">
 <div className="relative">
 <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
 <input
 value={query}
 onChange={e => setQuery(e.target.value)}
 placeholder="Search documents…"
 className="w-full border border-[var(--border)] rounded-[4px] pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ink)] bg-[var(--surface)] text-[var(--text-body)]"
 />
 </div>
 <div className="max-h-60 overflow-y-auto space-y-1 border border-[var(--border)] rounded-[4px] p-1">
 {filtered.length === 0 && (
 <p className="text-xs text-[var(--text-muted)] text-center py-4">No documents found</p>
 )}
 {filtered.map(r => {
 const isSelected = selected.includes(r.id)
 return (
 <button
 key={r.id}
 onClick={() => toggle(r.id)}
 className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[4px] text-left transition-colors ${
 isSelected
 ? 'bg-[var(--ink)]'
 : 'hover:bg-[var(--surface-2)]'
 }`}
 >
 <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
 isSelected
 ? 'bg-[var(--surface)] border-transparent'
 : 'border-[var(--border-mid)]'
 }`}>
 {isSelected && <Check size={10} className="text-white" />}
 </div>
 <AreaBadge area={r.area} />
 <span className={`flex-1 text-xs truncate ${isSelected ? 'text-white font-medium' : 'text-[var(--text-body)]'}`}>
 {r.title}
 </span>
 </button>
 )
 })}
 </div>
 {selected.length > 0 && (
 <p className="text-xs text-[var(--text-subtle)]">{selected.length} document{selected.length !== 1 ? 's' : ''} selected</p>
 )}
 </div>
 )
}
