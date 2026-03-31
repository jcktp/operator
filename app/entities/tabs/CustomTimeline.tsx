'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

export interface TimelineEvent {
  id: string
  dateText: string
  dateSortKey: string | null
  event: string
  reportId: string
  reportTitle: string
  area: string
  sourceName?: string | null
}

interface Props {
  events: TimelineEvent[]
}

function getYearMonth(event: TimelineEvent): { year: string; month: string | null } {
  if (event.dateSortKey) {
    const parts = event.dateSortKey.split('-')
    const year = parts[0]
    const month = parts[1] ?? null
    if (year && /^\d{4}$/.test(year)) {
      return { year, month: month && /^\d{2}$/.test(month) ? month : null }
    }
  }
  const m = event.dateText.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)
  if (m) return { year: m[1], month: null }
  return { year: 'Unknown', month: null }
}

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function groupKey(event: TimelineEvent): string {
  const { year, month } = getYearMonth(event)
  return month ? `${year}-${month}` : year
}

function groupLabel(key: string): string {
  if (key === 'Unknown') return 'Unknown date'
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split('-')
    return `${MONTH_NAMES[parseInt(month)]} ${year}`
  }
  return key
}

interface EventCardProps {
  event: TimelineEvent
  expanded: boolean
  onToggle: () => void
}

function EventCard({ event, expanded, onToggle }: EventCardProps) {
  return (
    <div
      className="relative pl-6 cursor-pointer group"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
    >
      {/* dot on the timeline line */}
      <span className="absolute left-0 top-[6px] w-2 h-2 rounded-full bg-gray-400 dark:bg-zinc-500 group-hover:bg-gray-600 dark:group-hover:bg-zinc-300 transition-colors" />

      <div className="pb-5">
        {/* date + area row */}
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs font-mono text-gray-400 dark:text-zinc-500 select-none">
            {event.dateText}
          </span>
          {event.area && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 font-medium">
              {event.area}
            </span>
          )}
          {event.sourceName && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400">
              {event.sourceName}
            </span>
          )}
        </div>

        {/* event text */}
        <p className="text-sm text-gray-800 dark:text-zinc-200 leading-snug">
          {event.event}
        </p>

        {/* expanded: source link */}
        {expanded && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-gray-400 dark:text-zinc-500">Source:</span>
            <Link
              href={`/reports/${event.reportId}`}
              className="text-xs text-gray-600 dark:text-zinc-300 underline underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              onClick={e => e.stopPropagation()}
            >
              {event.reportTitle}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CustomTimeline({ events }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeArea, setActiveArea] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const areas = useMemo(
    () => [...new Set(events.map(e => e.area).filter(Boolean))].sort(),
    [events]
  )

  const filtered = useMemo(() => {
    let result = events
    if (activeArea) result = result.filter(e => e.area === activeArea)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        e =>
          e.event.toLowerCase().includes(q) ||
          e.reportTitle.toLowerCase().includes(q) ||
          e.dateText.toLowerCase().includes(q)
      )
    }
    return result
  }, [events, activeArea, search])

  // Group into ordered buckets: known dates first, then Unknown
  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const e of filtered) {
      const key = groupKey(e)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    const known: [string, TimelineEvent[]][] = []
    const unknown: [string, TimelineEvent[]][] = []
    for (const entry of map.entries()) {
      if (entry[0] === 'Unknown') unknown.push(entry)
      else known.push(entry)
    }
    known.sort((a, b) => a[0].localeCompare(b[0]))
    return [...known, ...unknown]
  }, [filtered])

  const toggle = (id: string) => setExpandedId(prev => (prev === id ? null : id))

  return (
    <div className="space-y-4">
      {/* filters row */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Search events…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500 w-48"
        />
        {areas.length > 1 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveArea(null)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                activeArea === null
                  ? 'bg-gray-800 dark:bg-zinc-200 text-white dark:text-zinc-900'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              All
            </button>
            {areas.map(area => (
              <button
                key={area}
                onClick={() => setActiveArea(activeArea === area ? null : area)}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                  activeArea === area
                    ? 'bg-gray-800 dark:bg-zinc-200 text-white dark:text-zinc-900'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500 py-8 text-center">
          No events match your filters.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map(([key, groupEvents]) => (
            <div key={key}>
              {/* group header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold tracking-widest uppercase text-gray-400 dark:text-zinc-500 shrink-0">
                  {groupLabel(key)}
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-zinc-800" />
                <span className="text-xs text-gray-300 dark:text-zinc-600 shrink-0">
                  {groupEvents.length}
                </span>
              </div>

              {/* vertical line + events */}
              <div className="relative border-l border-gray-200 dark:border-zinc-800 ml-1">
                {groupEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    expanded={expandedId === event.id}
                    onToggle={() => toggle(event.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
