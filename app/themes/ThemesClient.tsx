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
  candidate: { label: 'Candidate', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800' },
  rejected:  { label: 'Rejected',  color: 'text-gray-300 dark:text-zinc-600',       bg: 'bg-gray-50 dark:bg-zinc-900 border-gray-100 dark:border-zinc-800' },
}

const inputCls = 'w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'

export default function ThemesClient() {
  const [themes, setThemes]     = useState<Theme[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter]     = useState('all')

  const [fTitle, setFTitle]   = useState('')
  const [fDesc, setFDesc]     = useState('')
  const [saving, setSaving]   = useState(false)

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

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Themes Board</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">
            Synthesise recurring patterns across your research — confirm, develop, or reject each theme.
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors">
          <Plus size={14} /> Add theme
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(prev => prev === s ? 'all' : s)}
            className={cn('rounded-xl border p-3 text-left transition-all', filter === s ? STATUS_CONFIG[s].bg : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700')}>
            <div className={cn('text-xl font-semibold', STATUS_CONFIG[s].color)}>{counts[s] ?? 0}</div>
            <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{STATUS_CONFIG[s].label}</div>
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Add Theme</h2>
          <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Theme title *" className={inputCls} />
          <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2}
            placeholder="Describe this pattern — where does it appear, what evidence supports it?" className={cn(inputCls, 'resize-none')} />
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
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm">No themes yet. Add candidate themes as you spot patterns across interviews.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(theme => {
            const cfg = STATUS_CONFIG[theme.status]
            return (
              <div key={theme.id} className={cn('border rounded-xl p-4 space-y-2', cfg.bg)}>
                <div className="flex items-start gap-3">
                  <Layers size={15} className={cn('shrink-0 mt-0.5', cfg.color)} />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">{theme.title}</p>
                    {theme.description && <p className="text-xs text-gray-600 dark:text-zinc-300 leading-relaxed">{theme.description}</p>}
                    <textarea defaultValue={theme.notes ?? ''} onBlur={e => void updateField(theme.id, 'notes', e.target.value)}
                      rows={1} placeholder="Add evidence, quotes, or supporting observations…"
                      className="w-full text-xs border border-gray-100 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:bg-zinc-800/50 dark:text-zinc-300 dark:placeholder-zinc-600 resize-none bg-white/60" />
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => void updateField(theme.id, 'status', s)}
                        className={cn('text-[10px] px-2 py-1 rounded-lg border transition-colors font-medium',
                          theme.status === s ? cn(STATUS_CONFIG[s].bg, STATUS_CONFIG[s].color) : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 bg-white dark:bg-zinc-900')}>
                        {STATUS_CONFIG[s].label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => void handleDelete(theme.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
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
