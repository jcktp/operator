'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, Plus, Trash2, Wand2 } from 'lucide-react'
import { parseJsonSafe } from '@/lib/utils'

interface ClaimItem { id: string; text: string; status: 'unverified' | 'verified' | 'disputed' | 'awaiting' }
interface OutlineEvent { id: string; date: string; description: string; actors?: string[] }
interface EvidenceItem { id: string; url: string; title: string }

interface Props {
  projectId: string
  initialStatus: string
  initialDescription: string | null
  initialReportIds: string[]
  initialEvents: string
  initialClaimStatuses: string
  allReports: Array<{ id: string; title: string; area: string }>
  onStatusChange: (status: string) => void
  onDemote: () => void
  /** Called when AI generates a narrative so the parent can apply it to the prose editor. */
  onNarrativeGenerated?: (html: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  draft:   'bg-[var(--blue-dim)] text-[var(--blue)]',
  writing: 'bg-[var(--amber-dim)] text-[var(--amber)]',
  filed:   'bg-[var(--green-dim)] text-[var(--green)]',
}

const CLAIM_COLORS: Record<ClaimItem['status'], string> = {
  unverified: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  verified:   'bg-[var(--green-dim)] text-[var(--green)]',
  disputed:   'bg-[var(--red-dim)] text-[var(--red)]',
  awaiting:   'bg-[var(--amber-dim)] text-[var(--amber)]',
}

export default function StoryStructurePanel({
  projectId, initialStatus, initialDescription, initialReportIds,
  initialEvents, initialClaimStatuses, onStatusChange, onDemote, onNarrativeGenerated,
}: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [description, setDescription] = useState(initialDescription ?? '')
  const [events, setEvents] = useState<OutlineEvent[]>(parseJsonSafe(initialEvents, []))
  const [claims, setClaims] = useState<ClaimItem[]>(parseJsonSafe(initialClaimStatuses, []))
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('')
  const [newEvidenceTitle, setNewEvidenceTitle] = useState('')
  const [addingEvidence, setAddingEvidence] = useState(false)

  // Load evidence on mount — reuses /api/journal/[id]/structure/evidence with projectId as entryId
  useEffect(() => {
    fetch(`/api/journal/${projectId}/structure/evidence`)
      .then(r => r.json())
      .then((d: { items?: EvidenceItem[] }) => setEvidence(d.items ?? []))
      .catch(() => {})
  }, [projectId])

  const handleAddEvidence = async () => {
    if (!newEvidenceUrl.trim() || !newEvidenceTitle.trim()) return
    setAddingEvidence(true)
    try {
      const res = await fetch(`/api/journal/${projectId}/structure/evidence`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newEvidenceUrl.trim(), title: newEvidenceTitle.trim() }),
      })
      const d = await res.json() as { item: EvidenceItem }
      setEvidence(prev => [...prev, d.item])
      setNewEvidenceUrl(''); setNewEvidenceTitle('')
    } finally { setAddingEvidence(false) }
  }

  const handleDeleteEvidence = async (eid: string) => {
    await fetch(`/api/journal/${projectId}/structure/evidence/${eid}`, { method: 'DELETE' })
    setEvidence(prev => prev.filter(e => e.id !== eid))
  }

  const patch = useCallback(async (data: Record<string, unknown>) => {
    await fetch(`/api/projects/${projectId}/story`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  }, [projectId])

  const handleStatusChange = (next: string) => {
    setStatus(next); onStatusChange(next); patch({ storyStatus: next })
  }

  const handleClaimStatus = (id: string, next: ClaimItem['status']) => {
    const updated = claims.map(c => c.id === id ? { ...c, status: next } : c)
    setClaims(updated); patch({ storyClaimStatuses: JSON.stringify(updated) })
  }

  const handleGenerate = async () => {
    if (initialReportIds.length === 0) return
    setGenerating(true); setGenerateError(null)
    try {
      const res = await fetch('/api/stories/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: initialReportIds }),
      })
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed')
      const data = await res.json() as { narrative?: string; events: OutlineEvent[]; claims: ClaimItem[] }
      if (Array.isArray(data.events)) {
        setEvents(data.events)
        patch({ storyEvents: JSON.stringify(data.events) })
      }
      if (Array.isArray(data.claims)) {
        setClaims(data.claims)
        patch({ storyClaimStatuses: JSON.stringify(data.claims) })
      }
      // If a narrative was generated and the editor is ready, insert it into the prose
      if (typeof data.narrative === 'string' && data.narrative.trim()) {
        const html = data.narrative
          .split(/\n\s*\n/)
          .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
          .join('')
        patch({ narrative: html })
        onNarrativeGenerated?.(html)
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Generation failed')
    } finally { setGenerating(false) }
  }

  return (
    <div className="space-y-4 p-3 overflow-y-auto h-full">
      {/* Status + delete */}
      <div className="flex items-center gap-2">
        <select value={status} onChange={e => handleStatusChange(e.target.value)}
          className={`text-xs font-medium px-2 py-1 rounded-[4px] border-0 focus:outline-none cursor-pointer ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
          <option value="draft">Draft</option>
          <option value="writing">Writing</option>
          <option value="filed">Filed</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => {
            if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000) }
            else onDemote()
          }}
          className={`text-xs px-2 py-1 rounded-[4px] border transition-colors ${confirmDelete ? 'border-[var(--red)] text-[var(--red)] bg-[var(--red-dim)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}>
          {confirmDelete ? 'Confirm delete' : 'Delete story'}
        </button>
      </div>

      {/* Description */}
      <input value={description} onChange={e => setDescription(e.target.value)}
        onBlur={() => patch({ storyDescription: description })}
        placeholder="Working hypothesis…"
        className="w-full text-xs text-[var(--text-subtle)] bg-transparent placeholder-[var(--text-muted)] focus:outline-none border-b border-transparent focus:border-[var(--border)] py-0.5 transition-colors" />

      {/* AI brief */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">AI brief</p>
        {initialReportIds.length === 0
          ? <p className="text-[11px] text-[var(--text-muted)] italic">Attach documents in the left panel to generate a brief.</p>
          : <button onClick={handleGenerate} disabled={generating}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium rounded-[4px] hover:opacity-90 disabled:opacity-40 transition-colors">
              {generating ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
              {generating ? 'Generating…' : `Generate brief (${initialReportIds.length} docs)`}
            </button>
        }
        {generateError && <p className="text-[11px] text-[var(--red)]">{generateError}</p>}
      </div>

      {/* Events / timeline */}
      {events.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Timeline · {events.length}</p>
          {events.slice(0, 8).map(e => (
            <div key={e.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2.5 py-2">
              <p className="text-[9px] font-mono text-[var(--text-muted)] mb-0.5">{e.date}</p>
              <p className="text-[12px] text-[var(--text-body)] leading-snug">{e.description}</p>
              {e.actors && e.actors.length > 0 && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{e.actors.join(', ')}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Claims */}
      {claims.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Claims · {claims.length}</p>
          {claims.map(c => (
            <div key={c.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2 py-1.5">
              <p className="text-xs text-[var(--text-bright)] mb-1">{c.text}</p>
              <div className="flex gap-1">
                {(['unverified', 'verified', 'disputed', 'awaiting'] as const).map(s => (
                  <button key={s} onClick={() => handleClaimStatus(c.id, s)}
                    className={`text-[10px] px-1.5 py-0.5 rounded transition-opacity ${c.status === s ? CLAIM_COLORS[s] : 'text-[var(--text-muted)] opacity-50 hover:opacity-100'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Evidence links */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Evidence</p>
        {evidence.map(e => (
          <div key={e.id} className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2 py-1.5">
            <a href={e.url} target="_blank" rel="noreferrer"
              className="flex-1 text-xs text-[var(--text-body)] hover:text-[var(--blue)] truncate flex items-center gap-1">
              <ExternalLink size={10} className="shrink-0" /> {e.title}
            </a>
            <button onClick={() => handleDeleteEvidence(e.id)}
              className="shrink-0 text-[var(--text-muted)] hover:text-[var(--red)] transition-colors">
              <Trash2 size={10} />
            </button>
          </div>
        ))}
        <div className="flex gap-1">
          <input value={newEvidenceTitle} onChange={e => setNewEvidenceTitle(e.target.value)}
            placeholder="Title"
            className="flex-1 text-[11px] border border-[var(--border)] rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--blue)] bg-[var(--surface)] text-[var(--text-body)] min-w-0" />
          <input value={newEvidenceUrl} onChange={e => setNewEvidenceUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddEvidence() }}
            placeholder="URL"
            className="flex-1 text-[11px] border border-[var(--border)] rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--blue)] bg-[var(--surface)] text-[var(--text-body)] min-w-0" />
          <button onClick={handleAddEvidence} disabled={addingEvidence || !newEvidenceUrl.trim() || !newEvidenceTitle.trim()}
            className="shrink-0 p-1 bg-[var(--ink)] text-[var(--ink-contrast)] rounded hover:opacity-90 disabled:opacity-40 transition-colors">
            {addingEvidence ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          </button>
        </div>
      </div>
    </div>
  )
}
