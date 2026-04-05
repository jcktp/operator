'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, Users, Building2, MapPin, Calendar, AlertTriangle, StickyNote, FileText, ScanSearch, X, Search, Wand2, Loader2 } from 'lucide-react'
import { useInspector } from '@/components/InspectorContext'
import { formatRelativeDate } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface EntityGroup {
  type: string
  entities: Array<{ name: string; count: number }>
}

interface TimelineEvent {
  id: string
  dateText: string
  event: string
  report: { id: string; title: string; area: string }
}

interface StoryItem {
  id: string
  title: string
  unverified: number
  updatedAt: string
}

interface Props {
  entityGroups: EntityGroup[]
  recentEvents: TimelineEvent[]
  storySummaries: StoryItem[]
  totalEntities: number
  totalEvents: number
  unverifiedCount: number
  projectId?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  person: <Users size={12} />,
  organisation: <Building2 size={12} />,
  location: <MapPin size={12} />,
  date: <Calendar size={12} />,
}
const ENTITY_LABEL: Record<string, string> = {
  person: 'People', organisation: 'Organisations', location: 'Locations',
  date: 'Dates', financial: 'Financial',
}
const ENTITY_COLORS: Record<string, string> = {
  person: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
  organisation: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  location: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  date: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  financial: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
}

// ── Context & Notes sidebar ──────────────────────────────────────────────────

interface ProfileData {
  appearances: Array<{ reportId: string; reportTitle: string; area: string; context: string | null; createdAt: string }>
  coEntities: Array<{ name: string; entityType: string; sharedCount: number }>
}

function ContextNotesSidebar() {
  const { selected, setSelected, close } = useInspector()
  const [note, setNote] = useState('')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)

  const noteKey = selected?.type === 'entity'
    ? `inspector_note_${selected.entityType}_${selected.name}`
    : null

  useEffect(() => {
    if (!selected || selected.type !== 'entity') { setProfile(null); return }
    const savedNote = noteKey ? (localStorage.getItem(noteKey) ?? '') : ''
    setNote(savedNote)
    setLoading(true)
    fetch(`/api/entities/profile?name=${encodeURIComponent(selected.name)}&type=${encodeURIComponent(selected.entityType)}`)
      .then(r => r.json())
      .then((d: ProfileData) => setProfile(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selected?.type === 'entity' ? selected.name : null, selected?.type === 'entity' ? selected.entityType : null])

  const hasSelection = selected !== null

  return (
    <aside className="w-72 shrink-0 h-full flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 shrink-0">
        <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Context & Notes</span>
        {hasSelection && (
          <button onClick={close} className="p-1 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 rounded transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Analyst Notes — always visible */}
        <section className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1.5 mb-2">
            <StickyNote size={10} /> Analyst Notes
          </h3>
          <textarea
            value={note}
            onChange={e => {
              setNote(e.target.value)
              if (noteKey) localStorage.setItem(noteKey, e.target.value)
            }}
            placeholder="Add observation…"
            rows={2}
            className="w-full text-xs border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 placeholder-gray-300 dark:placeholder-zinc-600 overflow-y-auto max-h-48"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
        </section>

        {/* Entity Cross-References */}
        <section className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1.5 mb-2">
            <FileText size={10} /> Entity Cross-References
          </h3>
          {!hasSelection && (
            <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
              <ScanSearch size={16} className="text-gray-300 dark:text-zinc-600" />
              <p className="text-[10px] text-gray-400 dark:text-zinc-500">Dynamically populates based on selected entities or timeline events on the left.</p>
            </div>
          )}
          {hasSelection && selected.type === 'entity' && (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${ENTITY_COLORS[selected.entityType] ?? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'}`}>
                  {ENTITY_LABEL[selected.entityType] ?? selected.entityType}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50 truncate">{selected.name}</span>
              </div>
              {loading && <p className="text-xs text-gray-400 dark:text-zinc-500">Loading…</p>}
              {!loading && profile && profile.appearances.map(a => (
                <Link key={a.reportId} href={`/reports/${a.reportId}`} className="flex items-start gap-2 py-1.5 group">
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 mt-0.5">{a.area}</span>
                  <p className="text-xs text-gray-700 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">{a.reportTitle}</p>
                </Link>
              ))}
            </>
          )}
          {hasSelection && selected.type === 'location' && (
            <div className="space-y-1">
              {selected.reportIds.map(id => (
                <Link key={id} href={`/reports/${id}`} className="block text-xs text-gray-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate py-0.5">
                  {selected.reportTitles[id] ?? id}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Related Entities */}
        {hasSelection && selected.type === 'entity' && !loading && profile && profile.coEntities.length > 0 && (
          <section className="px-4 py-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1.5 mb-2">
              <Users size={10} /> Related Entities
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {profile.coEntities.map(e => (
                <button
                  key={`${e.entityType}::${e.name}`}
                  onClick={() => setSelected({ type: 'entity', name: e.name, entityType: e.entityType })}
                  className="flex items-center gap-1 group"
                  title={`${e.sharedCount} shared doc${e.sharedCount !== 1 ? 's' : ''}`}
                >
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${ENTITY_COLORS[e.entityType] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {ENTITY_LABEL[e.entityType] ?? e.entityType}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{e.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  )
}

// ── Ask bar ──────────────────────────────────────────────────────────────────

const QUESTION_PATTERNS = /^(what|when|who|where|how|which|why|tell me|show me|list|summarize|how many|find)/i
function isQuestion(text: string) {
  return QUESTION_PATTERNS.test(text.trim()) || text.trim().endsWith('?')
}

interface AiAnswer { text: string; sources: Array<{ id: string; title: string }> }

function BriefAskBar({ projectId }: { projectId?: string | null }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<AiAnswer | null>(null)
  const [error, setError] = useState('')

  const showHint = isQuestion(query.trim()) && query.trim().length > 3

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q || !isQuestion(q)) return
    setLoading(true)
    setAnswer(null)
    setError('')
    try {
      const res = await fetch('/api/entities-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, projectId }),
      })
      const data = await res.json() as { answer?: string; sources?: Array<{ id: string; title: string }>; error?: string }
      if (!res.ok || data.error) setError(data.error ?? 'Something went wrong')
      else setAnswer({ text: data.answer ?? '', sources: data.sources ?? [] })
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => { setQuery(''); setAnswer(null); setError('') }

  return (
    <div>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          {showHint
            ? <Wand2 size={14} className="absolute left-3 text-indigo-400 dark:text-indigo-500 pointer-events-none" />
            : <Search size={14} className="absolute left-3 text-gray-400 dark:text-zinc-500 pointer-events-none" />
          }
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setAnswer(null); setError('') }}
            placeholder="Ask a question about your intelligence…"
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600 transition-shadow"
          />
          {query && (
            <button type="button" onClick={clear} className="absolute right-3 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">
              <X size={13} />
            </button>
          )}
        </div>
        {showHint && (
          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1 ml-1">Press Enter to ask AI</p>
        )}
      </form>
      {(loading || answer || error) && (
        <div className="mt-2 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 p-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-indigo-500 dark:text-indigo-400">
              <Loader2 size={12} className="animate-spin" /> Analysing…
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {answer && (
            <>
              <p className="text-sm text-gray-800 dark:text-zinc-200 leading-relaxed">{answer.text}</p>
              {answer.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                  {answer.sources.map(s => (
                    <Link
                      key={s.id}
                      href={`/reports/${s.id}`}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                    >
                      <FileText size={10} />
                      {s.title.length > 40 ? s.title.slice(0, 40) + '…' : s.title}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function IntelligenceBriefClient({
  entityGroups, recentEvents, storySummaries, totalEntities, totalEvents, unverifiedCount, projectId,
}: Props) {
  const { setSelected } = useInspector()

  return (
    <div className="flex flex-col h-full">
      {/* Ask bar — fixed, never scrolls */}
      <div className="shrink-0 pb-3">
        <BriefAskBar projectId={projectId} />
      </div>

      {/* Three-column layout */}
      <div className="flex-1 min-h-0 flex gap-6">
      {/* Left canvas */}
      <div className="flex-1 min-w-0 overflow-y-auto space-y-6 pr-1">

        {/* Entity summary card */}
        {entityGroups.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Entities</h2>
              <Link href="/entities" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                All <ArrowRight size={10} />
              </Link>
            </div>
            <div className={`grid gap-4 ${entityGroups.length >= 3 ? 'grid-cols-3' : entityGroups.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {entityGroups.map(({ type, entities }) => (
                <div key={type}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-gray-400 dark:text-zinc-500">{ENTITY_ICONS[type]}</span>
                    <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">{ENTITY_LABEL[type] ?? type}</span>
                    <span className="text-xl font-semibold text-gray-900 dark:text-zinc-50 ml-1">{entities.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entities.slice(0, 4).map(e => (
                      <button
                        key={e.name}
                        onClick={() => setSelected({ type: 'entity', name: e.name, entityType: type })}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stories */}
        {storySummaries.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50 flex items-center gap-1.5">
                {unverifiedCount > 0 && <AlertTriangle size={13} className="text-amber-500" />}
                Stories
              </h2>
              <Link href="/entities?tab=storyline" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                All stories <ArrowRight size={10} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {storySummaries.slice(0, 4).map(s => (
                <Link
                  key={s.id}
                  href="/entities?tab=storyline"
                  className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl px-4 py-3 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all"
                >
                  <p className="text-xs font-medium text-gray-800 dark:text-zinc-100 line-clamp-2 mb-2">{s.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 dark:text-zinc-500">{formatRelativeDate(new Date(s.updatedAt))}</span>
                    {s.unverified > 0 && (
                      <span className="text-[10px] font-medium bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                        {s.unverified} unverified
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Timeline thread */}
        {recentEvents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Timeline</h2>
              <Link href="/entities?tab=timeline" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
                Full timeline <ArrowRight size={10} />
              </Link>
            </div>
            <div className="relative border-l-2 border-gray-200 dark:border-zinc-800 ml-1">
              {recentEvents.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => setSelected({ type: 'entity', name: ev.event.slice(0, 60), entityType: 'date' })}
                  className="relative pl-6 pb-5 last:pb-0 text-left w-full group"
                >
                  <span className="absolute left-0 top-[8px] -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 bg-white dark:bg-zinc-950 border-gray-300 dark:border-zinc-600 transition-all duration-300 group-hover:w-3 group-hover:h-3 group-hover:bg-red-500 group-hover:border-red-500"
                    style={{ ['--tw-shadow' as string]: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.animation = 'briefPulse 1.4s ease-in-out infinite' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.animation = '' }}
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-mono text-gray-400 dark:text-zinc-500">{ev.dateText}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400">{ev.report.area}</span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-zinc-200 leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{ev.event}</p>
                  <Link
                    href={`/reports/${ev.report.id}`}
                    onClick={e => e.stopPropagation()}
                    className="text-xs text-gray-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline mt-0.5 block"
                  >
                    {ev.report.title}
                  </Link>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Context & Notes */}
      <ContextNotesSidebar />
      </div>
    </div>
  )
}
