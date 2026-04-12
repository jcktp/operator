'use client'

import { Loader2 } from 'lucide-react'
import { PULSE_DIRECTORY, DIRECTORY_CATEGORIES } from '@/lib/pulse-directory'

interface Props {
 existingUrls: Set<string>
 dirCategory: string
 setDirCategory: (c: string) => void
 addingFromDir: Set<string>
 onAdd: (name: string, url: string) => void
}

export default function PulseFeedDirectory({ existingUrls, dirCategory, setDirCategory, addingFromDir, onAdd }: Props) {
 return (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
 <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Feed directory</h2>
 <span className="text-xs text-[var(--text-muted)]">{PULSE_DIRECTORY.length} sources</span>
 </div>
 <div className="px-5 py-2.5 border-b border-[var(--border)] flex gap-1.5 flex-wrap">
 {DIRECTORY_CATEGORIES.map(cat => (
 <button
 key={cat}
 onClick={() => setDirCategory(cat)}
 className={`text-xs px-2.5 py-1 rounded-[4px] border transition-colors ${
 dirCategory === cat
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] border-[var(--ink)]'
 : 'border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)]'
 }`}
 >
 {cat}
 </button>
 ))}
 </div>
 <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
 {PULSE_DIRECTORY.filter(e => dirCategory === 'All' || e.category === dirCategory).map(entry => {
 const alreadyAdded = existingUrls.has(entry.url)
 const isAdding = addingFromDir.has(entry.url)
 return (
 <div key={entry.url} className="flex items-center justify-between px-5 py-2.5 hover:bg-[var(--surface-2)]/60/60">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium text-[var(--text-bright)]">{entry.name}</span>
 <span className="text-[11px] text-[var(--text-muted)] border border-[var(--border)] rounded-[4px] px-1.5 py-px">{entry.category}</span>
 </div>
 </div>
 <button
 disabled={alreadyAdded || isAdding}
 onClick={() => onAdd(entry.name, entry.url)}
 className={`ml-3 shrink-0 text-xs font-medium px-2.5 py-1 rounded-[4px] border transition-colors ${
 alreadyAdded
 ? 'border-[var(--green)] text-[var(--green)] bg-[var(--green-dim)] cursor-default'
 : isAdding
 ? 'border-[var(--border)] text-[var(--text-muted)] cursor-wait'
 : 'border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--text-bright)]'
 }`}
 >
 {isAdding ? <Loader2 size={11} className="animate-spin" /> : alreadyAdded ? 'Added' : 'Add'}
 </button>
 </div>
 )
 })}
 </div>
 </div>
 )
}
