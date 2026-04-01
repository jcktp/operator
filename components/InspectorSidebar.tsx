'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, ScanSearch, MapPin, FileText, Users, StickyNote, ChevronDown } from 'lucide-react'
import { useInspector, type InspectorItem } from './InspectorContext'
import { formatRelativeDate } from '@/lib/utils'

const ENTITY_COLORS: Record<string, string> = {
  person: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
  organisation: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  location: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  date: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  financial: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
}
const ENTITY_LABELS: Record<string, string> = {
  person: 'Person', organisation: 'Org', location: 'Location', date: 'Date', financial: 'Financial',
}

interface ProfileData {
  appearances: Array<{ reportId: string; reportTitle: string; area: string; context: string | null; createdAt: string }>
  coEntities: Array<{ name: string; entityType: string; sharedCount: number }>
}

function EntityBadge({ entityType }: { entityType: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${ENTITY_COLORS[entityType] ?? 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'}`}>
      {ENTITY_LABELS[entityType] ?? entityType}
    </span>
  )
}

function EntityView({ item }: { item: Extract<InspectorItem, { type: 'entity' }> }) {
  const { setSelected } = useInspector()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

  const noteKey = `inspector_note_${item.entityType}_${item.name}`

  useEffect(() => {
    setLoading(true)
    setProfile(null)
    setNote(localStorage.getItem(noteKey) ?? '')
    fetch(`/api/entities/profile?name=${encodeURIComponent(item.name)}&type=${encodeURIComponent(item.entityType)}`)
      .then(r => r.json())
      .then((d: ProfileData) => setProfile(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [item.name, item.entityType, noteKey])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Source footprint */}
      <section className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1.5 mb-2">
          <FileText size={10} /> Source Footprint
        </h3>
        {loading && <p className="text-xs text-gray-400 dark:text-zinc-500">Loading…</p>}
        {!loading && profile && profile.appearances.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-zinc-500">No documents found.</p>
        )}
        {!loading && profile && profile.appearances.map(a => (
          <Link
            key={a.reportId}
            href={`/reports/${a.reportId}`}
            className="block py-1.5 group"
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 mt-0.5">{a.area}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate leading-tight">{a.reportTitle}</p>
                {a.context && <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5 line-clamp-2 italic">&ldquo;{a.context}&rdquo;</p>}
                <p className="text-[10px] text-gray-300 dark:text-zinc-600 mt-0.5">{formatRelativeDate(new Date(a.createdAt))}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      {/* Connected entities */}
      {!loading && profile && profile.coEntities.length > 0 && (
        <section className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1.5 mb-2">
            <Users size={10} /> Connected Entities
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.coEntities.map(e => (
              <button
                key={`${e.entityType}::${e.name}`}
                onClick={() => setSelected({ type: 'entity', name: e.name, entityType: e.entityType })}
                className="flex items-center gap-1 group"
                title={`${e.sharedCount} shared doc${e.sharedCount !== 1 ? 's' : ''}`}
              >
                <EntityBadge entityType={e.entityType} />
                <span className="text-xs text-gray-600 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{e.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Analyst notes */}
      <section className="px-4 py-3">
        <button
          onClick={() => setNoteOpen(v => !v)}
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors w-full"
        >
          <StickyNote size={10} /> Analyst Notes
          <ChevronDown size={10} className={`ml-auto transition-transform ${noteOpen ? 'rotate-180' : ''}`} />
        </button>
        {noteOpen && (
          <textarea
            value={note}
            onChange={e => { setNote(e.target.value); localStorage.setItem(noteKey, e.target.value) }}
            placeholder="Add observations about this entity…"
            rows={2}
            className="mt-2 w-full text-xs border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 placeholder-gray-300 dark:placeholder-zinc-600 overflow-y-auto max-h-48"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
        )}
      </section>
    </div>
  )
}

function LocationView({ item }: { item: Extract<InspectorItem, { type: 'location' }> }) {
  const hasContexts = item.contextsByReport.length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <section className="px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 flex items-center gap-1.5 mb-3">
          <FileText size={10} /> What happened here
        </h3>

        {!hasContexts && (
          <div className="space-y-1">
            {item.reportIds.map(id => (
              <Link
                key={id}
                href={`/reports/${id}`}
                className="block text-xs text-gray-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 py-0.5"
              >
                {item.reportTitles[id] ?? id} →
              </Link>
            ))}
          </div>
        )}

        {hasContexts && (
          <div className="space-y-4">
            {item.contextsByReport.map((entry, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 shrink-0">{entry.area}</span>
                  <Link
                    href={`/reports/${entry.reportId}`}
                    className="text-xs font-medium text-gray-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                  >
                    {entry.reportTitle}
                  </Link>
                </div>
                <p className="text-xs text-gray-600 dark:text-zinc-300 leading-relaxed pl-0.5">
                  {entry.context}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function InspectorSidebar() {
  const { selected, close } = useInspector()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {selected?.type === 'entity' && (
            <>
              <EntityBadge entityType={selected.entityType} />
              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50 truncate">{selected.name}</span>
            </>
          )}
          {selected?.type === 'location' && (
            <>
              <MapPin size={13} className="text-indigo-500 shrink-0" />
              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50 truncate">{selected.name}</span>
            </>
          )}
          {!selected && (
            <span className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Inspector</span>
          )}
        </div>
        {selected && (
          <button
            onClick={close}
            className="shrink-0 p-1 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 rounded transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {!selected && (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-16">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
              <ScanSearch size={18} className="text-gray-400 dark:text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">Nothing selected</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">Click an entity or map pin to inspect it here</p>
            </div>
          </div>
        )}
        {selected?.type === 'entity' && <EntityView item={selected} />}
        {selected?.type === 'location' && <LocationView item={selected} />}
      </div>
    </div>
  )
}
