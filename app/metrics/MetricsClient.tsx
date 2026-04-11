'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, X, ArrowRight } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'

interface MetricRow {
 label: string
 value: string
 status?: string
 context?: string
 reportId: string
 reportTitle: string
 area: string
 reportDate: string
 sourceName: string | null
}

const STATUS_STYLE: Record<string, string> = {
 positive: 'text-green-700 bg-green-50 border-green-200',
 negative: 'text-red-700 bg-red-50 border-red-200',
 warning: 'text-amber-700 bg-amber-50 border-amber-200',
 neutral: 'text-[var(--text-body)] bg-[var(--surface-2)] border-[var(--border)]',
}

export default function MetricsClient({
 metrics,
 usedAreas,
 modeConfig,
}: {
 metrics: MetricRow[]
 usedAreas: string[]
 modeConfig: { documentLabel: string; documentLabelPlural: string; collectionLabel: string }
}) {
 const [selectedArea, setSelectedArea] = useState<string | null>(null)
 const [search, setSearch] = useState('')

 const filtered = useMemo(() => {
 let list = metrics
 if (selectedArea) list = list.filter(m => m.area === selectedArea)
 const q = search.trim().toLowerCase()
 if (q) list = list.filter(m =>
 (m.label ?? '').toLowerCase().includes(q) ||
 (m.value ?? '').toLowerCase().includes(q) ||
 m.reportTitle.toLowerCase().includes(q) ||
 (m.context ?? '').toLowerCase().includes(q)
 )
 return list
 }, [metrics, selectedArea, search])

 const areaCount = useMemo(() => {
 const counts: Record<string, number> = {}
 for (const m of metrics) counts[m.area] = (counts[m.area] ?? 0) + 1
 return counts
 }, [metrics])

 return (
 <div className="flex gap-6 items-start">
 {/* Sidebar */}
 <aside className="w-44 shrink-0 space-y-1 sticky top-24">
 <button
 onClick={() => setSelectedArea(null)}
 className={cn(
 'w-full flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors text-left',
 !selectedArea ? 'bg-[var(--ink)] text-white font-medium' : 'text-[var(--text-subtle)] hover:bg-[var(--surface-2)]'
 )}
 >
 <span>All {modeConfig.collectionLabel.toLowerCase()}s</span>
 <span className={cn('text-xs', !selectedArea ? 'text-[var(--border)]' : 'text-[var(--text-muted)]')}>{metrics.length}</span>
 </button>
 {usedAreas.map(area => {
 const isActive = selectedArea === area
 return (
 <button
 key={area}
 onClick={() => setSelectedArea(isActive ? null : area)}
 className={cn(
 'w-full flex items-center justify-between h-7 px-2.5 rounded-[4px] text-sm transition-colors text-left',
 isActive ? 'bg-[var(--ink)] text-white font-medium' : 'text-[var(--text-subtle)] hover:bg-[var(--surface-2)]'
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
 <div className="relative">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
 <input
 type="text"
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Search by metric name, value, or report…"
 className="w-full border border-[var(--border)] rounded-[4px] pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 bg-[var(--surface)]"
 />
 {search && (
 <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-subtle)]">
 <X size={13} />
 </button>
 )}
 </div>

 {(search || selectedArea) && (
 <p className="text-xs text-[var(--text-muted)]">
 {filtered.length === 0 ? 'No metrics match' : `${filtered.length} metric${filtered.length !== 1 ? 's' : ''}`}
 {search ? <> matching &ldquo;{search}&rdquo;</> : null}
 {selectedArea ? <> in {selectedArea}</> : null}
 </p>
 )}

 {filtered.length === 0 ? (
 <p className="text-sm text-[var(--text-muted)] text-center py-12">No metrics match your filters.</p>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
 {filtered.map((m, i) => (
 <Link
 key={`${m.reportId}-${i}`}
 href={`/reports/${m.reportId}`}
 className="group bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 hover:border-[var(--border)] hover:shadow-sm transition-all flex flex-col gap-2"
 >
 <div className="flex items-start justify-between gap-2">
 <span className="text-xs font-medium text-[var(--text-muted)] leading-snug">{m.label}</span>
 <ArrowRight size={12} className="text-[var(--border)] group-hover:text-[var(--text-muted)] transition-colors shrink-0 mt-0.5" />
 </div>
 <div className="flex items-baseline gap-2 flex-wrap">
 <span className={cn(
 'text-xl font-semibold leading-none',
 m.status === 'positive' ? 'text-[var(--green)]' :
 m.status === 'negative' ? 'text-[var(--red)]' :
 m.status === 'warning' ? 'text-[var(--amber)]' :
 'text-[var(--text-bright)]'
 )}>
 {m.value}
 </span>
 {m.status && m.status !== 'neutral' && (
 <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', STATUS_STYLE[m.status] ?? STATUS_STYLE.neutral)}>
 {m.status}
 </span>
 )}
 </div>
 {m.context && (
 <p className="text-xs text-[var(--text-muted)] leading-snug">{m.context}</p>
 )}
 <div className="flex items-center gap-1.5 mt-auto pt-1 flex-wrap">
 <AreaBadge area={m.area} />
 <span className="text-[11px] text-[var(--text-muted)] truncate">{m.reportTitle}</span>
 </div>
 {m.sourceName && (
 <p className="text-[11px] text-[var(--text-muted)]">{m.sourceName} · {formatRelativeDate(new Date(m.reportDate))}</p>
 )}
 </Link>
 ))}
 </div>
 )}
 </div>
 </div>
 )
}
