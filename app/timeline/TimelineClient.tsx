'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, X, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'

interface TimelineRow {
  id: string
  dateText: string
  dateSortKey: string | null
  event: string
  reportId: string
  reportTitle: string
  area: string
  sourceName: string | null
}

export default function TimelineClient({
  events,
  usedAreas,
  modeConfig,
}: {
  events: TimelineRow[]
  usedAreas: string[]
  modeConfig: { documentLabel: string; documentLabelPlural: string; collectionLabel: string }
}) {
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = events
    if (selectedArea) list = list.filter(e => e.area === selectedArea)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(e =>
      e.event.toLowerCase().includes(q) ||
      e.dateText.toLowerCase().includes(q) ||
      e.reportTitle.toLowerCase().includes(q) ||
      (e.sourceName ?? '').toLowerCase().includes(q)
    )
    return list
  }, [events, selectedArea, search])

  const areaCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) counts[e.area] = (counts[e.area] ?? 0) + 1
    return counts
  }, [events])

  // Group by dateSortKey prefix (year) for visual separation
  const grouped = useMemo(() => {
    const groups: { label: string; items: TimelineRow[] }[] = []
    let current: TimelineRow[] = []
    let currentYear = ''
    for (const e of filtered) {
      const year = e.dateSortKey?.slice(0, 4) ?? ''
      if (year !== currentYear) {
        if (current.length) groups.push({ label: currentYear || 'Undated', items: current })
        current = [e]
        currentYear = year
      } else {
        current.push(e)
      }
    }
    if (current.length) groups.push({ label: currentYear || 'Undated', items: current })
    return groups
  }, [filtered])

  return (
    <div className="flex gap-6 items-start">
      {/* Sidebar */}
      <aside className="w-44 shrink-0 space-y-1 sticky top-24">
        <button
          onClick={() => setSelectedArea(null)}
          className={cn(
            'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left',
            !selectedArea ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <span>All {modeConfig.collectionLabel.toLowerCase()}s</span>
          <span className={cn('text-xs', !selectedArea ? 'text-gray-300' : 'text-gray-400')}>{events.length}</span>
        </button>
        {usedAreas.map(area => {
          const isActive = selectedArea === area
          return (
            <button
              key={area}
              onClick={() => setSelectedArea(isActive ? null : area)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors text-left',
                isActive ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <span className="truncate">{area}</span>
              <span className={cn('text-xs shrink-0', isActive ? 'text-gray-300' : 'text-gray-400')}>{areaCount[area] ?? 0}</span>
            </button>
          )
        })}
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events, dates, or reports…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {(search || selectedArea) && (
          <p className="text-xs text-gray-400">
            {filtered.length === 0 ? 'No events match' : `${filtered.length} event${filtered.length !== 1 ? 's' : ''}`}
            {search ? <> matching &ldquo;{search}&rdquo;</> : null}
            {selectedArea ? <> in {selectedArea}</> : null}
          </p>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No events match your filters.</p>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <div key={group.label}>
                {group.label && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{group.label}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                )}
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />
                  <div className="space-y-0">
                    {group.items.map(e => (
                      <div key={e.id} className="flex gap-4 relative pb-4 last:pb-0">
                        {/* Dot */}
                        <div className="shrink-0 w-7 flex items-start justify-center pt-1 z-10">
                          <div className="w-2 h-2 rounded-full bg-gray-300 border-2 border-white ring-1 ring-gray-200" />
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 hover:shadow-sm transition-all group">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
                                  <Clock size={10} />
                                  {e.dateText}
                                </span>
                                <AreaBadge area={e.area} />
                              </div>
                              <p className="text-sm text-gray-800 leading-relaxed">{e.event}</p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <Link
                              href={`/reports/${e.reportId}`}
                              className="text-[11px] text-gray-400 hover:text-gray-700 hover:underline transition-colors truncate"
                            >
                              {e.reportTitle}
                              {e.sourceName ? ` · ${e.sourceName}` : ''}
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
