'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Decision {
  id: string; title: string; context: string | null; rationale: string | null
  outcome: string | null; status: string; madeBy: string | null
  madeAt: string | null; notes: string | null; projectId: string | null; createdAt: string
}

const STATUSES = ['pending', 'made', 'reversed', 'superseded'] as const

const STATUS_COLOR: Record<string, string> = {
  pending:    'text-amber-600 dark:text-amber-400',
  made:       'text-emerald-600 dark:text-emerald-400',
  reversed:   'text-red-500 dark:text-red-400',
  superseded: 'text-gray-400 dark:text-zinc-500',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', made: 'Made', reversed: 'Reversed', superseded: 'Superseded',
}

const inputCls = 'w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'

export default function DecisionsClient() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [filter, setFilter]       = useState<string>('all')

  const [fTitle, setFTitle]         = useState('')
  const [fContext, setFContext]     = useState('')
  const [fRationale, setFRationale] = useState('')
  const [fMadeBy, setFMadeBy]       = useState('')
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/decisions')
      if (res.ok) { const d = await res.json() as { decisions: Decision[] }; setDecisions(d.decisions) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleCreate = async () => {
    if (!fTitle.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/decisions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: fTitle, context: fContext, rationale: fRationale, madeBy: fMadeBy }),
      })
      if (res.ok) {
        const d = await res.json() as { decision: Decision }
        setDecisions(prev => [d.decision, ...prev])
        setFTitle(''); setFContext(''); setFRationale(''); setFMadeBy(''); setShowForm(false)
      }
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const updateField = async (id: string, key: string, value: string) => {
    setDecisions(prev => prev.map(d => d.id === id ? { ...d, [key]: value } : d))
    await fetch(`/api/decisions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {})
  }

  const handleDelete = async (id: string) => {
    setDecisions(prev => prev.filter(d => d.id !== id))
    await fetch(`/api/decisions/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const visible = filter === 'all' ? decisions : decisions.filter(d => d.status === filter)

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Decision Log</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">Record key decisions with rationale and outcomes.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors">
          <Plus size={14} /> Log decision
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(['all', ...STATUSES] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
              filter === s ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400')}>
            {s === 'all' ? `All (${decisions.length})` : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Log Decision</h2>
          <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Decision title *" className={inputCls} />
          <textarea value={fContext} onChange={e => setFContext(e.target.value)} rows={2} placeholder="Context — what situation prompted this?" className={cn(inputCls, 'resize-none')} />
          <textarea value={fRationale} onChange={e => setFRationale(e.target.value)} rows={2} placeholder="Rationale — why this choice?" className={cn(inputCls, 'resize-none')} />
          <input value={fMadeBy} onChange={e => setFMadeBy(e.target.value)} placeholder="Decision maker" className={inputCls} />
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving || !fTitle.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />} Log
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm">No decisions logged yet.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(dec => (
            <div key={dec.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <Lightbulb size={15} className={cn('shrink-0 mt-0.5', STATUS_COLOR[dec.status])} />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">{dec.title}</p>
                  {dec.context   && <p className="text-xs text-gray-500 dark:text-zinc-400"><span className="font-medium">Context:</span> {dec.context}</p>}
                  {dec.rationale && <p className="text-xs text-gray-500 dark:text-zinc-400"><span className="font-medium">Rationale:</span> {dec.rationale}</p>}
                  {dec.madeBy    && <p className="text-[11px] text-gray-400 dark:text-zinc-500">By {dec.madeBy}</p>}
                  <textarea defaultValue={dec.outcome ?? ''} onBlur={e => void updateField(dec.id, 'outcome', e.target.value)}
                    rows={1} placeholder="Record outcome…"
                    className="w-full text-xs border border-gray-100 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:bg-zinc-800/50 dark:text-zinc-300 dark:placeholder-zinc-600 resize-none" />
                </div>
                <select value={dec.status} onChange={e => void updateField(dec.id, 'status', e.target.value)}
                  className={cn('text-[11px] font-medium px-2 py-1 rounded-full border-0 bg-transparent focus:outline-none shrink-0', STATUS_COLOR[dec.status])}>
                  {STATUSES.map(s => <option key={s} value={s} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50">{STATUS_LABEL[s]}</option>)}
                </select>
                <button onClick={() => void handleDelete(dec.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
