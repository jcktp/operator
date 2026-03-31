'use client'

import { useState, useCallback } from 'react'
import { Loader2, Wand2, Save, Plus, Trash2, ExternalLink, RefreshCw, Users } from 'lucide-react'
import StorylineReportPicker, { type PickerReport } from './StorylineReportPicker'
import StorylineClaims, { type Claim } from './StorylineClaims'
import StorylineSources, { type StorySourceItem, type DirectOption } from './StorylineSources'

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
  description: string | null
  status: string
  reportIds: string
  narrative: string | null
  events: string | null
  claimStatuses: string | null
  evidence: Evidence[]
}

interface Props {
  story: Story
  allReports: PickerReport[]
  allDirects: DirectOption[]
  onUpdate: (story: Story) => void
  onDelete: () => void
}

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback
  try { return JSON.parse(s) as T } catch { return fallback }
}

const STATUS_LABELS: Record<string, string> = {
  researching: 'Researching',
  writing: 'Writing',
  filed: 'Filed',
}

const STATUS_COLORS: Record<string, string> = {
  researching: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
  writing: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  filed: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300',
}

export default function StorylineEditor({ story, allReports, allDirects, onUpdate, onDelete }: Props) {
  const [title, setTitle] = useState(story.title)
  const [description, setDescription] = useState(story.description ?? '')
  const [status, setStatus] = useState(story.status ?? 'researching')
  const [reportIds, setReportIds] = useState<string[]>(parseJson(story.reportIds, []))
  const [narrative, setNarrative] = useState(story.narrative ?? '')
  const [events, setEvents] = useState<Event[]>(parseJson(story.events, []))
  const [claims, setClaims] = useState<Claim[]>(parseJson(story.claimStatuses, []))
  const [evidence, setEvidence] = useState<Evidence[]>(story.evidence)
  const [sources, setSources] = useState<StorySourceItem[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState<'entities' | 'timeline' | null>(null)
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null)
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('')
  const [newEvidenceTitle, setNewEvidenceTitle] = useState('')
  const [addingEvidence, setAddingEvidence] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeSection, setActiveSection] = useState<'brief' | 'sources'>('brief')

  // Load sources on first view
  const handleShowSources = async () => {
    setActiveSection('sources')
    if (!sourcesLoaded) {
      const res = await fetch(`/api/storyline/${story.id}/sources`)
      const data = await res.json() as { sources: StorySourceItem[] }
      setSources(data.sources)
      setSourcesLoaded(true)
    }
  }

  const save = useCallback(async (patch: {
    title?: string
    description?: string
    status?: string
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
    setGenerateError(null)
    try {
      const res = await fetch('/api/storyline/generate', {
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
      const res = await fetch(`/api/storyline/${story.id}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json() as { entitiesRefreshed?: number; eventsRefreshed?: number; error?: string }
      if (data.error) throw new Error(data.error)
      if (type === 'entities') setRefreshMessage(`${data.entitiesRefreshed ?? 0} entities re-extracted`)
      else setRefreshMessage(`${data.eventsRefreshed ?? 0} timeline events re-extracted`)
      setTimeout(() => setRefreshMessage(null), 4000)
    } catch (e) {
      setRefreshMessage(e instanceof Error ? e.message : 'Refresh failed')
    } finally {
      setRefreshing(null)
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
      {/* Title + status + actions */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title !== story.title) save({ title: title.trim() }) }}
            className="flex-1 text-lg font-semibold bg-transparent border-b border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-gray-400 dark:focus:border-zinc-500 focus:outline-none text-gray-900 dark:text-zinc-50 py-0.5 transition-colors"
          />
          {saving && <Loader2 size={13} className="animate-spin text-gray-400 dark:text-zinc-500 shrink-0" />}
          {/* Status picker */}
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); save({ status: e.target.value }) }}
            className={`shrink-0 text-xs font-medium px-2 py-1 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 cursor-pointer ${STATUS_COLORS[status] ?? STATUS_COLORS.researching}`}
          >
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
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
        {/* Description */}
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={() => { if (description !== (story.description ?? '')) save({ description }) }}
          placeholder="Working hypothesis or brief description…"
          className="w-full text-sm text-gray-500 dark:text-zinc-400 bg-transparent placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none border-b border-transparent focus:border-gray-200 dark:focus:border-zinc-700 py-0.5 transition-colors"
        />
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-gray-100 dark:border-zinc-800">
        {(['brief', 'sources'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => tab === 'sources' ? handleShowSources() : setActiveSection('brief')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              activeSection === tab
                ? 'border-gray-900 dark:border-zinc-100 text-gray-900 dark:text-zinc-50'
                : 'border-transparent text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab === 'sources' && <Users size={11} />}
            {tab === 'brief' ? 'Story Brief' : `Sources${sources.length > 0 ? ` (${sources.length})` : ''}`}
          </button>
        ))}
      </div>

      {activeSection === 'sources' && (
        <StorylineSources
          storyId={story.id}
          sources={sources}
          allDirects={allDirects}
          onChange={setSources}
        />
      )}

      {activeSection === 'brief' && (
        <>
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
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {generating ? 'Generating story brief…' : reportIds.length === 0 ? 'Select source documents above first' : narrative ? 'Regenerate story brief' : 'Generate story brief'}
          </button>
          {generateError && (
            <p className="text-xs text-red-500 dark:text-red-400 text-center">{generateError}</p>
          )}

          {/* Refresh actions */}
          {reportIds.length > 0 && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">Re-extract from docs:</p>
              <button
                onClick={() => handleRefresh('entities')}
                disabled={refreshing !== null}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-40"
              >
                {refreshing === 'entities' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Entities
              </button>
              <button
                onClick={() => handleRefresh('timeline')}
                disabled={refreshing !== null}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-40"
              >
                {refreshing === 'timeline' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Timeline
              </button>
              {refreshMessage && (
                <span className="text-xs text-green-600 dark:text-green-400">{refreshMessage}</span>
              )}
            </div>
          )}

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
        </>
      )}
    </div>
  )
}
