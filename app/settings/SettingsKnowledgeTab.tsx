'use client'

import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus, RefreshCw, Loader2, ChevronDown, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppMode } from '@/lib/mode'

const PAGE_SIZE = 10

interface GlossaryTerm {
 id: string
 term: string
 definition: string
 scope: string
 createdAt: string
}

interface AreaBriefing {
 id: string
 area: string
 mode: string
 content: string
 userNotes?: string | null
 reportCount: number
 updatedAt: string
}

// ── Pagination helper ─────────────────────────────────────────────────────────

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
 const pages = Math.ceil(total / PAGE_SIZE)
 if (pages <= 1) return null
 return (
 <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
 <span className="text-xs text-[var(--text-muted)]">{total} items · page {page + 1} of {pages}</span>
 <div className="flex gap-1">
 <button
 onClick={() => onPage(page - 1)}
 disabled={page === 0}
 className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-subtle)] disabled:opacity-30 disabled:cursor-default"
 >
 <ChevronLeft size={14} />
 </button>
 <button
 onClick={() => onPage(page + 1)}
 disabled={page >= pages - 1}
 className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-subtle)] disabled:opacity-30 disabled:cursor-default"
 >
 <ChevronRight size={14} />
 </button>
 </div>
 </div>
 )
}

// ── You panel (user memory) ───────────────────────────────────────────────────

function YouPanel() {
 const [facts, setFacts] = useState<string[]>([])
 const [loading, setLoading] = useState(true)
 const [newFact, setNewFact] = useState('')
 const [saving, setSaving] = useState(false)
 const [deletingFact, setDeletingFact] = useState<string | null>(null)
 const [page, setPage] = useState(0)

 useEffect(() => {
 fetch('/api/dispatch/memory')
 .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() as Promise<{ memory?: string }> })
 .then(d => {
 const raw = d.memory ?? ''
 setFacts(raw.split('\n').map(f => f.trim()).filter(Boolean))
 })
 .catch(err => console.error('Failed to load user memory:', err))
 .finally(() => setLoading(false))
 }, [])

 async function addFact() {
 const fact = newFact.trim()
 if (!fact) return
 setSaving(true)
 await fetch('/api/dispatch/memory', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ fact }),
 })
 setFacts(prev => [...prev, fact])
 setNewFact('')
 setSaving(false)
 setPage(Math.floor(facts.length / PAGE_SIZE))
 }

 async function deleteFact(fact: string) {
 setDeletingFact(fact)
 await fetch('/api/dispatch/memory', {
 method: 'DELETE',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ fact }),
 })
 setFacts(prev => {
 const next = prev.filter(f => f !== fact)
 const maxPage = Math.max(0, Math.ceil(next.length / PAGE_SIZE) - 1)
 if (page > maxPage) setPage(maxPage)
 return next
 })
 setDeletingFact(null)
 }

 async function clearAll() {
 await fetch('/api/dispatch/memory', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ memory: '' }),
 })
 setFacts([])
 setPage(0)
 }

 if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /></div>

 const pageFacts = facts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

 return (
 <div className="space-y-3">
 {/* Add fact — top */}
 <div className="flex gap-2">
 <input
 type="text"
 value={newFact}
 onChange={e => setNewFact(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && addFact()}
 placeholder="Add a fact the AI should remember…"
 className="flex-1 h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
 />
 <button
 onClick={addFact}
 disabled={saving || !newFact.trim()}
 className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] bg-[var(--ink)] text-white text-xs font-medium disabled:opacity-40"
 >
 {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
 Add
 </button>
 </div>

 <div className="flex items-center justify-between">
 <p className="text-xs text-[var(--text-muted)]">{facts.length} fact{facts.length !== 1 ? 's' : ''} stored</p>
 {facts.length > 0 && (
 <button onClick={clearAll} className="text-xs text-[var(--red)] hover:text-red-700">Clear all</button>
 )}
 </div>

 <div className="space-y-1.5">
 {pageFacts.map((fact, i) => (
 <div key={i} className="flex items-start gap-2 bg-[var(--surface-2)] rounded-[4px] px-3 py-2">
 <span className="flex-1 text-sm text-[var(--text-body)] leading-snug">{fact}</span>
 <button
 onClick={() => deleteFact(fact)}
 disabled={deletingFact === fact}
 className="text-[var(--text-muted)] hover:text-[var(--red)] shrink-0 mt-0.5"
 >
 {deletingFact === fact ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
 </button>
 </div>
 ))}
 {facts.length === 0 && (
 <p className="text-xs text-[var(--text-muted)] py-2">No facts stored yet. The AI saves facts automatically during Dispatch, or add one above.</p>
 )}
 </div>

 <Pagination page={page} total={facts.length} onPage={setPage} />
 </div>
 )
}

// ── Glossary panel ────────────────────────────────────────────────────────────

const SCOPE_OPTIONS = [
 { value: 'global', label: 'Global (all modes)' },
 { value: 'mode:executive', label: 'Executive mode' },
 { value: 'mode:human_resources', label: 'Human Resources mode' },
 { value: 'mode:journalism', label: 'Journalism mode' },
 { value: 'mode:team_lead', label: 'Team Lead mode' },
 { value: 'mode:market_research', label: 'Market Research mode' },
 { value: 'mode:legal', label: 'Legal mode' },
]

function scopeLabel(scope: string): string {
 if (scope === 'global') return 'Global'
 if (scope.startsWith('mode:')) return scope.replace('mode:', '') + ' mode'
 if (scope.startsWith('area:')) return 'Area: ' + scope.replace('area:', '')
 return scope
}

function GlossaryPanel({ appMode }: { appMode: AppMode }) {
 const [terms, setTerms] = useState<GlossaryTerm[]>([])
 const [loading, setLoading] = useState(true)
 const [newTerm, setNewTerm] = useState('')
 const [newDef, setNewDef] = useState('')
 const [newScope, setNewScope] = useState('global')
 const [saving, setSaving] = useState(false)
 const [deletingId, setDeletingId] = useState<string | null>(null)
 const [page, setPage] = useState(0)

 const modeScope = `mode:${appMode}`

 useEffect(() => {
 fetch('/api/knowledge/glossary')
 .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() as Promise<{ terms?: GlossaryTerm[] }> })
 .then(d => setTerms(d.terms ?? []))
 .catch(err => console.error('Failed to load glossary:', err))
 .finally(() => setLoading(false))
 }, [])

 // Filter to global + current mode terms only
 const visibleTerms = terms.filter(t => t.scope === 'global' || t.scope === modeScope || t.scope.startsWith('area:'))

 async function addTerm() {
 if (!newTerm.trim() || !newDef.trim()) return
 setSaving(true)
 const res = await fetch('/api/knowledge/glossary', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ term: newTerm.trim(), definition: newDef.trim(), scope: newScope }),
 })
 const data = await res.json() as { term?: GlossaryTerm }
 if (data.term) {
 setTerms(prev => [...prev.filter(t => t.id !== data.term!.id), data.term!].sort((a, b) => a.scope.localeCompare(b.scope) || a.term.localeCompare(b.term)))
 }
 setNewTerm('')
 setNewDef('')
 setSaving(false)
 }

 async function deleteTerm(id: string) {
 setDeletingId(id)
 await fetch('/api/knowledge/glossary', {
 method: 'DELETE',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ id }),
 })
 setTerms(prev => {
 const next = prev.filter(t => t.id !== id)
 const maxPage = Math.max(0, Math.ceil(next.filter(t => t.scope === 'global' || t.scope === modeScope || t.scope.startsWith('area:')).length / PAGE_SIZE) - 1)
 if (page > maxPage) setPage(maxPage)
 return next
 })
 setDeletingId(null)
 }

 if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /></div>

 const pageTerms = visibleTerms.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

 // Group only page slice by scope
 const grouped: Record<string, GlossaryTerm[]> = {}
 for (const t of pageTerms) {
 grouped[t.scope] = grouped[t.scope] ?? []
 grouped[t.scope].push(t)
 }

 return (
 <div className="space-y-4">
 {/* Add term — top */}
 <div className="border border-[var(--border)] rounded-[10px] p-3 space-y-2">
 <p className="text-xs font-medium text-[var(--text-body)]">Add term</p>
 <div className="flex gap-2">
 <input
 type="text"
 value={newTerm}
 onChange={e => setNewTerm(e.target.value)}
 placeholder="Term (e.g. ARR)"
 className="w-32 h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
 />
 <input
 type="text"
 value={newDef}
 onChange={e => setNewDef(e.target.value)}
 onKeyDown={e => e.key === 'Enter' && addTerm()}
 placeholder="Definition"
 className="flex-1 h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
 />
 </div>
 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <select
 value={newScope}
 onChange={e => setNewScope(e.target.value)}
 className="w-full appearance-none h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 pr-8"
 >
 {SCOPE_OPTIONS.map(o => (
 <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
 </div>
 <button
 onClick={addTerm}
 disabled={saving || !newTerm.trim() || !newDef.trim()}
 className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] bg-[var(--ink)] text-white text-xs font-medium disabled:opacity-40 shrink-0"
 >
 {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
 Add
 </button>
 </div>
 </div>

 <p className="text-xs text-[var(--text-muted)]">{visibleTerms.length} term{visibleTerms.length !== 1 ? 's' : ''} · global + {appMode.replace('_', ' ')} mode</p>

 <div className="space-y-4">
 {Object.entries(grouped).map(([scope, scopeTerms]) => (
 <div key={scope}>
 <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1.5">{scopeLabel(scope)}</p>
 <div className="space-y-1">
 {scopeTerms.map(t => (
 <div key={t.id} className="flex items-center gap-2 bg-[var(--surface-2)] rounded-[4px] px-3 py-2">
 <span className="text-sm font-medium text-[var(--text-bright)] w-28 shrink-0">{t.term}</span>
 <span className="flex-1 text-sm text-[var(--text-subtle)]">{t.definition}</span>
 <button
 onClick={() => deleteTerm(t.id)}
 disabled={deletingId === t.id}
 className="text-[var(--text-muted)] hover:text-[var(--red)] shrink-0"
 >
 {deletingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
 </button>
 </div>
 ))}
 </div>
 </div>
 ))}
 {visibleTerms.length === 0 && (
 <p className="text-xs text-[var(--text-muted)] py-2">No terms yet for this mode. Add your first term above.</p>
 )}
 </div>

 <Pagination page={page} total={visibleTerms.length} onPage={setPage} />
 </div>
 )
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
