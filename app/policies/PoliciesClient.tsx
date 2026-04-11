'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, ScrollText, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Policy {
 id: string; title: string; description: string | null; owner: string | null
 category: string; status: string; lastReviewedAt: string | null
 nextReviewAt: string | null; notes: string | null; createdAt: string
}

const STATUSES = ['draft', 'active', 'under_review', 'archived'] as const
const CATEGORIES = [
 'general', 'recruitment', 'compensation', 'conduct', 'health_safety',
 'performance', 'leave', 'data_privacy', 'dei', 'offboarding',
]

const STATUS_LABEL: Record<string, string> = {
 draft: 'Draft', active: 'Active', under_review: 'Under review', archived: 'Archived',
}
const STATUS_COLOR: Record<string, string> = {
 draft: 'text-[var(--text-muted)]',
 active: 'text-emerald-600',
 under_review: 'text-[var(--amber)]',
 archived: 'text-[var(--border)]',
}

const CATEGORY_LABEL: Record<string, string> = {
 general: 'General', recruitment: 'Recruitment & Selection',
 compensation: 'Compensation & Benefits', conduct: 'Conduct & Ethics',
 health_safety: 'Health & Safety', performance: 'Performance Management',
 leave: 'Leave & Absence', data_privacy: 'Data Privacy',
 dei: 'DEI', offboarding: 'Offboarding',
}

const inputCls = 'w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

function isDueForReview(nextReviewAt: string | null) {
 if (!nextReviewAt) return false
 const d = new Date(nextReviewAt)
 const soon = new Date(); soon.setDate(soon.getDate() + 30)
 return d <= soon
}

export default function PoliciesClient() {
 const [policies, setPolicies] = useState<Policy[]>([])
 const [loading, setLoading] = useState(true)
 const [showForm, setShowForm] = useState(false)
 const [filter, setFilter] = useState('all')

 const [fTitle, setFTitle] = useState('')
 const [fDesc, setFDesc] = useState('')
 const [fOwner, setFOwner] = useState('')
 const [fCategory, setFCategory] = useState('general')
 const [fStatus, setFStatus] = useState('active')
 const [fLastReview, setFLastReview] = useState('')
 const [fNextReview, setFNextReview] = useState('')
 const [saving, setSaving] = useState(false)

 const load = useCallback(async () => {
 setLoading(true)
 try {
 const res = await fetch('/api/policies')
 if (res.ok) { const d = await res.json() as { policies: Policy[] }; setPolicies(d.policies) }
 } catch { /* silent */ } finally { setLoading(false) }
 }, [])

 useEffect(() => { void load() }, [load])

 const handleCreate = async () => {
 if (!fTitle.trim()) return
 setSaving(true)
 try {
 const res = await fetch('/api/policies', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ title: fTitle, description: fDesc, owner: fOwner, category: fCategory, status: fStatus, lastReviewedAt: fLastReview || undefined, nextReviewAt: fNextReview || undefined }),
 })
 if (res.ok) {
 const d = await res.json() as { policy: Policy }
 setPolicies(prev => [...prev, d.policy].sort((a, b) => a.title.localeCompare(b.title)))
 setFTitle(''); setFDesc(''); setFOwner(''); setFCategory('general'); setFStatus('active'); setFLastReview(''); setFNextReview(''); setShowForm(false)
 }
 } catch { /* silent */ } finally { setSaving(false) }
 }

 const updateField = async (id: string, key: string, value: string) => {
 setPolicies(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p))
 await fetch(`/api/policies/${id}`, {
 method: 'PATCH', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ [key]: value }),
 }).catch(() => {})
 }

 const handleDelete = async (id: string) => {
 setPolicies(prev => prev.filter(p => p.id !== id))
 await fetch(`/api/policies/${id}`, { method: 'DELETE' }).catch(() => {})
 }

 const visible = filter === 'all' ? policies : filter === 'due'
 ? policies.filter(p => isDueForReview(p.nextReviewAt))
 : policies.filter(p => p.status === filter)

 const dueCount = policies.filter(p => isDueForReview(p.nextReviewAt) && p.status !== 'archived').length

 if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /></div>

 return (
 <div className="max-w-3xl space-y-5">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Policy Register</h1>
 <p className="text-sm text-[var(--text-muted)] mt-0.5">
 {policies.filter(p => p.status === 'active').length} active policies
 {dueCount > 0 && <span className="text-[var(--amber)]"> · {dueCount} due for review</span>}
 </p>
 </div>
 <button onClick={() => setShowForm(v => !v)}
 className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-white hover:bg-[var(--ink)] transition-colors">
 <Plus size={14} /> Add policy
 </button>
 </div>

 <div className="flex gap-1.5 flex-wrap">
 {(['all', 'due', ...STATUSES] as const).map(s => (
 <button key={s} onClick={() => setFilter(s)}
 className={cn('h-6 px-2.5 rounded-[4px] text-[11px] font-medium border transition-colors',
 filter === s ? 'bg-[var(--ink)] text-white border-transparent' : 'border-[var(--border)] text-[var(--text-muted)]',
 s === 'due' && dueCount > 0 && filter !== 'due' ? 'border-amber-300 text-[var(--amber)]' : '')}>
 {s === 'all' ? `All (${policies.length})` : s === 'due' ? `Due for review (${dueCount})` : STATUS_LABEL[s]}
 </button>
 ))}
 </div>

 {showForm && (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Add Policy</h2>
 <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Policy title *" className={inputCls} />
 <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="Brief description" className={cn(inputCls, 'resize-none')} />
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Category</label>
 <select value={fCategory} onChange={e => setFCategory(e.target.value)} className={inputCls}>
 {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Status</label>
 <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inputCls}>
 {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Owner</label>
 <input value={fOwner} onChange={e => setFOwner(e.target.value)} placeholder="Policy owner" className={inputCls} />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Last reviewed</label>
 <input type="date" value={fLastReview} onChange={e => setFLastReview(e.target.value)} className={inputCls} />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Next review</label>
 <input type="date" value={fNextReview} onChange={e => setFNextReview(e.target.value)} className={inputCls} />
 </div>
 </div>
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
 <div className="text-center py-12 text-[var(--text-muted)] text-sm">No policies found.</div>
 ) : (
 <div className="space-y-2">
 {visible.map(policy => {
 const reviewDue = isDueForReview(policy.nextReviewAt) && policy.status !== 'archived'
 return (
 <div key={policy.id} className={cn('bg-[var(--surface)] border rounded-[10px] p-4',
 reviewDue ? 'border-[var(--amber)]' : 'border-[var(--border)]')}>
 <div className="flex items-start gap-3">
 {reviewDue
 ? <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
 : <ScrollText size={15} className={cn('shrink-0 mt-0.5', STATUS_COLOR[policy.status])} />}
 <div className="flex-1 min-w-0 space-y-1">
 <p className="text-sm font-medium text-[var(--text-bright)]">{policy.title}</p>
 {policy.description && <p className="text-xs text-[var(--text-muted)]">{policy.description}</p>}
 <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
 <span>{CATEGORY_LABEL[policy.category] ?? policy.category}</span>
 {policy.owner && <span>Owner: {policy.owner}</span>}
 {policy.lastReviewedAt && <span>Reviewed: {new Date(policy.lastReviewedAt).toLocaleDateString()}</span>}
 {policy.nextReviewAt && (
 <span className={reviewDue ? 'text-[var(--amber)] font-medium' : ''}>
 Next review: {new Date(policy.nextReviewAt).toLocaleDateString()}
 {reviewDue ? ' ⚠' : ''}
 </span>
 )}
 </div>
 <textarea defaultValue={policy.notes ?? ''} onBlur={e => void updateField(policy.id, 'notes', e.target.value)}
 rows={1} placeholder="Notes…"
 className="w-full text-xs border border-[var(--border)] rounded-[4px] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30/50 resize-none" />
 </div>
 <select value={policy.status} onChange={e => void updateField(policy.id, 'status', e.target.value)}
 className={cn('text-xs font-medium h-7 px-2 rounded-[4px] border-0 bg-transparent focus:outline-none shrink-0', STATUS_COLOR[policy.status])}>
 {STATUSES.map(s => <option key={s} value={s} className="bg-[var(--surface)] text-[var(--text-bright)]">{STATUS_LABEL[s]}</option>)}
 </select>
 <button onClick={() => void handleDelete(policy.id)} className="text-[var(--border)] hover:text-[var(--red)] transition-colors shrink-0">
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
