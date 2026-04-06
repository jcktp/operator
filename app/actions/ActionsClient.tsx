'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Ban, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMode } from '@/components/ModeContext'

interface ActionItem {
  id: string; title: string; description: string | null; kind: string
  assignee: string | null; dueAt: string | null; priority: string; status: string
  source: string | null; notes: string | null; projectId: string | null; createdAt: string
}

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
const STATUSES   = ['open', 'in_progress', 'done', 'deferred', 'cancelled'] as const

const PRIORITY_COLOR: Record<string, string> = {
  low:      'text-gray-400 dark:text-zinc-500',
  medium:   'text-amber-600 dark:text-amber-400',
  high:     'text-orange-600 dark:text-orange-400',
  critical: 'text-red-600 dark:text-red-400',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In progress', done: 'Done', deferred: 'Deferred', cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  open: 'text-blue-600 dark:text-blue-400', in_progress: 'text-amber-600 dark:text-amber-400',
  done: 'text-emerald-600 dark:text-emerald-400', deferred: 'text-gray-400 dark:text-zinc-500',
  cancelled: 'text-gray-300 dark:text-zinc-600',
}

const inputCls = 'w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'

function isOverdue(dueAt: string | null) {
  return dueAt ? new Date(dueAt) < new Date() : false
}

export default function ActionsClient() {
  const config = useMode()
  // Determine context: blockers for team_lead, actions for HR
  const isBlockerMode = config.id === 'team_lead'
  const defaultKind   = isBlockerMode ? 'blocker' : 'action'
  const pageTitle     = isBlockerMode ? 'Blockers' : 'Action Log'
  const addLabel      = isBlockerMode ? 'Add blocker' : 'Add action'

  const [items, setItems]       = useState<ActionItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('open')
  const [filterKind, setFilterKind]     = useState<string>('all')

  const [fTitle, setFTitle]       = useState('')
  const [fDesc, setFDesc]         = useState('')
  const [fKind, setFKind]         = useState(defaultKind)
  const [fAssignee, setFAssignee] = useState('')
  const [fDue, setFDue]           = useState('')
  const [fPriority, setFPriority] = useState('medium')
  const [fSource, setFSource]     = useState('')
  const [saving, setSaving]       = useState(false)

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

  const visible = items.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterKind   !== 'all' && i.kind   !== filterKind)   return false
    return true
  })

  const openCount = items.filter(i => i.status === 'open' || i.status === 'in_progress').length

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">{pageTitle}</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">{openCount} open item{openCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors">
          <Plus size={14} /> {addLabel}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {(['open', 'in_progress', 'done', 'all'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                filterStatus === s ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400')}>
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(['all', 'action', 'blocker'] as const).map(k => (
            <button key={k} onClick={() => setFilterKind(k)}
              className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors capitalize',
                filterKind === k ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400')}>
              {k === 'all' ? 'All types' : k + 's'}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">{addLabel}</h2>
          <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Title *" className={inputCls} />
          <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="Description" className={cn(inputCls, 'resize-none')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Type</label>
              <select value={fKind} onChange={e => setFKind(e.target.value)} className={inputCls}>
                <option value="action">Action</option>
                <option value="blocker">Blocker</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Priority</label>
              <select value={fPriority} onChange={e => setFPriority(e.target.value)} className={inputCls}>
                {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Assignee</label>
              <input value={fAssignee} onChange={e => setFAssignee(e.target.value)} placeholder="Who owns this?" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Due date</label>
              <input type="date" value={fDue} onChange={e => setFDue(e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Source</label>
              <input value={fSource} onChange={e => setFSource(e.target.value)} placeholder="e.g. Retro, 1-on-1, policy review" className={inputCls} />
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
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm">No items found.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(item => {
            const overdue = isOverdue(item.dueAt) && item.status !== 'done' && item.status !== 'cancelled'
            const Icon = item.kind === 'blocker' ? Ban : ListChecks
            return (
              <div key={item.id} className={cn('bg-white dark:bg-zinc-900 border rounded-xl p-4 space-y-2',
                overdue ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-zinc-700')}>
                <div className="flex items-start gap-3">
                  <Icon size={15} className={cn('shrink-0 mt-0.5', PRIORITY_COLOR[item.priority])} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn('text-sm font-medium', item.status === 'done' ? 'line-through text-gray-400 dark:text-zinc-500' : 'text-gray-900 dark:text-zinc-50')}>{item.title}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 capitalize">{item.kind}</span>
                      {overdue && <span className="text-[10px] text-red-500 font-medium">Overdue</span>}
                    </div>
                    {item.description && <p className="text-xs text-gray-500 dark:text-zinc-400">{item.description}</p>}
                    <div className="flex gap-3 flex-wrap text-[11px] text-gray-400 dark:text-zinc-500">
                      {item.assignee && <span>→ {item.assignee}</span>}
                      {item.dueAt    && <span className={overdue ? 'text-red-500' : ''}>{new Date(item.dueAt).toLocaleDateString()}</span>}
                      {item.source   && <span>From: {item.source}</span>}
                    </div>
                    <textarea defaultValue={item.notes ?? ''} onBlur={e => void updateField(item.id, 'notes', e.target.value)}
                      rows={1} placeholder="Add notes…"
                      className="w-full text-xs border border-gray-100 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:bg-zinc-800/50 dark:text-zinc-300 dark:placeholder-zinc-600 resize-none" />
                  </div>
                  <select value={item.status} onChange={e => void updateField(item.id, 'status', e.target.value)}
                    className={cn('text-[11px] font-medium px-2 py-1 rounded-full border-0 bg-transparent focus:outline-none shrink-0', STATUS_COLOR[item.status])}>
                    {STATUSES.map(s => <option key={s} value={s} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50">{STATUS_LABEL[s]}</option>)}
                  </select>
                  <button onClick={() => void handleDelete(item.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
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
