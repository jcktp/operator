'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Risk {
  id: string; title: string; description: string | null; category: string
  probability: string; impact: string; owner: string | null; status: string
  notes: string | null; dueAt: string | null; resolvedAt: string | null
  projectId: string | null; createdAt: string
}

const PROBABILITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const
const IMPACT_LEVELS      = ['low', 'medium', 'high', 'critical'] as const
const STATUSES           = ['open', 'mitigated', 'accepted', 'closed'] as const
const CATEGORIES         = ['operational', 'financial', 'strategic', 'legal', 'reputational', 'technical', 'people']

const LEVEL_COLOR: Record<string, string> = {
  low:      'text-emerald-600 dark:text-emerald-400',
  medium:   'text-amber-600  dark:text-amber-400',
  high:     'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600    dark:text-red-400',
}
const LEVEL_BG: Record<string, string> = {
  low:      'bg-emerald-50  dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800',
  medium:   'bg-amber-50    dark:bg-amber-950   border-amber-200   dark:border-amber-800',
  high:     'bg-orange-50   dark:bg-orange-950  border-orange-200  dark:border-orange-800',
  critical: 'bg-red-50      dark:bg-red-950     border-red-200     dark:border-red-800',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', mitigated: 'Mitigated', accepted: 'Accepted', closed: 'Closed',
}

const inputCls = 'w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'

export default function RisksClient() {
  const [risks, setRisks]       = useState<Risk[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter]     = useState<string>('all')

  const [fTitle, setFTitle]           = useState('')
  const [fDesc, setFDesc]             = useState('')
  const [fCategory, setFCategory]     = useState('operational')
  const [fProb, setFProb]             = useState('medium')
  const [fImpact, setFImpact]         = useState('medium')
  const [fOwner, setFOwner]           = useState('')
  const [saving, setSaving]           = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/risks')
      if (res.ok) { const d = await res.json() as { risks: Risk[] }; setRisks(d.risks) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleCreate = async () => {
    if (!fTitle.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/risks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: fTitle, description: fDesc, category: fCategory, probability: fProb, impact: fImpact, owner: fOwner }),
      })
      if (res.ok) {
        const d = await res.json() as { risk: Risk }
        setRisks(prev => [d.risk, ...prev])
        setFTitle(''); setFDesc(''); setFCategory('operational'); setFProb('medium'); setFImpact('medium'); setFOwner('')
        setShowForm(false)
      }
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const updateField = async (id: string, key: string, value: string) => {
    setRisks(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r))
    await fetch(`/api/risks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {})
  }

  const handleDelete = async (id: string) => {
    setRisks(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/risks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  // Score = probability × impact for sorting (low=1, medium=2, high=3, critical=4)
  const score = (r: Risk) => {
    const lvl: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
    return (lvl[r.probability] ?? 1) * (lvl[r.impact] ?? 1)
  }

  const visible = (filter === 'all' ? risks : risks.filter(r => r.status === filter))
    .slice().sort((a, b) => score(b) - score(a))

  const openCount = risks.filter(r => r.status === 'open').length

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Risk Register</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
            {openCount} open risk{openCount !== 1 ? 's' : ''} · sorted by probability × impact
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors">
          <Plus size={14} /> Add risk
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {(['all', ...STATUSES] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors capitalize',
              filter === s ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400')}>
            {s === 'all' ? `All (${risks.length})` : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Add Risk</h2>
          <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Risk title *" className={inputCls} />
          <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="Description" className={cn(inputCls, 'resize-none')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Category</label>
              <select value={fCategory} onChange={e => setFCategory(e.target.value)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Owner</label>
              <input value={fOwner} onChange={e => setFOwner(e.target.value)} placeholder="Who owns this?" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Probability</label>
              <select value={fProb} onChange={e => setFProb(e.target.value)} className={inputCls}>
                {PROBABILITY_LEVELS.map(l => <option key={l} value={l} className="capitalize">{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Impact</label>
              <select value={fImpact} onChange={e => setFImpact(e.target.value)} className={inputCls}>
                {IMPACT_LEVELS.map(l => <option key={l} value={l} className="capitalize">{l}</option>)}
              </select>
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

      {/* List */}
      {visible.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm">No risks yet.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(risk => {
            const worstLevel = [risk.probability, risk.impact].includes('critical') ? 'critical'
              : [risk.probability, risk.impact].includes('high') ? 'high'
              : [risk.probability, risk.impact].includes('medium') ? 'medium' : 'low'
            return (
              <div key={risk.id} className={cn('border rounded-xl p-4 space-y-2', LEVEL_BG[worstLevel])}>
                <div className="flex items-start gap-3">
                  <ShieldAlert size={15} className={cn('shrink-0 mt-0.5', LEVEL_COLOR[worstLevel])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">{risk.title}</p>
                    {risk.description && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{risk.description}</p>}
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <span className={cn('text-[11px] font-medium capitalize', LEVEL_COLOR[risk.probability])}>P: {risk.probability}</span>
                      <span className={cn('text-[11px] font-medium capitalize', LEVEL_COLOR[risk.impact])}>I: {risk.impact}</span>
                      <span className="text-[11px] text-gray-400 dark:text-zinc-500 capitalize">{risk.category}</span>
                      {risk.owner && <span className="text-[11px] text-gray-400 dark:text-zinc-500">Owner: {risk.owner}</span>}
                    </div>
                    <textarea defaultValue={risk.notes ?? ''} onBlur={e => void updateField(risk.id, 'notes', e.target.value)}
                      rows={1} placeholder="Add notes…"
                      className="mt-2 w-full text-xs border border-gray-100 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:bg-zinc-800/50 dark:text-zinc-300 dark:placeholder-zinc-600 resize-none bg-white/60" />
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <select value={risk.status} onChange={e => void updateField(risk.id, 'status', e.target.value)}
                      className="text-[11px] font-medium px-2 py-1 rounded-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 focus:outline-none">
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    {risk.resolvedAt && (
                      <span className="text-[10px] text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                        Resolved {new Date(risk.resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <button onClick={() => void handleDelete(risk.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
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
