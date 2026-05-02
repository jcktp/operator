'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Plus, Trash2, RefreshCw, BookOpen, ScrollText, Save, Pencil, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import SelectField from '@/components/SelectField'
import Pagination from '@/app/settings/KnowledgePagination'

const GLOSSARY_PAGE_SIZE = 20

interface Briefing {
  id: string
  area: string
  content: string
  userNotes: string | null
  reportCount: number
  updatedAt: string
}

interface Term {
  id: string
  term: string
  definition: string
  scope: string
  createdAt: string
}

interface Props {
  initialAreas: string[]
}

type Tab = 'briefings' | 'glossary'

const inputCls =
  'w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-indigo-500/30'

export default function KnowledgeClient({ initialAreas }: Props) {
  const [tab, setTab] = useState<Tab>('briefings')

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Knowledge</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          Area briefings and the glossary that frames every AI prompt.
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--border)]">
        <TabButton active={tab === 'briefings'} onClick={() => setTab('briefings')} icon={<ScrollText size={14} />}>
          Briefings
        </TabButton>
        <TabButton active={tab === 'glossary'} onClick={() => setTab('glossary')} icon={<BookOpen size={14} />}>
          Glossary
        </TabButton>
      </div>

      {tab === 'briefings' && <BriefingsPanel allAreas={initialAreas} />}
      {tab === 'glossary' && <GlossaryPanel allAreas={initialAreas} />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 h-8 px-3 text-xs font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'border-[var(--ink)] text-[var(--text-bright)]'
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-bright)]',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

// ── Briefings ────────────────────────────────────────────────────────────────

function BriefingsPanel({ allAreas }: { allAreas: string[] }) {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [generateArea, setGenerateArea] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge/briefings')
      if (res.ok) {
        const d = (await res.json()) as { briefings: Briefing[] }
        setBriefings(d.briefings)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const briefingAreas = useMemo(() => new Set(briefings.map(b => b.area)), [briefings])
  const candidateAreas = useMemo(() => allAreas.filter(a => !briefingAreas.has(a)), [allAreas, briefingAreas])

  const handleGenerate = async (area: string) => {
    if (!area.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/knowledge/briefings/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area }),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        setError(d.error ?? `Failed (${res.status})`)
      } else {
        setGenerateArea('')
        await load()
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleRefresh = async (area: string) => {
    setRefreshing(area)
    setError(null)
    try {
      const res = await fetch('/api/knowledge/briefings/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area }),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        setError(d.error ?? `Failed (${res.status})`)
      } else {
        await load()
      }
    } finally {
      setRefreshing(null)
    }
  }

  const handleDelete = async (area: string) => {
    if (!confirm(`Delete briefing for "${area}"?`)) return
    setBriefings(prev => prev.filter(b => b.area !== area))
    await fetch('/api/knowledge/briefings', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area }),
    }).catch(() => {})
  }

  const saveNotes = async (area: string, notes: string) => {
    await fetch('/api/knowledge/briefings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area, notes }),
    }).catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
        <h2 className="text-sm font-semibold text-[var(--text-bright)] mb-1">Generate briefing</h2>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Summarises recent reports for a beat into a paragraph that gets injected into every AI prompt for that area.
        </p>
        {candidateAreas.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">All areas with reports already have a briefing.</p>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <SelectField
                value={generateArea}
                onChange={setGenerateArea}
                placeholder="Pick an area…"
                options={candidateAreas.map(a => ({ value: a, label: a }))}
              />
            </div>
            <button
              onClick={() => void handleGenerate(generateArea)}
              disabled={!generateArea || generating}
              className="h-8 px-3 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Generate
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-[var(--red)] bg-[var(--red-dim)] border border-[var(--red)]/40 rounded-[4px] px-3 py-2">
          {error}
        </div>
      )}

      {briefings.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          No briefings yet. Generate one above, or upload reports tagged to a beat to auto-create them.
        </div>
      ) : (
        <div className="space-y-3">
          {briefings.map(b => (
            <BriefingCard
              key={b.id}
              briefing={b}
              refreshing={refreshing === b.area}
              onRefresh={() => void handleRefresh(b.area)}
              onDelete={() => void handleDelete(b.area)}
              onSaveNotes={notes => void saveNotes(b.area, notes)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BriefingCard({
  briefing,
  refreshing,
  onRefresh,
  onDelete,
  onSaveNotes,
}: {
  briefing: Briefing
  refreshing: boolean
  onRefresh: () => void
  onDelete: () => void
  onSaveNotes: (notes: string) => void
}) {
  const [notes, setNotes] = useState(briefing.userNotes ?? '')
  const [savedNotes, setSavedNotes] = useState(briefing.userNotes ?? '')
  const dirty = notes !== savedNotes
  const updated = new Date(briefing.updatedAt)

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-bright)]">{briefing.area}</h3>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {briefing.reportCount} report{briefing.reportCount !== 1 ? 's' : ''} ·
            updated {updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Regenerate from latest reports"
            className="h-7 px-2 rounded-[4px] text-[11px] font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
          <button
            onClick={onDelete}
            title="Delete briefing"
            className="h-7 w-7 rounded-[4px] text-[var(--text-subtle)] hover:text-[var(--red)] hover:bg-[var(--surface-2)] transition-colors flex items-center justify-center"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--text-body)] leading-relaxed whitespace-pre-wrap">{briefing.content}</p>

      <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
        <label className="block text-[11px] font-medium text-[var(--text-subtle)]">Your notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Pinned context that should never decay (added to every AI prompt for this beat)"
          className={cn(inputCls, 'h-auto py-2 resize-y min-h-[3rem]')}
        />
        {dirty && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                onSaveNotes(notes)
                setSavedNotes(notes)
              }}
              className="h-6 px-2 rounded-[4px] text-[11px] font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              <Save size={11} />
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Glossary ─────────────────────────────────────────────────────────────────

function GlossaryPanel({ allAreas }: { allAreas: string[] }) {
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const [fTerm, setFTerm] = useState('')
  const [fDef, setFDef] = useState('')
  const [fScope, setFScope] = useState<string>('global')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge/glossary')
      if (res.ok) {
        const d = (await res.json()) as { terms: Term[] }
        setTerms(d.terms)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return terms.filter(t => {
      if (scopeFilter !== 'all' && t.scope !== scopeFilter) return false
      if (!q) return true
      return t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    })
  }, [terms, query, scopeFilter])

  useEffect(() => {
    setPage(0)
  }, [query, scopeFilter])

  const pageItems = useMemo(
    () => filtered.slice(page * GLOSSARY_PAGE_SIZE, (page + 1) * GLOSSARY_PAGE_SIZE),
    [filtered, page],
  )

  const grouped = useMemo(() => {
    const m = new Map<string, Term[]>()
    for (const t of pageItems) {
      const arr = m.get(t.scope) ?? []
      arr.push(t)
      m.set(t.scope, arr)
    }
    return Array.from(m.entries()).sort(([a], [b]) => {
      if (a === 'global') return -1
      if (b === 'global') return 1
      return a.localeCompare(b)
    })
  }, [pageItems])

  const scopeOptions = useMemo(() => {
    const set = new Set<string>(['global'])
    for (const a of allAreas) set.add(`area:${a}`)
    for (const t of terms) set.add(t.scope)
    return Array.from(set)
  }, [allAreas, terms])

  const filterOptions = useMemo(
    () => [{ value: 'all', label: 'All scopes' }, ...scopeOptions.map(s => ({
      value: s,
      label: s === 'global' ? 'Global' : s.replace('area:', ''),
    }))],
    [scopeOptions],
  )

  const resetForm = () => {
    setFTerm('')
    setFDef('')
    setFScope('global')
    setEditingId(null)
    setShowForm(false)
  }

  const handleSave = async () => {
    if (!fTerm.trim() || !fDef.trim() || !fScope.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/knowledge/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: fTerm.trim(), definition: fDef.trim(), scope: fScope.trim() }),
      })
      if (res.ok) {
        await load()
        resetForm()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this glossary term?')) return
    setTerms(prev => prev.filter(t => t.id !== id))
    await fetch('/api/knowledge/glossary', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  const startEdit = (t: Term) => {
    setEditingId(t.id)
    setFTerm(t.term)
    setFDef(t.definition)
    setFScope(t.scope)
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--text-muted)]">
          {terms.length} term{terms.length !== 1 ? 's' : ''} · injected into AI prompts based on report area
        </p>
        <button
          onClick={() => {
            if (showForm) resetForm()
            else setShowForm(true)
          }}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus size={13} />
          Add term
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search terms or definitions…"
            className={cn(inputCls, 'pl-7')}
          />
        </div>
        <div className="w-44 shrink-0">
          <SelectField
            value={scopeFilter}
            onChange={setScopeFilter}
            options={filterOptions}
          />
        </div>
      </div>

      {showForm && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-bright)]">
              {editingId ? 'Edit term' : 'Add term'}
            </h2>
            <button
              onClick={resetForm}
              className="text-[var(--text-subtle)] hover:text-[var(--text-bright)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-subtle)] mb-1">Term *</label>
              <input
                value={fTerm}
                onChange={e => setFTerm(e.target.value)}
                placeholder="e.g. FOIA"
                disabled={!!editingId}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-subtle)] mb-1">Scope *</label>
              <SelectField
                value={fScope}
                onChange={setFScope}
                options={scopeOptions.map(s => ({
                  value: s,
                  label: s === 'global' ? 'Global (all areas)' : s.replace('area:', '📁 '),
                }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-subtle)] mb-1">Definition *</label>
            <textarea
              value={fDef}
              onChange={e => setFDef(e.target.value)}
              rows={2}
              placeholder="Short, factual definition"
              className={cn(inputCls, 'h-auto py-2 resize-none')}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void handleSave()}
              disabled={saving || !fTerm.trim() || !fDef.trim()}
              className="h-7 px-3 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {editingId ? 'Save' : 'Add'}
            </button>
            <button
              onClick={resetForm}
              className="h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          {terms.length === 0 ? 'No glossary terms yet.' : 'No terms match your filter.'}
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([scope, items]) => (
            <div key={scope}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-subtle)] mb-1.5">
                {scope === 'global' ? 'Global' : scope.replace('area:', '')}
              </h3>
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
                {items.map(t => (
                  <div key={t.id} className="flex items-start gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--text-bright)]">{t.term}</p>
                      <p className="text-xs text-[var(--text-body)] mt-0.5">{t.definition}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(t)}
                        title="Edit"
                        className="h-6 w-6 rounded-[4px] text-[var(--text-subtle)] hover:text-[var(--text-bright)] hover:bg-[var(--surface-2)] transition-colors flex items-center justify-center"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => void handleDelete(t.id)}
                        title="Delete"
                        className="h-6 w-6 rounded-[4px] text-[var(--text-subtle)] hover:text-[var(--red)] hover:bg-[var(--surface-2)] transition-colors flex items-center justify-center"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Pagination page={page} total={filtered.length} onPage={setPage} pageSize={GLOSSARY_PAGE_SIZE} />
        </div>
      )}
    </div>
  )
}
