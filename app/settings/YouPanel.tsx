'use client'

import { useState, useEffect } from 'react'
import { Trash2, Plus, Loader2 } from 'lucide-react'
import Pagination from './KnowledgePagination'

const PAGE_SIZE = 10

export default function YouPanel() {
  const [facts, setFacts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newFact, setNewFact] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingFact, setDeletingFact] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    fetch('/api/dispatch/memory')
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() as Promise<{ memory?: string }> })
      .then(d => {
        const raw = d.memory ?? ''
        setFacts(raw.split('\n').map(f => f.trim()).filter(Boolean))
      })
      .catch(err => console.error('Failed to load user memory:', err))
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
    setPage(Math.floor(facts.length / PAGE_SIZE))
  }

  async function deleteFact(fact: string) {
    setDeletingFact(fact)
    await fetch('/api/dispatch/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact }),
    })
    setFacts(prev => {
      const next = prev.filter(f => f !== fact)
      const maxPage = Math.max(0, Math.ceil(next.length / PAGE_SIZE) - 1)
      if (page > maxPage) setPage(maxPage)
      return next
    })
    setDeletingFact(null)
  }

  async function clearAll() {
    await fetch('/api/dispatch/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory: '' }),
    })
    setFacts([])
    setPage(0)
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-[var(--text-muted)]" /></div>

  const pageFacts = facts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={newFact}
          onChange={e => setNewFact(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addFact()}
          placeholder="Add a fact the AI should remember…"
          className="flex-1 h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
        />
        <button
          onClick={addFact}
          disabled={saving || !newFact.trim()}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium disabled:opacity-40"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">{facts.length} fact{facts.length !== 1 ? 's' : ''} stored</p>
        {facts.length > 0 && (
          <button onClick={clearAll} className="text-xs text-[var(--red)] hover:text-red-700">Clear all</button>
        )}
      </div>

      <div className="space-y-1.5">
        {pageFacts.map((fact, i) => (
          <div key={i} className="flex items-start gap-2 bg-[var(--surface-2)] rounded-[4px] px-3 py-2">
            <span className="flex-1 text-sm text-[var(--text-body)] leading-snug">{fact}</span>
            <button
              onClick={() => deleteFact(fact)}
              disabled={deletingFact === fact}
              className="text-[var(--text-muted)] hover:text-[var(--red)] shrink-0 mt-0.5"
            >
              {deletingFact === fact ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        ))}
        {facts.length === 0 && (
          <p className="text-xs text-[var(--text-muted)] py-2">No facts stored yet. The AI saves facts automatically during Dispatch, or add one above.</p>
        )}
      </div>

      <Pagination page={page} total={facts.length} onPage={setPage} />
    </div>
  )
}
