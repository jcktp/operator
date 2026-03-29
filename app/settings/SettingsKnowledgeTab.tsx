'use client'

import { useState, useEffect } from 'react'
import { Trash2, Plus, RefreshCw, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlossaryTerm {
  id: string
  term: string
  definition: string
  scope: string
  createdAt: string
}

interface AreaBriefing {
  id: string
  area: string
  mode: string
  content: string
  reportCount: number
  updatedAt: string
}

// ── You panel (user memory) ───────────────────────────────────────────────────

function YouPanel() {
  const [facts, setFacts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newFact, setNewFact] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingFact, setDeletingFact] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dispatch/memory')
      .then(r => r.json() as Promise<{ memory?: string }>)
      .then(d => {
        const raw = d.memory ?? ''
        setFacts(raw.split('\n').map(f => f.trim()).filter(Boolean))
      })
      .finally(() => setLoading(false))
  }, [])

  async function addFact() {
    const fact = newFact.trim()
    if (!fact) return
    setSaving(true)
    await fetch('/api/dispatch/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact }),
    })
    setFacts(prev => [...prev, fact])
    setNewFact('')
    setSaving(false)
  }

  async function deleteFact(fact: string) {
    setDeletingFact(fact)
    await fetch('/api/dispatch/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact }),
    })
    setFacts(prev => prev.filter(f => f !== fact))
    setDeletingFact(null)
  }

  async function clearAll() {
    await fetch('/api/dispatch/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory: '' }),
    })
    setFacts([])
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{facts.length} fact{facts.length !== 1 ? 's' : ''} stored</p>
        {facts.length > 0 && (
          <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
        )}
      </div>

      <div className="space-y-1.5">
        {facts.map((fact, i) => (
          <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="flex-1 text-sm text-gray-800 leading-snug">{fact}</span>
            <button
              onClick={() => deleteFact(fact)}
              disabled={deletingFact === fact}
              className="text-gray-400 hover:text-red-500 shrink-0 mt-0.5"
            >
              {deletingFact === fact ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        ))}
        {facts.length === 0 && (
          <p className="text-xs text-gray-400 py-2">No facts stored yet. The AI saves facts automatically during Dispatch, or add one below.</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newFact}
          onChange={e => setNewFact(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addFact()}
          placeholder="Add a fact the AI should remember…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button
          onClick={addFact}
          disabled={saving || !newFact.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-40"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>
    </div>
  )
}

// ── Glossary panel ────────────────────────────────────────────────────────────

const SCOPE_OPTIONS = [
  { value: 'global',              label: 'Global (all modes)' },
  { value: 'mode:executive',      label: 'Executive mode' },
  { value: 'mode:consulting',     label: 'Consulting mode' },
  { value: 'mode:journalism',     label: 'Journalism mode' },
  { value: 'mode:team-lead',      label: 'Team Lead mode' },
  { value: 'mode:market-research', label: 'Market Research mode' },
  { value: 'mode:legal',          label: 'Legal mode' },
]

function scopeLabel(scope: string): string {
  if (scope === 'global') return 'Global'
  if (scope.startsWith('mode:')) return scope.replace('mode:', '') + ' mode'
  if (scope.startsWith('area:')) return 'Area: ' + scope.replace('area:', '')
  return scope
}

function GlossaryPanel() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([])
  const [loading, setLoading] = useState(true)
  const [newTerm, setNewTerm] = useState('')
  const [newDef, setNewDef] = useState('')
  const [newScope, setNewScope] = useState('global')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/knowledge/glossary')
      .then(r => r.json() as Promise<{ terms?: GlossaryTerm[] }>)
      .then(d => setTerms(d.terms ?? []))
      .finally(() => setLoading(false))
  }, [])

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
    setTerms(prev => prev.filter(t => t.id !== id))
    setDeletingId(null)
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-400" /></div>

  // Group by scope
  const grouped: Record<string, GlossaryTerm[]> = {}
  for (const t of terms) {
    grouped[t.scope] = grouped[t.scope] ?? []
    grouped[t.scope].push(t)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{terms.length} term{terms.length !== 1 ? 's' : ''} — injected into AI analysis to ensure correct interpretation of abbreviations.</p>

      <div className="space-y-4">
        {Object.entries(grouped).map(([scope, scopeTerms]) => (
          <div key={scope}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">{scopeLabel(scope)}</p>
            <div className="space-y-1">
              {scopeTerms.map(t => (
                <div key={t.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-gray-900 w-28 shrink-0">{t.term}</span>
                  <span className="flex-1 text-sm text-gray-600">{t.definition}</span>
                  <button
                    onClick={() => deleteTerm(t.id)}
                    disabled={deletingId === t.id}
                    className="text-gray-400 hover:text-red-500 shrink-0"
                  >
                    {deletingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {terms.length === 0 && (
          <p className="text-xs text-gray-400 py-2">No terms yet. Add your first term below.</p>
        )}
      </div>

      {/* Add term row */}
      <div className="border border-gray-200 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-gray-700">Add term</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTerm}
            onChange={e => setNewTerm(e.target.value)}
            placeholder="Term (e.g. ARR)"
            className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <input
            type="text"
            value={newDef}
            onChange={e => setNewDef(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTerm()}
            placeholder="Definition"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={newScope}
              onChange={e => setNewScope(e.target.value)}
              className="w-full appearance-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 pr-8"
            >
              {SCOPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={addTerm}
            disabled={saving || !newTerm.trim() || !newDef.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-40 shrink-0"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Area knowledge panel ──────────────────────────────────────────────────────

function AreaKnowledgePanel() {
  const [briefings, setBriefings] = useState<AreaBriefing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingArea, setRefreshingArea] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/knowledge/briefings')
      .then(r => r.json() as Promise<{ briefings?: AreaBriefing[] }>)
      .then(d => setBriefings(d.briefings ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function refresh(area: string) {
    setRefreshingArea(area)
    try {
      const res = await fetch('/api/knowledge/briefings/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area }),
      })
      if (res.ok) {
        // Re-fetch to get updated briefing
        const updated = await fetch('/api/knowledge/briefings').then(r => r.json() as Promise<{ briefings?: AreaBriefing[] }>)
        setBriefings(updated.briefings ?? [])
      }
    } finally {
      setRefreshingArea(null)
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-400" /></div>

  if (briefings.length === 0) {
    return (
      <div className="text-center py-8 space-y-1">
        <p className="text-sm text-gray-500">No area briefings yet.</p>
        <p className="text-xs text-gray-400">Upload reports to any area and the AI will automatically build a context briefing for it.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Auto-generated from your uploaded reports. Updated each time a new report is analysed.</p>
      {briefings.map(b => (
        <div key={b.id} className="border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{b.area}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {b.reportCount} report{b.reportCount !== 1 ? 's' : ''} · updated {new Date(b.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => refresh(b.area)}
              disabled={refreshingArea === b.area}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50',
                refreshingArea === b.area && 'opacity-60 pointer-events-none'
              )}
            >
              <RefreshCw size={12} className={cn(refreshingArea === b.area && 'animate-spin')} />
              Refresh
            </button>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{b.content}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

type KnowledgePanel = 'you' | 'glossary' | 'area'

export default function SettingsKnowledgeTab() {
  const [panel, setPanel] = useState<KnowledgePanel>('you')

  const panels: { id: KnowledgePanel; label: string }[] = [
    { id: 'you',      label: 'You' },
    { id: 'glossary', label: 'Glossary' },
    { id: 'area',     label: 'Area knowledge' },
  ]

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex gap-4 border-b border-gray-200">
        {panels.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPanel(p.id)}
            className={cn(
              'pb-2 text-xs font-medium transition-colors border-b-2 -mb-px',
              panel === p.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        {panel === 'you'      && <><h2 className="text-sm font-semibold text-gray-900 mb-4">Your context</h2><YouPanel /></>}
        {panel === 'glossary' && <><h2 className="text-sm font-semibold text-gray-900 mb-4">Glossary</h2><GlossaryPanel /></>}
        {panel === 'area'     && <><h2 className="text-sm font-semibold text-gray-900 mb-4">Area knowledge</h2><AreaKnowledgePanel /></>}
      </div>
    </div>
  )
}
