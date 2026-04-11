'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ChevronLeft, GitFork } from 'lucide-react'
import { useInspector } from '@/components/InspectorContext'
import { useEntitiesSearch } from './EntitiesSearchContext'
const PAGE_SIZE = 25
import { formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import FocusEntity from './tabs/FocusEntity'

const QUESTION_PATTERNS = /^(what|when|who|where|how|which|why|tell me|show me|list|summarize|how many|find)/i
function isQuestion(text: string): boolean {
 return QUESTION_PATTERNS.test(text.trim()) || text.trim().endsWith('?')
}

interface EntityEntry {
 name: string
 type: string
 count: number
 contexts: string[]
 reports: Array<{ id: string; title: string; area: string; createdAt: string }>
}

export default function EntitiesOverviewSearch({
 entities,
 entityColors,
 entityLabels,
 focus,
}: {
 entities: EntityEntry[]
 entityColors: Record<string, string>
 entityLabels: Record<string, string>
 focus?: string
}) {
 const { query } = useEntitiesSearch()
 const [expanded, setExpanded] = useState<Set<string>>(new Set())
 const [page, setPage] = useState(1)
 const { setSelected } = useInspector()

 // Don't filter by question text — let AI handle those
 const rawQ = query.trim().toLowerCase()
 const q = isQuestion(query.trim()) ? '' : rawQ
 const filtered = q
 ? entities.filter(e => e.name.toLowerCase().includes(q) || e.contexts.some(c => c.toLowerCase().includes(q)))
 : entities

 // Reset to page 1 when search changes
 useEffect(() => { setPage(1) }, [query])

 const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
 const safePage = Math.min(page, totalPages)
 const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

 const toggleExpand = (key: string) => {
 setExpanded(prev => {
 const next = new Set(prev)
 if (next.has(key)) next.delete(key)
 else next.add(key)
 return next
 })
 }

 return (
 <>
 {q && (
 <p className="text-xs text-[var(--text-muted)] mb-3">
 {filtered.length === 0 ? 'No entities match' : `${filtered.length} entit${filtered.length !== 1 ? 'ies' : 'y'} match`} &ldquo;{query}&rdquo;
 </p>
 )}

 {q && filtered.length > 0 && totalPages > 1 && (
 <p className="text-xs text-[var(--text-muted)] mb-3">Showing page {safePage} of {totalPages}</p>
 )}

 {focus && <FocusEntity name={focus} />}

 <div className="space-y-2">
 {pageItems.map(entity => {
 const key = `${entity.type}::${entity.name}`
 const isExpanded = expanded.has(key)
 const rowId = `entity-${entity.name.replace(/\s+/g, '-').toLowerCase()}`
 return (
 <div key={key} id={rowId} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden shadow-sm">
 <button
 onClick={() => { toggleExpand(key); setSelected({ type: 'entity', name: entity.name, entityType: entity.type }) }}
 className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
 >
 <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${entityColors[entity.type] ?? 'bg-[var(--surface-2)] text-[var(--text-body)] border-[var(--border)]'}`}>
 {entityLabels[entity.type] ?? entity.type}
 </span>
 <span className="flex-1 font-medium text-sm text-[var(--text-bright)]">{entity.name}</span>
 {entity.contexts[0] && (
 <span className="text-xs text-[var(--text-muted)] hidden sm:block truncate max-w-[200px]">{entity.contexts[0]}</span>
 )}
 <span className="shrink-0 text-xs text-[var(--text-muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-[4px]">
 {entity.count} doc{entity.count !== 1 ? 's' : ''}
 </span>
 <Link
 href={`/entities/graph?name=${encodeURIComponent(entity.name)}`}
 onClick={e => e.stopPropagation()}
 title="Entity relationship map"
 className="shrink-0 p-1 text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] rounded transition-colors"
 >
 <GitFork size={12} />
 </Link>
 {isExpanded ? (
 <ChevronDown size={13} className="shrink-0 text-[var(--text-muted)]" />
 ) : (
 <ChevronRight size={13} className="shrink-0 text-[var(--text-muted)]" />
 )}
 </button>

 {isExpanded && (
 <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
 {entity.reports.map(report => (
 <Link
 key={report.id}
 href={`/reports/${report.id}`}
 className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-2)] transition-colors"
 >
 <AreaBadge area={report.area} />
 <span className="flex-1 text-sm text-[var(--text-body)]">{report.title}</span>
 <span className="text-xs text-[var(--text-muted)] shrink-0">{formatRelativeDate(new Date(report.createdAt))}</span>
 </Link>
 ))}
 </div>
 )}
 </div>
 )
 })}

 {filtered.length === 0 && (
 <p className="text-sm text-[var(--text-muted)] text-center py-12">No entities match your search.</p>
 )}
 </div>

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between pt-4">
 <span className="text-xs text-[var(--text-muted)]">
 {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
 </span>
 <div className="flex items-center gap-1">
 <button
 onClick={() => setPage(p => Math.max(1, p - 1))}
 disabled={safePage === 1}
 className="p-1.5 rounded-[4px] border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-default transition-colors"
 >
 <ChevronLeft size={13} />
 </button>
 <span className="text-xs text-[var(--text-body)] px-2">Page {safePage} of {totalPages}</span>
 <button
 onClick={() => setPage(p => Math.min(totalPages, p + 1))}
 disabled={safePage === totalPages}
 className="p-1.5 rounded-[4px] border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-default transition-colors"
 >
 <ChevronRight size={13} />
 </button>
 </div>
 </div>
 )}
 </>
 )
}
