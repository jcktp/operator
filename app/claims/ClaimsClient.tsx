'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import SelectField from '@/components/SelectField'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Claim {
 id: string
 text: string
 source: string | null
 sourceType: string
 status: string
 notes: string | null
 reportId: string | null
 report: { id: string; title: string } | null
 createdAt: string
}

const STATUSES = ['unverified', 'verified', 'disputed', 'false', 'needs_more'] as const
type ClaimStatus = typeof STATUSES[number]

const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
 unverified: { label: 'Unverified', color: 'text-[var(--text-muted)]', icon: Circle },
 verified: { label: 'Verified', color: 'text-emerald-600', icon: CheckCircle2 },
 disputed: { label: 'Disputed', color: 'text-[var(--amber)]', icon: AlertTriangle },
 false: { label: 'False', color: 'text-[var(--red)]', icon: XCircle },
 needs_more: { label: 'Needs more', color: 'text-blue-600', icon: HelpCircle },
}

const SOURCE_TYPES = ['document', 'interview', 'social', 'official'] as const

// ── Main component ────────────────────────────────────────────────────────────

export default function ClaimsClient() {
 const [claims, setClaims] = useState<Claim[]>([])
 const [loading, setLoading] = useState(true)
 const [filterStatus, setFilter] = useState<ClaimStatus | 'all'>('all')
 const [showForm, setShowForm] = useState(false)

 // Form state
 const [fText, setFText] = useState('')
 const [fSource, setFSource] = useState('')
 const [fSourceType, setFSourceType] = useState<string>('document')
 const [saving, setSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const res = await fetch('/api/claims')
 if (res.ok) { const d = await res.json() as { claims: Claim[] }; setClaims(d.claims) }
 } catch { /* silent */ }
 finally { setLoading(false) }
 }, [])

 useEffect(() => { void load() }, [load])

 const handleCreate = async () => {
 if (!fText.trim()) return
 setSaving(true)
 try {
 const res = await fetch('/api/claims', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ text: fText, source: fSource || undefined, sourceType: fSourceType }),
 })
 if (res.ok) {
 const d = await res.json() as { claim: Claim }
 setClaims(prev => [d.claim, ...prev])
 setFText(''); setFSource(''); setFSourceType('document')
 setShowForm(false)
 }
 } catch { /* silent */ }
 finally { setSaving(false) }
 }

 const updateStatus = async (id: string, status: string) => {
 setClaims(prev => prev.map(c => c.id === id ? { ...c, status } : c))
 await fetch(`/api/claims/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status }),
 }).catch(() => {})
 }

 const updateNotes = async (id: string, notes: string) => {
 setClaims(prev => prev.map(c => c.id === id ? { ...c, notes } : c))
 await fetch(`/api/claims/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ notes }),
 }).catch(() => {})
 }

 const handleDelete = async (id: string) => {
 setClaims(prev => prev.filter(c => c.id !== id))
 await fetch(`/api/claims/${id}`, { method: 'DELETE' }).catch(() => {})
 }

 const visible = filterStatus === 'all' ? claims : claims.filter(c => c.status === filterStatus)

 const inputCls = 'w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

 if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /></div>

 // Counts per status
 const counts = Object.fromEntries(STATUSES.map(s => [s, claims.filter(c => c.status === s).length]))

 return (
 <div className="max-w-3xl space-y-5">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Claims Tracker</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">Track factual claims and their verification status.</p>
 </div>
 <button onClick={() => setShowForm(v => !v)}
 className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink)] transition-colors">
 <Plus size={14} /> Add claim
 </button>
 </div>

 {/* Status filter pills */}
 <div className="flex items-center gap-1.5 flex-wrap">
 <button onClick={() => setFilter('all')}
 className={cn('h-6 px-2.5 rounded-[4px] text-[11px] font-medium transition-colors border', filterStatus === 'all' ? 'bg-[var(--ink)] text-white border-transparent' : 'border-[var(--border)] text-[var(--text-muted)]')}>
 All ({claims.length})
 </button>
 {STATUSES.map(s => {
 const cfg = STATUS_CONFIG[s]
 const Icon = cfg.icon
 return (
 <button key={s} onClick={() => setFilter(s)}
 className={cn('flex items-center gap-1 h-6 px-2.5 rounded-[4px] text-[11px] font-medium transition-colors border', filterStatus === s ? 'bg-[var(--ink)] text-white border-transparent' : 'border-[var(--border)] text-[var(--text-muted)]')}>
 <Icon size={9} /> {cfg.label} ({counts[s] ?? 0})
 </button>
 )
 })}
 </div>

 {/* Add claim form */}
 {showForm && (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Add Claim</h2>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Claim *</label>
 <textarea value={fText} onChange={e => setFText(e.target.value)} rows={2} placeholder="The exact claim to track…" className={cn(inputCls, 'resize-none')} />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Source</label>
 <input value={fSource} onChange={e => setFSource(e.target.value)} placeholder="Who made this claim?" className={inputCls} />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Source type</label>
 <SelectField
   value={fSourceType}
   onChange={setFSourceType}
   options={SOURCE_TYPES.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
 />
 </div>
 </div>
 <div className="flex gap-2 pt-1">
 <button onClick={handleCreate} disabled={saving || !fText.trim()}
 className="h-7 px-3 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center gap-2">
 {saving ? <Loader2 size={13} className="animate-spin" /> : null} Add
 </button>
 <button onClick={() => setShowForm(false)} className="h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">
 Cancel
 </button>
 </div>
 </div>
 )}

 {/* Claims list */}
 {visible.length === 0 ? (
 <div className="text-center py-12 text-[var(--text-muted)] text-sm">
 {filterStatus === 'all' ? 'No claims yet. Add the first one above.' : `No ${STATUS_CONFIG[filterStatus as ClaimStatus]?.label?.toLowerCase()} claims.`}
 </div>
 ) : (
 <div className="space-y-2">
 {visible.map(claim => {
 const cfg = STATUS_CONFIG[claim.status as ClaimStatus] ?? STATUS_CONFIG.unverified
 const Icon = cfg.icon
 return (
 <div key={claim.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 space-y-2">
 <div className="flex items-start gap-3">
 {/* Status icon */}
 <Icon size={16} className={cn('shrink-0 mt-0.5', cfg.color)} />

 <div className="flex-1 min-w-0 space-y-1.5">
 <p className="text-sm text-[var(--text-body)] leading-relaxed">{claim.text}</p>

 <div className="flex items-center gap-3 flex-wrap">
 {claim.source && (
 <span className="text-[11px] text-[var(--text-muted)]">
 {claim.source} <span className="text-[var(--border)]">· {claim.sourceType}</span>
 </span>
 )}
 {claim.report && (
 <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]">
 via {claim.report.title}
 </span>
 )}
 </div>

 {/* Notes */}
 <textarea
 defaultValue={claim.notes ?? ''}
 onBlur={e => void updateNotes(claim.id, e.target.value)}
 rows={1}
 placeholder="Add notes…"
 className="w-full text-xs border border-[var(--border)] rounded-[4px] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30/50 resize-none"
 />
 </div>

 {/* Status dropdown */}
 <SelectField
   value={claim.status}
   onChange={v => void updateStatus(claim.id, v)}
   options={STATUSES.map(s => ({ value: s, label: STATUS_CONFIG[s].label }))}
   className="w-36 shrink-0"
 />

 <button onClick={() => handleDelete(claim.id)} className="text-[var(--border)] hover:text-[var(--red)] transition-colors shrink-0">
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
