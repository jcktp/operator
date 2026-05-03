'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Ban, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMode } from '@/components/ModeContext'
import SelectField from '@/components/SelectField'

interface ActionItem {
 id: string; title: string; description: string | null; kind: string
 assignee: string | null; dueAt: string | null; priority: string; status: string
 source: string | null; notes: string | null; projectId: string | null; createdAt: string
}

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
const STATUSES = ['open', 'in_progress', 'done', 'deferred', 'cancelled'] as const

const PRIORITY_COLOR: Record<string, string> = {
 low: 'text-[var(--text-muted)]',
 medium: 'text-[var(--amber)]',
 high: 'text-orange-600',
 critical: 'text-[var(--red)]',
}
const STATUS_LABEL: Record<string, string> = {
 open: 'Open', in_progress: 'In progress', done: 'Done', deferred: 'Deferred', cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
 open: 'text-blue-600', in_progress: 'text-[var(--amber)]',
 done: 'text-emerald-600', deferred: 'text-[var(--text-muted)]',
 cancelled: 'text-[var(--border)]',
}

const inputCls = 'w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

function isOverdue(dueAt: string | null) {
 return dueAt ? new Date(dueAt) < new Date() : false
}

export default function ActionsClient() {
 useMode()
 const defaultKind = 'action'
 const pageTitle = 'Action Log'
 const addLabel = 'Add action'

 const [items, setItems] = useState<ActionItem[]>([])
 const [loading, setLoading] = useState(true)
 const [showForm, setShowForm] = useState(false)
 const [filterStatus, setFilterStatus] = useState<string>('open')
 const [filterKind, setFilterKind] = useState<string>('all')

 const [fTitle, setFTitle] = useState('')
 const [fDesc, setFDesc] = useState('')
 const [fKind, setFKind] = useState(defaultKind)
 const [fAssignee, setFAssignee] = useState('')
 const [fDue, setFDue] = useState('')
 const [fPriority, setFPriority] = useState('medium')
 const [fSource, setFSource] = useState('')
 const [saving, setSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const res = await fetch('/api/actions')
 if (res.ok) { const d = await res.json() as { items: ActionItem[] }; setItems(d.items) }
 } catch { /* silent */ } finally { setLoading(false) }
 }, [])

 useEffect(() => { void load() }, [load])

 const handleCreate = async () => {
 if (!fTitle.trim()) return
 setSaving(true)
 try {
 const res = await fetch('/api/actions', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ title: fTitle, description: fDesc, kind: fKind, assignee: fAssignee, dueAt: fDue || undefined, priority: fPriority, source: fSource }),
 })
 if (res.ok) {
 const d = await res.json() as { item: ActionItem }
 setItems(prev => [d.item, ...prev])
 setFTitle(''); setFDesc(''); setFKind(defaultKind); setFAssignee(''); setFDue(''); setFPriority('medium'); setFSource(''); setShowForm(false)
 }
 } catch { /* silent */ } finally { setSaving(false) }
 }

 const updateField = async (id: string, key: string, value: string) => {
 setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
 await fetch(`/api/actions/${id}`, {
 method: 'PATCH', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ [key]: value }),
 }).catch(() => {})
 }

 const handleDelete = async (id: string) => {
 setItems(prev => prev.filter(i => i.id !== id))
 await fetch(`/api/actions/${id}`, { method: 'DELETE' }).catch(() => {})
 }

 const PAGE_SIZE = 20
 const [page, setPage] = useState(1)

 const filtered = items.filter(i => {
 if (filterStatus !== 'all' && i.status !== filterStatus) return false
 if (filterKind !== 'all' && i.kind !== filterKind) return false
 return true
 })
 const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
 const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

 useEffect(() => { setPage(1) }, [filterStatus, filterKind])

 const openCount = items.filter(i => i.status === 'open' || i.status === 'in_progress').length

 if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /></div>

 return (
 <div className="max-w-3xl space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">{pageTitle}</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">{openCount} open item{openCount !== 1 ? 's' : ''}</p>
 </div>
 <button onClick={() => setShowForm(v => !v)}
 className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:bg-[var(--ink)] transition-colors">
 <Plus size={14} /> {addLabel}
 </button>
 </div>

 {/* Filters */}
 <div className="flex gap-3 flex-wrap">
 <div className="flex gap-1.5">
 {(['open', 'in_progress', 'done', 'all'] as const).map(s => (
 <button key={s} onClick={() => setFilterStatus(s)}
 className={cn('h-6 px-2.5 rounded-[4px] text-[11px] font-medium border transition-colors',
 filterStatus === s ? 'bg-[var(--ink)] text-[var(--ink-contrast)] border-transparent' : 'border-[var(--border)] text-[var(--text-muted)]')}>
 {s === 'all' ? 'All' : STATUS_LABEL[s]}
 </button>
 ))}
 </div>
 <div className="flex gap-1.5">
 {(['all', 'action', 'blocker'] as const).map(k => (
 <button key={k} onClick={() => setFilterKind(k)}
 className={cn('h-6 px-2.5 rounded-[4px] text-[11px] font-medium border transition-colors capitalize',
 filterKind === k ? 'bg-[var(--ink)] text-[var(--ink-contrast)] border-transparent' : 'border-[var(--border)] text-[var(--text-muted)]')}>
 {k === 'all' ? 'All types' : k + 's'}
 </button>
 ))}
 </div>
 </div>

 {showForm && (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">{addLabel}</h2>
 <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Title *" className={inputCls} />
 <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="Description" className={cn(inputCls, 'resize-none')} />
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Type</label>
 <SelectField
 value={fKind}
 onChange={setFKind}
 options={[{ value: 'action', label: 'Action' }, { value: 'blocker', label: 'Blocker' }]}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Priority</label>
 <SelectField
 value={fPriority}
 onChange={setFPriority}
 options={PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Assignee</label>
 <input value={fAssignee} onChange={e => setFAssignee(e.target.value)} placeholder="Who owns this?" className={inputCls} />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Due date</label>
 <input type="date" value={fDue} onChange={e => setFDue(e.target.value)} className={inputCls} />
 </div>
 <div className="col-span-2">
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Source</label>
 <input value={fSource} onChange={e => setFSource(e.target.value)} placeholder="e.g. Retro, 1-on-1, policy review" className={inputCls} />
 </div>
 </div>
 <div className="flex gap-2 pt-1">
 <button onClick={handleCreate} disabled={saving || !fTitle.trim()}
 className="h-7 px-3 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center gap-2">
 {saving && <Loader2 size={13} className="animate-spin" />} Add
 </button>
 <button onClick={() => setShowForm(false)} className="h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">Cancel</button>
 </div>
 </div>
 )}

 {visible.length === 0 ? (
 <div className="text-center py-12 text-[var(--text-muted)] text-sm">No items found.</div>
 ) : (
 <div className="space-y-2">
 {visible.map(item => {
 const overdue = isOverdue(item.dueAt) && item.status !== 'done' && item.status !== 'cancelled'
 const Icon = item.kind === 'blocker' ? Ban : ListChecks
 return (
 <div key={item.id} className={cn('bg-[var(--surface)] border rounded-[10px] p-4 space-y-2',
 overdue ? 'border-[var(--red)]' : 'border-[var(--border)]')}>
 <div className="flex items-start gap-3">
 <Icon size={15} className={cn('shrink-0 mt-0.5', PRIORITY_COLOR[item.priority])} />
 <div className="flex-1 min-w-0 space-y-1">
 <div className="flex items-center gap-2 flex-wrap">
 <p className={cn('text-sm font-medium', item.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-bright)]')}>{item.title}</p>
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)] capitalize">{item.kind}</span>
 {overdue && <span className="text-[10px] text-[var(--red)] font-medium">Overdue</span>}
 </div>
 {item.description && <p className="text-xs text-[var(--text-muted)]">{item.description}</p>}
 <div className="flex gap-3 flex-wrap text-[11px] text-[var(--text-muted)]">
 {item.assignee && <span>→ {item.assignee}</span>}
 {item.dueAt && <span className={overdue ? 'text-[var(--red)]' : ''}>{new Date(item.dueAt).toLocaleDateString()}</span>}
 {item.source && <span>From: {item.source}</span>}
 </div>
 <textarea defaultValue={item.notes ?? ''} onBlur={e => void updateField(item.id, 'notes', e.target.value)}
 rows={1} placeholder="Add notes…"
 className="w-full text-xs border border-[var(--border)] rounded-[4px] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30/50 resize-none" />
 </div>
 <SelectField
 value={item.status}
 onChange={v => void updateField(item.id, 'status', v)}
 options={STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] }))}
 className="w-28 shrink-0"
 />
 <button onClick={() => void handleDelete(item.id)} className="text-[var(--border)] hover:text-[var(--red)] transition-colors shrink-0">
 <Trash2 size={13} />
 </button>
 </div>
 </div>
 )
 })}
 </div>
 )}

 {totalPages > 1 && (
 <div className="flex items-center justify-between pt-2">
 <p className="text-[11px] text-[var(--text-muted)] font-mono">
 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
 </p>
 <div className="flex items-center gap-1">
 <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
 className="px-2 py-1 text-xs border border-[var(--border)] rounded disabled:opacity-40 hover:bg-[var(--surface-2)] transition-colors">
 ← Prev
 </button>
 <span className="text-[11px] font-mono text-[var(--text-muted)] px-2">{page}/{totalPages}</span>
 <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
 className="px-2 py-1 text-xs border border-[var(--border)] rounded disabled:opacity-40 hover:bg-[var(--surface-2)] transition-colors">
 Next →
 </button>
 </div>
 </div>
 )}
 </div>
 )
}
