'use client'

import { useState, useEffect } from 'react'
import { Trash2, Plus, Loader2, ChevronDown } from 'lucide-react'
import Pagination from './KnowledgePagination'

const PAGE_SIZE = 10

interface GlossaryTerm {
  id: string
  term: string
  definition: string
  scope: string
  createdAt: string
}

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'mode:journalism', label: 'Journalism' },
]

function scopeLabel(scope: string): string {
  if (scope === 'global') return 'Global'
  if (scope.startsWith('mode:')) return scope.replace('mode:', '')
  if (scope.startsWith('area:')) return 'Beat: ' + scope.replace('area:', '')
  return scope
}

export default function GlossaryPanel() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [newTerm, setNewTerm] = useState('')
  const [newDef, setNewDef] = useState('')
  const [newScope, setNewScope] = useState('global')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const modeScope = 'mode:journalism'

  useEffect(() => {
    fetch('/api/knowledge/glossary')
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() as Promise<{ terms?: GlossaryTerm[] }> })
      .then(d => setTerms(d.terms ?? []))
      .catch(err => console.error('Failed to load glossary:', err))
      .finally(() => setLoading(false))
  }, [])

  const visibleTerms = terms.filter(t => t.scope === 'global' || t.scope === modeScope || t.scope.startsWith('area:'))

  async function addTerm() {
    if (!newTerm.trim() || !newDef.trim()) return
    setSaving(true)
    const res = await fetch('/api/knowledge/glossary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term: newTerm.trim(), definition: newDef.trim(), scope: newScope }),
    })
    const data = await res.json() as { term?: GlossaryTerm }
    if (data.term) {
      setTerms(prev => [...prev.filter(t => t.id !== data.term!.id), data.term!].sort((a, b) => a.scope.localeCompare(b.scope) || a.term.localeCompare(b.term)))
    }
    setNewTerm('')
    setNewDef('')
    setSaving(false)
  }

  async function deleteTerm(id: string) {
    setDeletingId(id)
    await fetch('/api/knowledge/glossary', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setTerms(prev => {
      const next = prev.filter(t => t.id !== id)
      const maxPage = Math.max(0, Math.ceil(next.filter(t => t.scope === 'global' || t.scope === modeScope || t.scope.startsWith('area:')).length / PAGE_SIZE) - 1)
      if (page > maxPage) setPage(maxPage)
      return next
    })
    setDeletingId(null)
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /></div>

  const pageTerms = visibleTerms.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const grouped: Record<string, GlossaryTerm[]> = {}
  for (const t of pageTerms) {
    grouped[t.scope] = grouped[t.scope] ?? []
    grouped[t.scope].push(t)
  }

  return (
    <div className="space-y-4">
      <div className="border border-[var(--border)] rounded-[10px] p-3 space-y-2">
        <p className="text-xs font-medium text-[var(--text-body)]">Add term</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTerm}
            onChange={e => setNewTerm(e.target.value)}
            placeholder="Term (e.g. ARR)"
            className="w-32 h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
          />
          <input
            type="text"
            value={newDef}
            onChange={e => setNewDef(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTerm()}
            placeholder="Definition"
            className="flex-1 h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={newScope}
              onChange={e => setNewScope(e.target.value)}
              className="w-full appearance-none h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 pr-8"
            >
              {SCOPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>
          <button
            onClick={addTerm}
            disabled={saving || !newTerm.trim() || !newDef.trim()}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium disabled:opacity-40 shrink-0"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)]">{visibleTerms.length} term{visibleTerms.length !== 1 ? 's' : ''}</p>

      <div className="space-y-4">
        {Object.entries(grouped).map(([scope, scopeTerms]) => (
          <div key={scope}>
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1.5">{scopeLabel(scope)}</p>
            <div className="space-y-1">
              {scopeTerms.map(t => (
                <div key={t.id} className="flex items-center gap-2 bg-[var(--surface-2)] rounded-[4px] px-3 py-2">
                  <span className="text-sm font-medium text-[var(--text-bright)] w-28 shrink-0">{t.term}</span>
                  <span className="flex-1 text-sm text-[var(--text-subtle)]">{t.definition}</span>
                  <button
                    onClick={() => deleteTerm(t.id)}
                    disabled={deletingId === t.id}
                    className="text-[var(--text-muted)] hover:text-[var(--red)] shrink-0"
                  >
                    {deletingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {visibleTerms.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] py-2">No terms yet for this mode. Add your first term above.</p>
        )}
      </div>

      <Pagination page={page} total={visibleTerms.length} onPage={setPage} />
    </div>
  )
}
