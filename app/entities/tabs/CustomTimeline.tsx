'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useEntitiesSearch } from '../EntitiesSearchContext'

const QUESTION_PATTERNS = /^(what|when|who|where|how|which|why|tell me|show me|list|summarize|how many|find)/i
function isQuestion(text: string): boolean {
 return QUESTION_PATTERNS.test(text.trim()) || text.trim().endsWith('?')
}

export interface TimelineEvent {
 id: string
 dateText: string
 dateSortKey: string | null
 event: string
 reportId: string
 reportTitle: string
 area: string
 storyName?: string | null
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

// Scale curve for dock-like magnification based on distance from hovered item
function dockScale(distance: number | null): number {
 if (distance === null) return 1
 if (distance === 0) return 1.04
 if (distance === 1) return 1.02
 if (distance === 2) return 1.01
 return 1
}

interface EventCardProps {
 event: TimelineEvent
 expanded: boolean
 onToggle: () => void
 hovered: boolean
 scale: number
 onMouseEnter: () => void
 onMouseLeave: () => void
}

function EventCard({ event, expanded, onToggle, hovered, scale, onMouseEnter, onMouseLeave }: EventCardProps) {
 return (
 <div
 className="relative pl-7 cursor-pointer group"
 style={{
 transform: `scale(${scale})`,
 transformOrigin: 'left center',
 transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
 zIndex: hovered ? 10 : 1,
 }}
 onClick={onToggle}
 onMouseEnter={onMouseEnter}
 onMouseLeave={onMouseLeave}
 role="button"
 tabIndex={0}
 onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}
 >
 {/* dot centered on the timeline line */}
 <span
 className={`absolute left-0 top-[10px] -translate-x-1/2 rounded-full border-2 transition-all duration-300 ${
 expanded
 ? 'w-3 h-3 bg-red-500 border-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'
 : hovered
 ? 'w-3 h-3 bg-red-500 border-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.15)]'
 : 'w-2.5 h-2.5 bg-[var(--surface)] border-[var(--border)]'
 }`}
 style={hovered && !expanded ? { animation: 'timelinePulse 1.4s ease-in-out infinite' } : undefined}
 />

 <div className={`pb-5 pr-2 rounded-[4px] transition-colors ${expanded ? '' : hovered ? 'bg-[var(--surface-2)]' : ''}`}>
 {/* date + tags row */}
 <div className="flex flex-wrap items-center gap-1.5 mb-1">
 <span className="text-[11px] font-mono text-[var(--text-muted)] select-none">
 {event.dateText}
 </span>
 {event.area && (
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-subtle)] font-medium">
 {event.area}
 </span>
 )}
 {event.storyName && (
 <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[var(--blue-dim)] text-[var(--blue)] font-medium">
 {event.storyName}
 </span>
 )}
 {event.sourceName && (
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-subtle)]">
 {event.sourceName}
 </span>
 )}
 <span className={`ml-auto text-[10px] transition-colors ${expanded ? 'text-[var(--text-subtle)]' : 'text-[var(--border-mid)] group-hover:text-[var(--text-muted)]'}`}>
 {expanded ? '▲' : '▼'}
 </span>
 </div>

 {/* event text */}
 <p className="text-sm text-[var(--text-body)] leading-snug pr-4">
 {event.event}
 </p>

 {/* expanded: source link */}
 {expanded && (
 <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center gap-1.5">
 <span className="text-xs text-[var(--text-muted)]">Source:</span>
 <Link
 href={`/reports/${event.reportId}`}
 className="text-xs text-[var(--blue)] hover:underline font-medium"
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

interface GroupProps {
 groupEvents: TimelineEvent[]
 expandedId: string | null
 onToggle: (id: string) => void
}

function TimelineGroup({ groupEvents, expandedId, onToggle }: GroupProps) {
 const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

 return (
 <div className="relative border-l-2 border-[var(--border)] ml-1">
 {groupEvents.map((event, idx) => {
 const distance = hoveredIndex === null ? null : Math.abs(idx - hoveredIndex)
 return (
 <EventCard
 key={event.id}
 event={event}
 expanded={expandedId === event.id}
 onToggle={() => onToggle(event.id)}
 hovered={hoveredIndex === idx}
 scale={dockScale(distance)}
 onMouseEnter={() => setHoveredIndex(idx)}
 onMouseLeave={() => setHoveredIndex(null)}
 />
 )
 })}
 </div>
 )
}

export default function CustomTimeline({ events }: Props) {
 const [expandedId, setExpandedId] = useState<string | null>(null)
 const [activeArea, setActiveArea] = useState<string | null>(null)
 const [activeStory, setActiveStory] = useState<string | null>(null)
 const { query: contextQuery } = useEntitiesSearch()
 // Don't filter by question text — AI handles that via the top search bar
 const search = isQuestion(contextQuery.trim()) ? '' : contextQuery.trim()

 const areas = useMemo(
 () => [...new Set(events.map(e => e.area).filter(Boolean))].sort(),
 [events]
 )

 const stories = useMemo(
 () => [...new Set(events.map(e => e.storyName).filter(Boolean) as string[])].sort(),
 [events]
 )

 const filtered = useMemo(() => {
 let result = events
 if (activeArea) result = result.filter(e => e.area === activeArea)
 if (activeStory) result = result.filter(e => e.storyName === activeStory)
 if (search) {
 const q = search.toLowerCase()
 result = result.filter(
 e =>
 e.event.toLowerCase().includes(q) ||
 e.reportTitle.toLowerCase().includes(q) ||
 e.dateText.toLowerCase().includes(q)
 )
 }
 return result
 }, [events, activeArea, activeStory, search])

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
 <div className="flex flex-col gap-2">
 <div className="flex items-center gap-2">
 <span className="text-xs text-[var(--text-muted)]">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
 </div>
 {stories.length > 0 && (
 <div className="flex flex-wrap gap-1 items-center">
 <span className="text-[10px] text-[var(--text-muted)] mr-1">Story:</span>
 <button
 onClick={() => setActiveStory(null)}
 className={`text-xs px-2 py-0.5 rounded-[4px] transition-colors ${activeStory === null ? 'bg-[var(--ink)] text-[var(--ink-contrast)]' : 'bg-[var(--surface-2)] text-[var(--text-body)] hover:bg-[var(--surface-3)]'}`}
 >All</button>
 {stories.map(story => (
 <button
 key={story}
 onClick={() => setActiveStory(activeStory === story ? null : story)}
 className={`text-xs px-2 py-0.5 rounded-[4px] transition-colors ${activeStory === story ? 'bg-[var(--ink)] text-[var(--ink-contrast)]' : 'bg-[var(--surface-2)] text-[var(--text-body)] hover:bg-[var(--surface-3)]'}`}
 >{story}</button>
 ))}
 </div>
 )}
 {areas.length > 1 && (
 <div className="flex flex-wrap gap-1 items-center">
 <span className="text-[10px] text-[var(--text-muted)] mr-1">Area:</span>
 <button
 onClick={() => setActiveArea(null)}
 className={`text-xs px-2 py-0.5 rounded-[4px] transition-colors ${activeArea === null ? 'bg-[var(--ink)] text-[var(--ink-contrast)]' : 'bg-[var(--surface-2)] text-[var(--text-body)] hover:bg-[var(--surface-3)]'}`}
 >All</button>
 {areas.map(area => (
 <button
 key={area}
 onClick={() => setActiveArea(activeArea === area ? null : area)}
 className={`text-xs px-2 py-0.5 rounded-[4px] transition-colors ${activeArea === area ? 'bg-[var(--ink)] text-[var(--ink-contrast)]' : 'bg-[var(--surface-2)] text-[var(--text-body)] hover:bg-[var(--surface-3)]'}`}
 >{area}</button>
 ))}
 </div>
 )}
 </div>

 {filtered.length === 0 ? (
 <p className="text-sm text-[var(--text-muted)] py-8 text-center">
 No events match your filters.
 </p>
 ) : (
 <div className="space-y-8">
 {groups.map(([key, groupEvents]) => (
 <div key={key}>
 <div className="flex items-center gap-3 mb-4">
 <span className="text-xs font-semibold tracking-widest uppercase text-[var(--text-muted)] shrink-0">
 {groupLabel(key)}
 </span>
 <div className="flex-1 h-px bg-[var(--surface-2)]" />
 <span className="text-xs text-[var(--text-muted)] shrink-0">{groupEvents.length}</span>
 </div>
 <TimelineGroup
 groupEvents={groupEvents}
 expandedId={expandedId}
 onToggle={toggle}
 />
 </div>
 ))}
 </div>
 )}
 </div>
 )
}
