'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, CalendarClock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Deadline {
  id: string; title: string; description: string | null; kind: string
  dueAt: string; completedAt: string | null; status: string; priority: string
  context: string | null; notes: string | null; projectId: string | null; createdAt: string
}

const STATUSES   = ['upcoming', 'completed', 'missed', 'extended'] as const
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
const KINDS_LEGAL = ['court', 'filing', 'limitation', 'hearing', 'contract', 'review', 'other']
const KINDS_HR    = ['review', 'contract', 'compliance', 'policy', 'reporting', 'other']

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'Upcoming', completed: 'Completed', missed: 'Missed', extended: 'Extended',
}
const PRIORITY_COLOR: Record<string, string> = {
  low:      'text-gray-400 dark:text-zinc-500',
  medium:   'text-amber-600 dark:text-amber-400',
  high:     'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
}

function daysUntil(dueAt: string) {
  const diff = new Date(dueAt).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

const inputCls = 'w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'

export default function DeadlinesClient() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [filter, setFilter]       = useState('upcoming')

  const [fTitle, setFTitle]       = useState('')
  const [fDesc, setFDesc]         = useState('')
  const [fKind, setFKind]         = useState('other')
  const [fDueAt, setFDueAt]       = useState('')
  const [fPriority, setFPriority] = useState('medium')
  const [fContext, setFContext]    = useState('')
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/deadlines')
      if (res.ok) { const d = await res.json() as { deadlines: Deadline[] }; setDeadlines(d.deadlines) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleCreate = async () => {
    if (!fTitle.trim() || !fDueAt) return
    setSaving(true)
    try {
      const res = await fetch('/api/deadlines', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: fTitle, description: fDesc, kind: fKind, dueAt: fDueAt, priority: fPriority, context: fContext }),
      })
      if (res.ok) {
        const d = await res.json() as { deadline: Deadline }
        setDeadlines(prev => [...prev, d.deadline].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()))
        setFTitle(''); setFDesc(''); setFKind('other'); setFDueAt(''); setFPriority('medium'); setFContext(''); setShowForm(false)
      }
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const updateField = async (id: string, key: string, value: string) => {
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, [key]: value } : d))
    await fetch(`/api/deadlines/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    }).catch(() => {})
  }

  const markComplete = async (id: string) => {
    const now = new Date().toISOString()
    setDeadlines(prev => prev.map(d => d.id === id ? { ...d, status: 'completed', completedAt: now } : d))
    await fetch(`/api/deadlines/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed', completedAt: now }),
    }).catch(() => {})
  }

  const handleDelete = async (id: string) => {
    setDeadlines(prev => prev.filter(d => d.id !== id))
    await fetch(`/api/deadlines/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const visible = filter === 'all' ? deadlines : deadlines.filter(d => d.status === filter)
  const overdueCount = deadlines.filter(d => d.status === 'upcoming' && daysUntil(d.dueAt) < 0).length

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Deadline Tracker</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
            {deadlines.filter(d => d.status === 'upcoming').length} upcoming
            {overdueCount > 0 && <span className="text-red-500"> · {overdueCount} overdue</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors">
          <Plus size={14} /> Add deadline
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(['upcoming', 'all', ...STATUSES.filter(s => s !== 'upcoming')] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
              filter === s ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400')}>
            {s === 'all' ? `All (${deadlines.length})` : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Add Deadline</h2>
          <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Title *" className={inputCls} />
          <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="Description" className={cn(inputCls, 'resize-none')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Type</label>
              <select value={fKind} onChange={e => setFKind(e.target.value)} className={inputCls}>
                {[...new Set([...KINDS_LEGAL, ...KINDS_HR])].map(k => <option key={k} value={k} className="capitalize">{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Priority</label>
              <select value={fPriority} onChange={e => setFPriority(e.target.value)} className={inputCls}>
                {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Due date *</label>
              <input type="date" value={fDueAt} onChange={e => setFDueAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Context</label>
              <input value={fContext} onChange={e => setFContext(e.target.value)} placeholder="Case / matter / reference" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving || !fTitle.trim() || !fDueAt}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />} Add
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm">No deadlines found.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(dl => {
            const days    = daysUntil(dl.dueAt)
            const overdue = dl.status === 'upcoming' && days < 0
            const urgent  = dl.status === 'upcoming' && days >= 0 && days <= 7
            return (
              <div key={dl.id} className={cn('bg-white dark:bg-zinc-900 border rounded-xl p-4',
                overdue ? 'border-red-200 dark:border-red-800' : urgent ? 'border-amber-200 dark:border-amber-800' : 'border-gray-200 dark:border-zinc-700')}>
                <div className="flex items-start gap-3">
                  {dl.status === 'completed'
                    ? <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-500" />
                    : <CalendarClock size={15} className={cn('shrink-0 mt-0.5', PRIORITY_COLOR[dl.priority])} />}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">{dl.title}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 capitalize">{dl.kind}</span>
                    </div>
                    {dl.description && <p className="text-xs text-gray-500 dark:text-zinc-400">{dl.description}</p>}
                    <div className="flex gap-3 flex-wrap text-[11px] text-gray-400 dark:text-zinc-500">
                      {dl.context && <span>{dl.context}</span>}
                      <span className={cn('font-medium', overdue ? 'text-red-500' : urgent ? 'text-amber-600 dark:text-amber-400' : '')}>
                        {dl.status === 'completed' ? `Done ${dl.completedAt ? new Date(dl.completedAt).toLocaleDateString() : ''}` :
                          overdue ? `${Math.abs(days)}d overdue` :
                          days === 0 ? 'Due today' :
                          `${days}d remaining · ${new Date(dl.dueAt).toLocaleDateString()}`}
                      </span>
                    </div>
                    <textarea defaultValue={dl.notes ?? ''} onBlur={e => void updateField(dl.id, 'notes', e.target.value)}
                      rows={1} placeholder="Notes…"
                      className="w-full text-xs border border-gray-100 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:bg-zinc-800/50 dark:text-zinc-300 dark:placeholder-zinc-600 resize-none" />
                  </div>
                  {dl.status === 'upcoming' && (
                    <button onClick={() => void markComplete(dl.id)}
                      className="shrink-0 text-[11px] px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors">
                      Done
                    </button>
                  )}
                  <select value={dl.status} onChange={e => void updateField(dl.id, 'status', e.target.value)}
                    className="text-[11px] font-medium px-2 py-1 rounded-full border-0 bg-transparent text-gray-500 dark:text-zinc-400 focus:outline-none shrink-0">
                    {STATUSES.map(s => <option key={s} value={s} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50">{STATUS_LABEL[s]}</option>)}
                  </select>
                  <button onClick={() => void handleDelete(dl.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
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
