'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, ScrollText, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Policy {
  id: string; title: string; description: string | null; owner: string | null
  category: string; status: string; lastReviewedAt: string | null
  nextReviewAt: string | null; notes: string | null; createdAt: string
}

const STATUSES   = ['draft', 'active', 'under_review', 'archived'] as const
const CATEGORIES = [
  'general', 'recruitment', 'compensation', 'conduct', 'health_safety',
  'performance', 'leave', 'data_privacy', 'dei', 'offboarding',
]

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', under_review: 'Under review', archived: 'Archived',
}
const STATUS_COLOR: Record<string, string> = {
  draft:        'text-gray-400 dark:text-zinc-500',
  active:       'text-emerald-600 dark:text-emerald-400',
  under_review: 'text-amber-600 dark:text-amber-400',
  archived:     'text-gray-300 dark:text-zinc-600',
}

const CATEGORY_LABEL: Record<string, string> = {
  general: 'General', recruitment: 'Recruitment & Selection',
  compensation: 'Compensation & Benefits', conduct: 'Conduct & Ethics',
  health_safety: 'Health & Safety', performance: 'Performance Management',
  leave: 'Leave & Absence', data_privacy: 'Data Privacy',
  dei: 'DEI', offboarding: 'Offboarding',
}

const inputCls = 'w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'

function isDueForReview(nextReviewAt: string | null) {
  if (!nextReviewAt) return false
  const d = new Date(nextReviewAt)
  const soon = new Date(); soon.setDate(soon.getDate() + 30)
  return d <= soon
}

export default function PoliciesClient() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter]     = useState('all')

  const [fTitle, setFTitle]         = useState('')
  const [fDesc, setFDesc]           = useState('')
  const [fOwner, setFOwner]         = useState('')
  const [fCategory, setFCategory]   = useState('general')
  const [fStatus, setFStatus]       = useState('active')
  const [fLastReview, setFLastReview] = useState('')
  const [fNextReview, setFNextReview] = useState('')
  const [saving, setSaving]         = useState(false)

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

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Policy Register</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
            {policies.filter(p => p.status === 'active').length} active policies
            {dueCount > 0 && <span className="text-amber-600 dark:text-amber-400"> · {dueCount} due for review</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors">
          <Plus size={14} /> Add policy
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'due', ...STATUSES] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
              filter === s ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400',
              s === 'due' && dueCount > 0 && filter !== 'due' ? 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400' : '')}>
            {s === 'all' ? `All (${policies.length})` : s === 'due' ? `Due for review (${dueCount})` : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Add Policy</h2>
          <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Policy title *" className={inputCls} />
          <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="Brief description" className={cn(inputCls, 'resize-none')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Category</label>
              <select value={fCategory} onChange={e => setFCategory(e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Status</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inputCls}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Owner</label>
              <input value={fOwner} onChange={e => setFOwner(e.target.value)} placeholder="Policy owner" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Last reviewed</label>
              <input type="date" value={fLastReview} onChange={e => setFLastReview(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Next review</label>
              <input type="date" value={fNextReview} onChange={e => setFNextReview(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving || !fTitle.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />} Add
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm">No policies found.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(policy => {
            const reviewDue = isDueForReview(policy.nextReviewAt) && policy.status !== 'archived'
            return (
              <div key={policy.id} className={cn('bg-white dark:bg-zinc-900 border rounded-xl p-4',
                reviewDue ? 'border-amber-200 dark:border-amber-800' : 'border-gray-200 dark:border-zinc-700')}>
                <div className="flex items-start gap-3">
                  {reviewDue
                    ? <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
                    : <ScrollText size={15} className={cn('shrink-0 mt-0.5', STATUS_COLOR[policy.status])} />}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">{policy.title}</p>
                    {policy.description && <p className="text-xs text-gray-500 dark:text-zinc-400">{policy.description}</p>}
                    <div className="flex flex-wrap gap-3 text-[11px] text-gray-400 dark:text-zinc-500">
                      <span>{CATEGORY_LABEL[policy.category] ?? policy.category}</span>
                      {policy.owner && <span>Owner: {policy.owner}</span>}
                      {policy.lastReviewedAt && <span>Reviewed: {new Date(policy.lastReviewedAt).toLocaleDateString()}</span>}
                      {policy.nextReviewAt && (
                        <span className={reviewDue ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                          Next review: {new Date(policy.nextReviewAt).toLocaleDateString()}
                          {reviewDue ? ' ⚠' : ''}
                        </span>
                      )}
                    </div>
                    <textarea defaultValue={policy.notes ?? ''} onBlur={e => void updateField(policy.id, 'notes', e.target.value)}
                      rows={1} placeholder="Notes…"
                      className="w-full text-xs border border-gray-100 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:bg-zinc-800/50 dark:text-zinc-300 dark:placeholder-zinc-600 resize-none" />
                  </div>
                  <select value={policy.status} onChange={e => void updateField(policy.id, 'status', e.target.value)}
                    className={cn('text-[11px] font-medium px-2 py-1 rounded-full border-0 bg-transparent focus:outline-none shrink-0', STATUS_COLOR[policy.status])}>
                    {STATUSES.map(s => <option key={s} value={s} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50">{STATUS_LABEL[s]}</option>)}
                  </select>
                  <button onClick={() => void handleDelete(policy.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
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
