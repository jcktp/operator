'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Loader2, Save, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/lib/mode'
import Pagination from './KnowledgePagination'
import YouPanel from './YouPanel'
import GlossaryPanel from './GlossaryPanel'

const PAGE_SIZE = 10

interface AreaBriefing {
 id: string
 area: string
 mode: string
 content: string
 userNotes?: string | null
 reportCount: number
 updatedAt: string
}

// ── Area briefing card (collapsible) ─────────────────────────────────────────

function AreaBriefingCard({
 briefing, notes, onNotesChange, onRefresh, onClear, onSaveNotes,
 refreshing, clearing, saving,
}: {
 briefing: AreaBriefing
 notes: string
 onNotesChange: (v: string) => void
 onRefresh: () => void
 onClear: () => void
 onSaveNotes: () => void
 refreshing: boolean
 clearing: boolean
 saving: boolean
}) {
 const [open, setOpen] = useState(false)
 const notesChanged = notes !== (briefing.userNotes ?? '')

 return (
 <div className="border border-[var(--border)] rounded-[10px] overflow-hidden">
 {/* Header — always visible */}
 <div
 role="button"
 tabIndex={0}
 onClick={() => setOpen(v => !v)}
 onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(v => !v)}
 className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--surface-2)]/50 transition-colors cursor-pointer"
 >
 <div className="min-w-0">
 <p className="text-sm font-semibold text-[var(--text-bright)]">{briefing.area}</p>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 {briefing.reportCount} report{briefing.reportCount !== 1 ? 's' : ''} · updated {new Date(briefing.updatedAt).toLocaleDateString()}
 {briefing.userNotes && <span className="ml-1.5 text-[var(--blue)]">+ your notes</span>}
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <button
 type="button"
 onClick={e => { e.stopPropagation(); onRefresh() }}
 disabled={refreshing || clearing}
 className={cn('flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--surface-2)]', (refreshing || clearing) && 'opacity-50 pointer-events-none')}
 >
 <RefreshCw size={11} className={cn(refreshing && 'animate-spin')} />
 </button>
 <button
 type="button"
 onClick={e => { e.stopPropagation(); onClear() }}
 disabled={clearing || refreshing}
 className={cn('flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 text-xs text-[var(--red)] hover:bg-red-50', (clearing || refreshing) && 'opacity-50 pointer-events-none')}
 >
 {clearing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
 </button>
 <ChevronDown size={14} className={cn('text-[var(--text-muted)] transition-transform', open && 'rotate-180')} />
 </div>
 </div>

 {/* Expanded content */}
 {open && (
 <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)] pt-3">
 <p className="text-xs text-[var(--text-subtle)] leading-relaxed">{briefing.content}</p>
 <div className="space-y-1.5">
 <p className="text-xs font-medium text-[var(--text-muted)]">Your context for this area</p>
 <textarea
 value={notes}
 onChange={e => onNotesChange(e.target.value)}
 placeholder="Add background, context, or anything the AI should know about this area…"
 rows={3}
 className="w-full text-xs border border-[var(--border)] rounded-[4px] px-3 py-2 focus:outline-none focus:ring-2 resize-none"
 />
 {notesChanged && (
 <div className="flex justify-end">
 <button
 onClick={onSaveNotes}
 disabled={saving}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[var(--ink)] text-white text-xs font-medium disabled:opacity-40"
 >
 {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
 Save
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )
}

// ── Area knowledge panel ──────────────────────────────────────────────────────

function AreaKnowledgePanel() {
 const [briefings, setBriefings] = useState<AreaBriefing[]>([])
 const [loading, setLoading] = useState(true)
 const [refreshingArea, setRefreshingArea] = useState<string | null>(null)
 const [clearingArea, setClearingArea] = useState<string | null>(null)
 const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
 const [savingNotes, setSavingNotes] = useState<string | null>(null)
 const [page, setPage] = useState(0)

 useEffect(() => {
 fetch('/api/knowledge/briefings')
 .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() as Promise<{ briefings?: AreaBriefing[] }> })
 .then(d => {
 const list = d.briefings ?? []
 setBriefings(list)
 const notes: Record<string, string> = {}
 for (const b of list) notes[b.area] = b.userNotes ?? ''
 setEditingNotes(notes)
 })
 .catch(err => console.error('Failed to load area briefings:', err))
 .finally(() => setLoading(false))
 }, [])

 async function refresh(area: string) {
 setRefreshingArea(area)
 try {
 const res = await fetch('/api/knowledge/briefings/refresh', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ area }),
 })
 if (res.ok) {
 const updated = await fetch('/api/knowledge/briefings').then(r => r.json() as Promise<{ briefings?: AreaBriefing[] }>)
 setBriefings(updated.briefings ?? [])
 }
 } finally {
 setRefreshingArea(null)
 }
 }

 async function clearBriefing(area: string) {
 setClearingArea(area)
 try {
 await fetch('/api/knowledge/briefings', {
 method: 'DELETE',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ area }),
 })
 setBriefings(prev => {
 const next = prev.filter(b => b.area !== area)
 const maxPage = Math.max(0, Math.ceil(next.length / PAGE_SIZE) - 1)
 if (page > maxPage) setPage(maxPage)
 return next
 })
 } finally {
 setClearingArea(null)
 }
 }

 const saveNotes = useCallback(async (area: string) => {
 setSavingNotes(area)
 await fetch('/api/knowledge/briefings', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ area, notes: editingNotes[area] || null }),
 })
 setBriefings(prev => prev.map(b => b.area === area ? { ...b, userNotes: editingNotes[area] || null } : b))
 setSavingNotes(null)
 }, [editingNotes])

 if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /></div>

 if (briefings.length === 0) {
 return (
 <div className="text-center py-8 space-y-1">
 <p className="text-sm text-[var(--text-muted)]">No area briefings yet.</p>
 <p className="text-xs text-[var(--text-muted)]">Upload reports to any area and the AI will automatically build a context briefing for it.</p>
 </div>
 )
 }

 const pageBriefings = briefings.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

 return (
 <div className="space-y-3">
 <p className="text-xs text-[var(--text-muted)]">Auto-generated from your uploaded reports. You can also add your own context per area.</p>
 {pageBriefings.map(b => (
 <AreaBriefingCard
 key={b.id}
 briefing={b}
 notes={editingNotes[b.area] ?? ''}
 onNotesChange={v => setEditingNotes(prev => ({ ...prev, [b.area]: v }))}
 onRefresh={() => refresh(b.area)}
 onClear={() => clearBriefing(b.area)}
 onSaveNotes={() => saveNotes(b.area)}
 refreshing={refreshingArea === b.area}
 clearing={clearingArea === b.area}
 saving={savingNotes === b.area}
 />
 ))}

 <Pagination page={page} total={briefings.length} onPage={setPage} />
 </div>
 )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

type KnowledgePanel = 'you' | 'glossary' | 'area'

export default function SettingsKnowledgeTab({ appMode }: { appMode: AppMode }) {
 const [panel, setPanel] = useState<KnowledgePanel>('you')

 const panels: { id: KnowledgePanel; label: string }[] = [
 { id: 'you', label: 'You' },
 { id: 'glossary', label: 'Glossary' },
 { id: 'area', label: 'Area knowledge' },
 ]

 return (
 <div className="space-y-5">
 {/* Sub-tab bar */}
 <div className="flex gap-4 border-b border-[var(--border)]">
 {panels.map(p => (
 <button
 key={p.id}
 type="button"
 onClick={() => setPanel(p.id)}
 className={cn(
 'pb-2 text-xs font-medium transition-colors border-b-2 -mb-px',
 panel === p.id ? 'border-[var(--ink)] text-[var(--text-bright)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-subtle)]'
 )}
 >
 {p.label}
 </button>
 ))}
 </div>

 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
 {panel === 'you' && <><h2 className="text-sm font-semibold text-[var(--text-bright)] mb-4">Your context</h2><YouPanel /></>}
 {panel === 'glossary' && <><h2 className="text-sm font-semibold text-[var(--text-bright)] mb-4">Glossary</h2><GlossaryPanel appMode={appMode} /></>}
 {panel === 'area' && <><h2 className="text-sm font-semibold text-[var(--text-bright)] mb-4">Area knowledge</h2><AreaKnowledgePanel /></>}
 </div>
 </div>
 )
}
