'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, Plus, RefreshCw, Trash2, Users, Wand2, Share2 } from 'lucide-react'
import OutlineEditor, { type OutlineEvent } from './OutlineEditor'

export interface ClaimItem {
  id: string
  text: string
  status: 'unverified' | 'verified' | 'disputed' | 'awaiting'
}

export interface EvidenceLink {
  id: string
  url: string
  title: string
}

interface ReportOption {
  id: string
  title: string
  area: string
}

interface StructureData {
  id: string
  status: string
  description: string | null
  reportIds: string
  events: string
  claimStatuses: string
}

interface Props {
  entryId: string
  initialStructure: StructureData
  initialEvidence: EvidenceLink[]
  initialShared: boolean
  allReports: ReportOption[]
  onDemote: () => void
  /** Report IDs lifted to parent so the Documents panel and StoryPanel stay in sync. */
  reportIds: string[]
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  writing: 'Writing',
  filed: 'Filed',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[var(--blue-dim)] text-[var(--blue)]',
  writing: 'bg-[var(--amber-dim)] text-[var(--amber)]',
  filed: 'bg-[var(--green-dim)] text-[var(--green)]',
}

const CLAIM_STATUS_COLORS: Record<ClaimItem['status'], string> = {
  unverified: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  verified: 'bg-[var(--green-dim)] text-[var(--green)]',
  disputed: 'bg-[var(--red-dim)] text-[var(--red)]',
  awaiting: 'bg-[var(--amber-dim)] text-[var(--amber)]',
}

function parseJson<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T } catch { return fallback }
}

export default function StoryPanel({
  entryId,
  initialStructure,
  initialEvidence,
  initialShared,
  allReports,
  onDemote,
  reportIds,
}: Props) {
  const [status, setStatus] = useState<string>(initialStructure.status)
  const [description, setDescription] = useState(initialStructure.description ?? '')
  // reportIds owned by parent (Documents panel manages picker)
  void allReports
  const [events, setEvents] = useState<OutlineEvent[]>(parseJson(initialStructure.events, []))
  const [claims, setClaims] = useState<ClaimItem[]>(parseJson(initialStructure.claimStatuses, []))
  const [evidence, setEvidence] = useState<EvidenceLink[]>(initialEvidence)
  const [shared, setShared] = useState(initialShared)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState<'entities' | 'timeline' | null>(null)
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null)
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('')
  const [newEvidenceTitle, setNewEvidenceTitle] = useState('')
  const [addingEvidence, setAddingEvidence] = useState(false)
  const [confirmDemote, setConfirmDemote] = useState(false)

  const descriptionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const patch = useCallback(async (data: Record<string, unknown>) => {
    await fetch(`/api/journal/${entryId}/structure`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }, [entryId])

  // Description: debounced save
  useEffect(() => {
    if (description === (initialStructure.description ?? '')) return
    if (descriptionTimer.current) clearTimeout(descriptionTimer.current)
    descriptionTimer.current = setTimeout(() => {
      patch({ description })
    }, 800)
    return () => { if (descriptionTimer.current) clearTimeout(descriptionTimer.current) }
  }, [description, initialStructure.description, patch])

  const handleStatusChange = (next: string) => {
    setStatus(next)
    patch({ status: next })
  }

  const handleGenerate = async () => {
    if (reportIds.length === 0) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch(`/api/journal/${entryId}/structure/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed' }))
        throw new Error(err.error ?? 'Generation failed')
      }
      const data = await res.json() as {
        narrative: string
        events: OutlineEvent[]
        claims: ClaimItem[]
      }
      setEvents(Array.isArray(data.events) ? data.events : [])
      setClaims(Array.isArray(data.claims) ? data.claims : [])
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleRefresh = async (type: 'entities' | 'timeline') => {
    if (reportIds.length === 0) return
    setRefreshing(type)
    setRefreshMessage(null)
    try {
      const res = await fetch(`/api/journal/${entryId}/structure/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json() as { entitiesRefreshed?: number; eventsRefreshed?: number; error?: string }
      if (data.error) throw new Error(data.error)
      setRefreshMessage(
        type === 'entities'
          ? `${data.entitiesRefreshed ?? 0} entities re-extracted`
          : `${data.eventsRefreshed ?? 0} timeline events re-extracted`
      )
      setTimeout(() => setRefreshMessage(null), 4000)
    } catch (e) {
      setRefreshMessage(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRefreshing(null)
    }
  }

  const handleClaimStatus = (id: string, next: ClaimItem['status']) => {
    const updated = claims.map(c => c.id === id ? { ...c, status: next } : c)
    setClaims(updated)
    patch({ claimStatuses: JSON.stringify(updated) })
  }

  const handleAddEvidence = async () => {
    if (!newEvidenceUrl.trim() || !newEvidenceTitle.trim()) return
    setAddingEvidence(true)
    try {
      const res = await fetch(`/api/journal/${entryId}/structure/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newEvidenceUrl.trim(), title: newEvidenceTitle.trim() }),
      })
      const data = await res.json() as { item: EvidenceLink }
      setEvidence(prev => [...prev, data.item])
      setNewEvidenceUrl('')
      setNewEvidenceTitle('')
    } finally {
      setAddingEvidence(false)
    }
  }

  const handleDeleteEvidence = async (eid: string) => {
    await fetch(`/api/journal/${entryId}/structure/evidence/${eid}`, { method: 'DELETE' })
    setEvidence(prev => prev.filter(e => e.id !== eid))
  }

  const handleShareToggle = async () => {
    const next = !shared
    setShared(next)
    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entryId, shared: next }),
    })
  }

  const handleDemote = async () => {
    if (!confirmDemote) {
      setConfirmDemote(true)
      setTimeout(() => setConfirmDemote(false), 3000)
      return
    }
    await fetch(`/api/journal/${entryId}/structure`, { method: 'DELETE' })
    onDemote()
  }

  return (
    <div className="space-y-4 p-3 overflow-y-auto h-full">
      {/* Status + demote — share toggle moved to story workspace header */}
      <div className="flex items-center gap-2">
        <select
          value={status}
          onChange={e => handleStatusChange(e.target.value)}
          className={`text-xs font-medium px-2 py-1 rounded-[4px] border-0 focus:outline-none focus:ring-2 focus:ring-[var(--ink)] cursor-pointer ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}
        >
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          onClick={handleDemote}
          title="Remove story structure (events, claims, evidence will be deleted)"
          className={`text-xs px-2 py-1 rounded-[4px] border transition-colors ${
            confirmDemote
              ? 'border-[var(--red)] text-[var(--red)] bg-[var(--red-dim)]'
              : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
          }`}
        >
          {confirmDemote ? 'Confirm demote' : 'Demote'}
        </button>
      </div>

      {/* Description */}
      <input
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Working hypothesis…"
        className="w-full text-xs text-[var(--text-subtle)] bg-transparent placeholder-[var(--text-muted)] focus:outline-none border-b border-transparent focus:border-[var(--border)] py-0.5 transition-colors"
      />

      {/* AI brief actions — uses reportIds attached via the Documents panel on the left */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          AI brief
          {reportIds.length > 0 && (
            <span className="ml-1 text-[10px] font-normal text-[var(--text-muted)]">
              ({reportIds.length} doc{reportIds.length !== 1 ? 's' : ''})
            </span>
          )}
        </p>
        {reportIds.length === 0 && (
          <p className="text-[11px] text-[var(--text-muted)] italic">
            Attach documents in the Documents panel on the left to generate a brief.
          </p>
        )}
        <button
          onClick={handleGenerate}
          disabled={generating || reportIds.length === 0}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium rounded-[4px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
          {generating ? 'Generating…' : 'Generate brief'}
        </button>
        {generateError && <p className="text-[11px] text-[var(--red)]">{generateError}</p>}

        {reportIds.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--text-muted)]">Re-extract:</span>
            <button
              onClick={() => handleRefresh('entities')}
              disabled={refreshing !== null}
              className="flex items-center gap-1 text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-bright)] border border-[var(--border)] rounded px-1.5 py-0.5 transition-colors disabled:opacity-40"
            >
              {refreshing === 'entities' ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
              Entities
            </button>
            <button
              onClick={() => handleRefresh('timeline')}
              disabled={refreshing !== null}
              className="flex items-center gap-1 text-[10px] text-[var(--text-subtle)] hover:text-[var(--text-bright)] border border-[var(--border)] rounded px-1.5 py-0.5 transition-colors disabled:opacity-40"
            >
              {refreshing === 'timeline' ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
              Timeline
            </button>
            {refreshMessage && (
              <span className="text-[10px] text-[var(--green)]">{refreshMessage}</span>
            )}
          </div>
        )}
      </div>

      {/* Outline */}
      <OutlineEditor entryId={entryId} initial={events} onChange={setEvents} />

      {/* Claims */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Claims</p>
        {claims.length === 0 ? (
          <p className="text-[11px] text-[var(--text-muted)] italic">No claims yet — generate a brief.</p>
        ) : (
          <div className="space-y-1">
            {claims.map(c => (
              <div key={c.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2 py-1.5">
                <p className="text-xs text-[var(--text-bright)] mb-1">{c.text}</p>
                <div className="flex gap-1">
                  {(['unverified', 'verified', 'disputed', 'awaiting'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => handleClaimStatus(c.id, s)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition-opacity ${
                        c.status === s ? CLAIM_STATUS_COLORS[s] : 'text-[var(--text-muted)] opacity-50 hover:opacity-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Evidence */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1">
          <Users size={11} /> Evidence
        </p>
        {evidence.length > 0 && (
          <div className="space-y-1">
            {evidence.map(e => (
              <div key={e.id} className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2 py-1.5">
                <a href={e.url} target="_blank" rel="noreferrer" className="flex-1 text-xs text-[var(--text-body)] hover:text-[var(--blue)] truncate flex items-center gap-1">
                  <ExternalLink size={10} className="shrink-0" /> {e.title}
                </a>
                <button onClick={() => handleDeleteEvidence(e.id)} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--red)] transition-colors">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          <input
            value={newEvidenceTitle}
            onChange={e => setNewEvidenceTitle(e.target.value)}
            placeholder="Title"
            className="flex-1 text-[11px] border border-[var(--border)] rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--ink)] bg-[var(--surface)] text-[var(--text-body)] min-w-0"
          />
          <input
            value={newEvidenceUrl}
            onChange={e => setNewEvidenceUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddEvidence() }}
            placeholder="URL"
            className="flex-1 text-[11px] border border-[var(--border)] rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--ink)] bg-[var(--surface)] text-[var(--text-body)] min-w-0"
          />
          <button
            onClick={handleAddEvidence}
            disabled={addingEvidence || !newEvidenceUrl.trim() || !newEvidenceTitle.trim()}
            className="shrink-0 p-1 bg-[var(--ink)] text-[var(--ink-contrast)] rounded hover:opacity-90 disabled:opacity-40 transition-colors"
          >
            {addingEvidence ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          </button>
        </div>
      </div>
    </div>
  )
}
