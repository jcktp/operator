'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import SearchInput from '@/components/ui/SearchInput'
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
 <aside className="w-44 max-w-[40vw] shrink-0 space-y-1 sticky top-24">
 <button
 onClick={() => setSelectedArea(null)}
 className={cn(
 'w-full flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors text-left',
 !selectedArea ? 'bg-[var(--ink)] text-[var(--ink-contrast)] font-medium' : 'text-[var(--text-subtle)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span>All {modeConfig.collectionLabel.toLowerCase()}s</span>
 <span className={cn('text-xs', !selectedArea ? 'text-[var(--border)]' : 'text-[var(--text-muted)]')}>{events.length}</span>
 </button>
 {usedAreas.map(area => {
 const isActive = selectedArea === area
 return (
 <button
 key={area}
 onClick={() => setSelectedArea(isActive ? null : area)}
 className={cn(
 'w-full flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors text-left',
 isActive ? 'bg-[var(--ink)] text-[var(--ink-contrast)] font-medium' : 'text-[var(--text-subtle)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span className="truncate">{area}</span>
 <span className={cn('text-xs shrink-0', isActive ? 'text-[var(--border)]' : 'text-[var(--text-muted)]')}>{areaCount[area] ?? 0}</span>
 </button>
 )
 })}
 </aside>

 {/* Main */}
 <div className="flex-1 min-w-0 space-y-4">
 {/* Search */}
 <SearchInput
 size="lg"
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Search events, dates, or reports…"
 clearable
 onClear={() => setSearch('')}
 />

 {(search || selectedArea) && (
 <p className="text-xs text-[var(--text-muted)]">
 {filtered.length === 0 ? 'No events match' : `${filtered.length} event${filtered.length !== 1 ? 's' : ''}`}
 {search ? <> matching &ldquo;{search}&rdquo;</> : null}
 {selectedArea ? <> in {selectedArea}</> : null}
 </p>
 )}

 {filtered.length === 0 ? (
 <p className="text-sm text-[var(--text-muted)] text-center py-12">No events match your filters.</p>
 ) : (
 <div className="space-y-6">
 {grouped.map(group => (
 <div key={group.label}>
 {group.label && (
 <div className="flex items-center gap-3 mb-3">
 <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{group.label}</span>
 <div className="flex-1 h-px bg-[var(--surface-2)]" />
 </div>
 )}
 <div className="relative">
 {/* Vertical line */}
 <div className="absolute left-3.5 top-0 bottom-0 w-px bg-[var(--surface-3)]" />
 <div className="space-y-0">
 {group.items.map(e => (
 <div key={e.id} className="flex gap-4 relative pb-4 last:pb-0">
 {/* Dot */}
 <div className="shrink-0 w-7 flex items-start justify-center pt-1 z-10">
 <div className="w-2 h-2 rounded-full bg-[var(--surface-3)] border-2 border-white ring-1 ring-gray-200" />
 </div>
 {/* Content */}
 <div className="flex-1 min-w-0 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] px-4 py-3 hover:border-[var(--border)] hover:shadow-sm transition-all group">
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <span className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
 <Clock size={10} />
 {e.dateText}
 </span>
 <AreaBadge area={e.area} />
 </div>
 <p className="text-sm text-[var(--text-body)] leading-relaxed">{e.event}</p>
 </div>
 </div>
 <div className="mt-2 flex items-center gap-1.5">
 <Link
 href={`/reports/${e.reportId}`}
 className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:underline transition-colors truncate"
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
