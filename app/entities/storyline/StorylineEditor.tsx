'use client'

import { useState, useCallback } from 'react'
import { Loader2, Wand2, Save, Plus, Trash2, ExternalLink } from 'lucide-react'
import StorylineReportPicker, { type PickerReport } from './StorylineReportPicker'
import StorylineClaims, { type Claim } from './StorylineClaims'

interface Event {
  id: string
  date: string
  description: string
  actors: string[]
  claimId?: string
}

interface Evidence {
  id: string
  url: string
  title: string
  notes?: string | null
}

interface Story {
  id: string
  title: string
  reportIds: string
  narrative: string | null
  events: string | null
  claimStatuses: string | null
  evidence: Evidence[]
}

interface Props {
  story: Story
  allReports: PickerReport[]
  onUpdate: (story: Story) => void
  onDelete: () => void
}

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}

export default function StorylineEditor({ story, allReports, onUpdate, onDelete }: Props) {
  const [title, setTitle] = useState(story.title)
  const [reportIds, setReportIds] = useState<string[]>(parseJson(story.reportIds, []))
  const [narrative, setNarrative] = useState(story.narrative ?? '')
  const [events, setEvents] = useState<Event[]>(parseJson(story.events, []))
  const [claims, setClaims] = useState<Claim[]>(parseJson(story.claimStatuses, []))
  const [evidence, setEvidence] = useState<Evidence[]>(story.evidence)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('')
  const [newEvidenceTitle, setNewEvidenceTitle] = useState('')
  const [addingEvidence, setAddingEvidence] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useCallback(async (patch: {
    title?: string
    narrative?: string
    events?: string
    claimStatuses?: string
    reportIds?: string[]
  }) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/storyline/${story.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json() as { story: Story }
      onUpdate(data.story)
    } finally {
      setSaving(false)
    }
  }, [story.id, onUpdate])

  const handleGenerate = async () => {
    if (reportIds.length === 0) return
    setGenerating(true)
    try {
      const res = await fetch('/api/storyline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds }),
      })
      const data = await res.json() as {
        narrative: string
        events: Event[]
        claims: Array<{ id: string; text: string; status: string }>
      }
      const newNarrative = data.narrative ?? ''
      const newEvents = Array.isArray(data.events) ? data.events : []
      const newClaims: Claim[] = Array.isArray(data.claims)
        ? data.claims.map(c => ({ id: c.id, text: c.text, status: (c.status ?? 'unverified') as Claim['status'] }))
        : []
      setNarrative(newNarrative)
      setEvents(newEvents)
      setClaims(newClaims)
      await save({
        narrative: newNarrative,
        events: JSON.stringify(newEvents),
        claimStatuses: JSON.stringify(newClaims),
        reportIds,
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleAddEvidence = async () => {
    if (!newEvidenceUrl.trim() || !newEvidenceTitle.trim()) return
    setAddingEvidence(true)
    try {
      const res = await fetch(`/api/storyline/${story.id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newEvidenceUrl.trim(), title: newEvidenceTitle.trim() }),
      })
      const data = await res.json() as { item: Evidence }
      setEvidence(prev => [...prev, data.item])
      setNewEvidenceUrl('')
      setNewEvidenceTitle('')
    } finally {
      setAddingEvidence(false)
    }
  }

  const handleDeleteEvidence = async (eid: string) => {
    await fetch(`/api/storyline/${story.id}/evidence/${eid}`, { method: 'DELETE' })
    setEvidence(prev => prev.filter(e => e.id !== eid))
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); return }
    await fetch(`/api/storyline/${story.id}`, { method: 'DELETE' })
    onDelete()
  }

  return (
    <div className="space-y-6">
      {/* Title + actions */}
      <div className="flex items-center gap-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() && title !== story.title) save({ title: title.trim() }) }}
          className="flex-1 text-lg font-semibold bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-gray-400 dark:focus:border-zinc-500 focus:outline-none text-gray-900 dark:text-zinc-50 py-0.5 transition-colors"
        />
        {saving && <Loader2 size={13} className="animate-spin text-gray-400 dark:text-zinc-500 shrink-0" />}
        <button
          onClick={handleDelete}
          className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            confirmDelete
              ? 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
              : 'border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
          }`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Report picker */}
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Source documents</p>
        <StorylineReportPicker
          reports={allReports}
          selected={reportIds}
          onChange={ids => { setReportIds(ids); save({ reportIds: ids }) }}
        />
      </div>

      {/* Generate brief */}
      <button
        onClick={handleGenerate}
        disabled={generating || reportIds.length === 0}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40"
      >
        {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
        {generating ? 'Generating story brief…' : narrative ? 'Regenerate story brief' : 'Generate story brief'}
      </button>

      {/* Narrative */}
      {narrative && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide">Narrative</p>
            <button
              onClick={() => save({ narrative })}
              className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 flex items-center gap-1"
            >
              <Save size={10} /> Save edits
            </button>
          </div>
          <textarea
            value={narrative}
            onChange={e => setNarrative(e.target.value)}
            rows={8}
            className="w-full text-sm text-gray-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 resize-none leading-relaxed"
          />
        </div>
      )}

      {/* Events */}
      {events.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Timeline</p>
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="flex gap-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2.5">
                <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0 w-24 mt-0.5">{e.date}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-zinc-100">{e.description}</p>
                  {e.actors.length > 0 && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{e.actors.join(', ')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claims */}
      {claims.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Claims</p>
          <StorylineClaims
            claims={claims}
            onChange={updated => {
              setClaims(updated)
              save({ claimStatuses: JSON.stringify(updated) })
            }}
          />
        </div>
      )}

      {/* Evidence */}
      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Evidence</p>
        {evidence.length > 0 && (
          <div className="space-y-1 mb-3">
            {evidence.map(e => (
              <div key={e.id} className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg px-3 py-2">
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-xs text-gray-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 truncate flex items-center gap-1"
                >
                  <ExternalLink size={10} className="shrink-0" />
                  {e.title}
                </a>
                <button
                  onClick={() => handleDeleteEvidence(e.id)}
                  className="shrink-0 text-gray-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={newEvidenceTitle}
            onChange={e => setNewEvidenceTitle(e.target.value)}
            placeholder="Source title"
            className="flex-1 text-xs border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <input
            value={newEvidenceUrl}
            onChange={e => setNewEvidenceUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddEvidence() }}
            placeholder="URL"
            className="flex-1 text-xs border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <button
            onClick={handleAddEvidence}
            disabled={addingEvidence || !newEvidenceUrl.trim() || !newEvidenceTitle.trim()}
            className="shrink-0 p-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
          >
            {addingEvidence ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          </button>
        </div>
      </div>
    </div>
  )
}
