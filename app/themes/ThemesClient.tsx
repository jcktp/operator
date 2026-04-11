'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Theme {
 id: string; title: string; description: string | null; status: string
 notes: string | null; projectId: string | null; createdAt: string
}

const STATUSES = ['candidate', 'confirmed', 'rejected'] as const

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
 candidate: { label: 'Candidate', color: 'text-[var(--amber)]', bg: 'bg-[var(--amber-dim)] border-[var(--amber)]' },
 confirmed: { label: 'Confirmed', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
 rejected: { label: 'Rejected', color: 'text-[var(--border)] ', bg: 'bg-[var(--surface-2)] border-[var(--border)] ' },
}

const inputCls = 'w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

export default function ThemesClient() {
 const [themes, setThemes] = useState<Theme[]>([])
 const [loading, setLoading] = useState(true)
 const [showForm, setShowForm] = useState(false)
 const [filter, setFilter] = useState('all')

 const [fTitle, setFTitle] = useState('')
 const [fDesc, setFDesc] = useState('')
 const [saving, setSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const res = await fetch('/api/themes')
 if (res.ok) { const d = await res.json() as { themes: Theme[] }; setThemes(d.themes) }
 } catch { /* silent */ } finally { setLoading(false) }
 }, [])

 useEffect(() => { void load() }, [load])

 const handleCreate = async () => {
 if (!fTitle.trim()) return
 setSaving(true)
 try {
 const res = await fetch('/api/themes', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ title: fTitle, description: fDesc }),
 })
 if (res.ok) {
 const d = await res.json() as { theme: Theme }
 setThemes(prev => [d.theme, ...prev])
 setFTitle(''); setFDesc(''); setShowForm(false)
 }
 } catch { /* silent */ } finally { setSaving(false) }
 }

 const updateField = async (id: string, key: string, value: string) => {
 setThemes(prev => prev.map(t => t.id === id ? { ...t, [key]: value } : t))
 await fetch(`/api/themes/${id}`, {
 method: 'PATCH', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ [key]: value }),
 }).catch(() => {})
 }

 const handleDelete = async (id: string) => {
 setThemes(prev => prev.filter(t => t.id !== id))
 await fetch(`/api/themes/${id}`, { method: 'DELETE' }).catch(() => {})
 }

 const visible = filter === 'all' ? themes : themes.filter(t => t.status === filter)

 const counts = Object.fromEntries(STATUSES.map(s => [s, themes.filter(t => t.status === s).length]))

 if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /></div>

 return (
 <div className="max-w-3xl space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Themes Board</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">
 Synthesise recurring patterns across your research — confirm, develop, or reject each theme.
 </p>
 </div>
 <button onClick={() => setShowForm(v => !v)}
 className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink)] transition-colors">
 <Plus size={14} /> Add theme
 </button>
 </div>

 {/* Summary row */}
 <div className="grid grid-cols-3 gap-3">
 {STATUSES.map(s => (
 <button key={s} onClick={() => setFilter(prev => prev === s ? 'all' : s)}
 className={cn('rounded-[10px] border p-3 text-left transition-all', filter === s ? STATUS_CONFIG[s].bg : 'bg-[var(--surface)] border-[var(--border)]')}>
 <div className={cn('text-xl font-semibold', STATUS_CONFIG[s].color)}>{counts[s] ?? 0}</div>
 <div className="text-xs text-[var(--text-muted)] mt-0.5">{STATUS_CONFIG[s].label}</div>
 </button>
 ))}
 </div>

 {showForm && (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Add Theme</h2>
 <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Theme title * "className={inputCls} />
 <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2}
 placeholder="Describe this pattern — where does it appear, what evidence supports it? "className={cn(inputCls, 'resize-none')} />
 <div className="flex gap-2 pt-1">
 <button onClick={handleCreate} disabled={saving || !fTitle.trim()}
 className="h-7 px-3 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center gap-2">
 {saving && <Loader2 size={13} className="animate-spin" />} Add
 </button>
 <button onClick={() => setShowForm(false)} className="h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">Cancel</button>
 </div>
 </div>
 )}

 {visible.length === 0 ? (
 <div className="text-center py-12 text-[var(--text-muted)] text-sm">No themes yet. Add candidate themes as you spot patterns across interviews.</div>
 ) : (
 <div className="space-y-2">
 {visible.map(theme => {
 const cfg = STATUS_CONFIG[theme.status]
 return (
 <div key={theme.id} className={cn('border rounded-[10px] p-4 space-y-2', cfg.bg)}>
 <div className="flex items-start gap-3">
 <Layers size={15} className={cn('shrink-0 mt-0.5', cfg.color)} />
 <div className="flex-1 min-w-0 space-y-1.5">
 <p className="text-sm font-medium text-[var(--text-bright)]">{theme.title}</p>
 {theme.description && <p className="text-xs text-[var(--text-subtle)] leading-relaxed">{theme.description}</p>}
 <textarea defaultValue={theme.notes ?? ''} onBlur={e => void updateField(theme.id, 'notes', e.target.value)}
 rows={1} placeholder="Add evidence, quotes, or supporting observations…"
 className="w-full text-xs border border-[var(--border)] rounded-[4px] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 /50 resize-none bg-[var(--surface)]/60" />
 </div>
 <div className="flex gap-1.5 shrink-0">
 {STATUSES.map(s => (
 <button key={s} onClick={() => void updateField(theme.id, 'status', s)}
 className={cn('text-[10px] px-2 py-1 rounded-[4px] border transition-colors font-medium',
 theme.status === s ? cn(STATUS_CONFIG[s].bg, STATUS_CONFIG[s].color) : 'border-[var(--border)] text-[var(--text-muted)] bg-[var(--surface)]')}>
 {STATUS_CONFIG[s].label}
 </button>
 ))}
 </div>
 <button onClick={() => void handleDelete(theme.id)} className="text-[var(--border)] hover:text-[var(--red)] transition-colors shrink-0">
 <Trash2 size={13} />
 </button>
 </div>
 </div>
 )
 })}
 </div>
 )}
 </div>
 )
}
