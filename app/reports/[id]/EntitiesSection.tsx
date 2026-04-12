'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'
import { useInspector } from '@/components/InspectorContext'

export interface EntityItem {
 id: string
 type: string
 name: string
 context: string | null
 appearsInCount?: number
 reportIds?: string[]
}

interface CrossDocLink {
 name: string
 type: string
 reportIds: string[]
 reportTitles: Record<string, string>
}

const ENTITY_COLORS: Record<string, string> = {
 person: 'bg-violet-50 text-violet-700 border-violet-200',
 organisation: 'bg-sky-50 text-sky-700 border-sky-200',
 location: 'bg-emerald-50 text-emerald-700 border-emerald-200',
 date: 'bg-amber-50 text-amber-700 border-amber-200',
 financial: 'bg-green-50 text-green-700 border-green-200',
}

const ENTITY_LABELS: Record<string, string> = {
 person: 'Person',
 organisation: 'Organisation',
 location: 'Location',
 date: 'Date',
 financial: 'Financial',
}

const FILTER_OPTIONS = ['all', 'person', 'organisation', 'location', 'date', 'financial'] as const

export default function EntitiesSection({
 entities,
 crossLinks,
 area,
 timelineHref,
}: {
 entities: EntityItem[]
 crossLinks: CrossDocLink[]
 area?: string
 timelineHref?: string | null
}) {
 const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('all')
 const { setSelected } = useInspector()

 const filtered = filter === 'all' ? entities : entities.filter(e => e.type === filter)
 const crossLinkMap = new Map(crossLinks.map(c => [c.name, c]))

 const counts = FILTER_OPTIONS.reduce<Record<string, number>>((acc, t) => {
 acc[t] = t === 'all' ? entities.length : entities.filter(e => e.type === t).length
 return acc
 }, {})

 if (entities.length === 0) return null

 return (
 <section>
 <h2 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
 <Users size={11} />
 Entities
 </h2>

 {/* Filter tabs */}
 <div className="flex items-center gap-1 mb-3 flex-wrap">
 {FILTER_OPTIONS.map(opt => (
 counts[opt] > 0 && (
 <button
 key={opt}
 onClick={() => setFilter(opt)}
 className={`px-2.5 py-1 rounded-[4px] text-xs font-medium border transition-colors ${
 filter === opt
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] border-[var(--ink)]'
 : 'bg-[var(--surface)] text-[var(--text-body)] border-[var(--border)] hover:border-[var(--border-mid)]'
 }`}
 >
 {opt === 'all' ? 'All' : ENTITY_LABELS[opt]}
 <span className={`ml-1.5 ${filter === opt ? 'opacity-50' : 'text-[var(--text-muted)]'}`}>
 {counts[opt]}
 </span>
 </button>
 )
 ))}
 </div>

 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {filtered.map((entity) => {
 const cross = crossLinkMap.get(entity.name)
 return (
 <div
 key={entity.id}
 className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
 onClick={() => setSelected({ type: 'entity', name: entity.name, entityType: entity.type })}
 >
 <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border mt-0.5 ${ENTITY_COLORS[entity.type] ?? 'bg-[var(--surface-2)] text-[var(--text-body)] border-[var(--border)]'}`}>
 {ENTITY_LABELS[entity.type] ?? entity.type}
 </span>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-[var(--text-bright)]">{entity.name}</p>
 {entity.context && (
 <p className="text-xs text-[var(--text-muted)] mt-0.5">{entity.context}</p>
 )}
 {cross && cross.reportIds.length > 0 && (
 <div className="mt-1.5">
 <p className="text-xs text-[var(--text-subtle)]">
 Also appears in{' '}
 {cross.reportIds.slice(0, 3).map((rid, i) => (
 <span key={rid}>
 {i > 0 && ', '}
 <Link href={`/reports/${rid}`} className="text-[var(--blue)] hover:underline">
 {cross.reportTitles[rid] ?? 'another document'}
 </Link>
 </span>
 ))}
 {cross.reportIds.length > 3 && ` and ${cross.reportIds.length - 3} more`}
 </p>
 </div>
 )}
 </div>
 </div>
 )
 })}
 </div>

 {/* Cross-module jump links */}
 <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[var(--border)]">
 <span className="text-[10px] text-[var(--text-muted)] font-medium">Jump to:</span>
 <Link
 href={`/entities?tab=entities${area ? `&area=${encodeURIComponent(area)}` : ''}`}
 className="text-[10px] text-[var(--blue)] hover:underline font-medium"
 >
 All Entities →
 </Link>
 {timelineHref && (
 <Link
 href={timelineHref}
 className="text-[10px] text-[var(--blue)] hover:underline font-medium"
 >
 Timeline →
 </Link>
 )}
 <Link
 href="/entities?tab=story-map"
 className="text-[10px] text-[var(--blue)] hover:underline font-medium"
 >
 Story Map →
 </Link>
 </div>
 </section>
 )
}
