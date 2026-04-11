'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FoiaRequest {
 id: string
 agency: string
 subject: string
 description: string | null
 status: string
 filedAt: string | null
 dueAt: string | null
 receivedAt: string | null
 trackingNum: string | null
 notes: string | null
 projectId: string | null
 createdAt: string
}

const STATUSES = ['draft', 'submitted', 'acknowledged', 'partial', 'fulfilled', 'denied', 'appealed'] as const
type Status = typeof STATUSES[number]

const STATUS_COLORS: Record<Status, string> = {
 draft: 'bg-[var(--surface-2)] text-[var(--text-subtle)]',
 submitted: 'bg-blue-50 text-blue-700',
 acknowledged: 'bg-indigo-50 text-indigo-700',
 partial: 'bg-amber-50 text-amber-700',
 fulfilled: 'bg-emerald-50 text-emerald-700',
 denied: 'bg-red-50 text-red-700',
 appealed: 'bg-orange-50 text-orange-700',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
 if (!iso) return '—'
 return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(dueAt: string | null, status: string): boolean {
 if (!dueAt || status === 'fulfilled' || status === 'denied') return false
 return new Date(dueAt) < new Date()
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FoiaClient() {
 const [requests, setRequests] = useState<FoiaRequest[]>([])
 const [loading, setLoading] = useState(true)
 const [showForm, setShowForm] = useState(false)
 const [expandedId, setExpandedId] = useState<string | null>(null)

 // Form state
 const [fAgency, setFAgency] = useState('')
 const [fSubject, setFSubject] = useState('')
 const [fDesc, setFDesc] = useState('')
 const [fFiledAt, setFFiledAt] = useState('')
 const [fDueAt, setFDueAt] = useState('')
 const [fTrack, setFTrack] = useState('')
 const [saving, setSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const res = await fetch('/api/foia')
 if (res.ok) { const d = await res.json() as { requests: FoiaRequest[] }; setRequests(d.requests) }
 } catch { /* silent */ }
 finally { setLoading(false) }
 }, [])

 useEffect(() => { void load() }, [load])

 const handleCreate = async () => {
 if (!fAgency.trim() || !fSubject.trim()) return
 setSaving(true)
 try {
 const res = await fetch('/api/foia', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ agency: fAgency, subject: fSubject, description: fDesc, filedAt: fFiledAt || undefined, dueAt: fDueAt || undefined, trackingNum: fTrack || undefined }),
 })
 if (res.ok) {
 const d = await res.json() as { request: FoiaRequest }
 setRequests(prev => [d.request, ...prev])
 setFAgency(''); setFSubject(''); setFDesc(''); setFFiledAt(''); setFDueAt(''); setFTrack('')
 setShowForm(false)
 }
 } catch { /* silent */ }
 finally { setSaving(false) }
 }

 const updateStatus = async (id: string, status: string) => {
 setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
 await fetch(`/api/foia/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status }),
 }).catch(() => {})
 }

 const updateNotes = async (id: string, notes: string) => {
 setRequests(prev => prev.map(r => r.id === id ? { ...r, notes } : r))
 await fetch(`/api/foia/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ notes }),
 }).catch(() => {})
 }

 const handleDelete = async (id: string) => {
 setRequests(prev => prev.filter(r => r.id !== id))
 await fetch(`/api/foia/${id}`, { method: 'DELETE' }).catch(() => {})
 }

 const inputCls = 'w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

 if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /></div>

 return (
 <div className="max-w-3xl space-y-5">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">FOIA Tracker</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">Track public records requests and their status.</p>
 </div>
 <button onClick={() => setShowForm(v => !v)}
 className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink)] transition-colors">
 <Plus size={14} /> New request
 </button>
 </div>

 {/* New request form */}
 {showForm && (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">New FOIA Request</h2>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Agency *</label>
 <input value={fAgency} onChange={e => setFAgency(e.target.value)} placeholder="e.g. EPA, DOJ, NYPD" className={inputCls} />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Subject *</label>
 <input value={fSubject} onChange={e => setFSubject(e.target.value)} placeholder="Brief subject line" className={inputCls} />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Description</label>
 <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="What records are you requesting?" className={cn(inputCls, 'resize-none')} />
 </div>
 <div className="grid grid-cols-3 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Filed date</label>
 <input type="date" value={fFiledAt} onChange={e => setFFiledAt(e.target.value)} className={inputCls} />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Response due</label>
 <input type="date" value={fDueAt} onChange={e => setFDueAt(e.target.value)} className={inputCls} />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Tracking #</label>
 <input value={fTrack} onChange={e => setFTrack(e.target.value)} placeholder="Agency reference" className={inputCls} />
 </div>
 </div>
 <div className="flex gap-2 pt-1">
 <button onClick={handleCreate} disabled={saving || !fAgency.trim() || !fSubject.trim()}
 className="h-7 px-3 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center gap-2">
 {saving ? <Loader2 size={13} className="animate-spin" /> : null} Save
 </button>
 <button onClick={() => setShowForm(false)} className="h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">
 Cancel
 </button>
 </div>
 </div>
 )}

 {/* Requests list */}
 {requests.length === 0 ? (
 <div className="text-center py-12 text-[var(--text-muted)] text-sm">
 No FOIA requests yet. Add your first one above.
 </div>
 ) : (
 <div className="space-y-2">
 {requests.map(req => {
 const overdue = isOverdue(req.dueAt, req.status)
 const expanded = expandedId === req.id
 return (
 <div key={req.id} className={cn('bg-[var(--surface)] border rounded-[10px] overflow-hidden transition-colors', overdue ? 'border-red-200' : 'border-[var(--border)]')}>
 {/* Row */}
 <div className="flex items-center gap-3 px-4 py-3">
 <button onClick={() => setExpandedId(expanded ? null : req.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
 <ChevronDown size={14} className={cn('text-[var(--text-muted)] shrink-0 transition-transform', expanded && 'rotate-180')} />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-medium text-[var(--text-bright)] truncate">{req.agency}</span>
 <span className="text-xs text-[var(--text-muted)] truncate">— {req.subject}</span>
 </div>
 <div className="flex items-center gap-3 mt-0.5 flex-wrap">
 {req.trackingNum && <span className="text-[11px] font-mono text-[var(--text-muted)]">#{req.trackingNum}</span>}
 <span className="text-[11px] text-[var(--text-muted)]">Filed {fmtDate(req.filedAt)}</span>
 {req.dueAt && (
 <span className={cn('text-[11px]', overdue ? 'text-[var(--red)] font-medium' : 'text-[var(--text-muted)]')}>
 Due {fmtDate(req.dueAt)}{overdue ? ' — overdue' : ''}
 </span>
 )}
 </div>
 </div>
 </button>

 {/* Status selector */}
 <select
 value={req.status}
 onChange={e => void updateStatus(req.id, e.target.value)}
 className={cn('text-xs font-medium h-7 px-2 rounded-[4px] border-0 cursor-pointer focus:outline-none', STATUS_COLORS[req.status as Status] ?? STATUS_COLORS.draft)}
 >
 {STATUSES.map(s => <option key={s} value={s} className="bg-[var(--surface)] text-[var(--text-bright)] capitalize">{s}</option>)}
 </select>

 <button onClick={() => handleDelete(req.id)} className="text-[var(--border)] hover:text-[var(--red)] transition-colors shrink-0">
 <Trash2 size={13} />
 </button>
 </div>

 {/* Expanded detail */}
 {expanded && (
 <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-2">
 {req.description && <p className="text-xs text-[var(--text-subtle)] leading-relaxed">{req.description}</p>}
 <div>
 <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Notes</label>
 <textarea
 defaultValue={req.notes ?? ''}
 onBlur={e => void updateNotes(req.id, e.target.value)}
 rows={2}
 placeholder="Add notes…"
 className="w-full text-xs border border-[var(--border)] rounded-[4px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 resize-none"
 />
 </div>
 </div>
 )}
 </div>
 )
 })}
 </div>
 )}
 </div>
 )
}
