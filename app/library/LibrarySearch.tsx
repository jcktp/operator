'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X, ArrowRight, GitCompare, Clock, EyeOff, CheckSquare, Square, Layers, ChevronLeft, ChevronRight, Trash2, Loader2, Sparkles } from 'lucide-react'

const PAGE_SIZE = 25
import { cn, formatRelativeDate, formatDate, AREA_COLORS, parseJsonSafe, parseMetrics } from '@/lib/utils'
import type { Metric } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import CombinedTimelineModal from './CombinedTimelineModal'
import { useMode } from '@/components/ModeContext'

interface Comparison { headline: string }

interface Report {
 id: string
 title: string
 area: string
 summary: string | null
 metrics: string | null
 comparison: string | null
 questions: string | null
 fileType: string | null
 displayContent: string | null
 tags: string | null
 createdAt: Date
 reportDate: Date | null
 directReport: { name: string; title: string } | null
 // Journalism additions (optional — only present in journalism mode)
 entityNames?: string[]
 hasRedactions?: boolean
}

export default function LibrarySearch({
 reports,
 showEntities = false,
 showRedactions = false,
 entitiesHref = null,
 timelineHref = null,
}: {
 reports: Report[]
 showEntities?: boolean
 showRedactions?: boolean
 entitiesHref?: string | null
 timelineHref?: string | null
}) {
 const modeConfig = useMode()
 const router = useRouter()
 const [query, setQuery] = useState('')
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
 const [timelineOpen, setTimelineOpen] = useState(false)
 const [redactionFilter, setRedactionFilter] = useState(false)
 const [page, setPage] = useState(1)
 const [deleting, setDeleting] = useState(false)
 const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword')
 const [semanticResults, setSemanticResults] = useState<Report[] | null>(null)
 const [semanticLoading, setSemanticLoading] = useState(false)

 useEffect(() => { setPage(1) }, [query, redactionFilter])

 // Semantic search effect
 useEffect(() => {
  if (searchMode !== 'semantic' || query.trim().length < 2) {
    setSemanticResults(null)
    return
  }
  const controller = new AbortController()
  const timeout = setTimeout(async () => {
    setSemanticLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&mode=semantic`, { signal: controller.signal })
      const data = await res.json() as { reports: Array<{ id: string; title: string; area: string; snippet: string; score?: number }> }
      // Map to Report shape with minimal fields for display
      setSemanticResults(data.reports.map(r => ({
        id: r.id, title: r.title, area: r.area,
        summary: r.snippet, metrics: null, comparison: null, questions: null,
        fileType: null, displayContent: null, tags: null,
        createdAt: new Date(), reportDate: null, directReport: null,
      })))
    } catch { /* aborted or error */ }
    setSemanticLoading(false)
  }, 300)
  return () => { clearTimeout(timeout); controller.abort() }
 }, [query, searchMode])

 const q = query.trim().toLowerCase()
 const textFiltered = q.length < 1 ? null : reports.filter(r => {
 const parsedTags: string[] = r.tags ? parseJsonSafe<string[]>(r.tags, []) : []
 return (
 r.title.toLowerCase().includes(q) ||
 (r.summary ?? '').toLowerCase().includes(q) ||
 (r.directReport?.name ?? '').toLowerCase().includes(q) ||
 (r.area ?? '').toLowerCase().includes(q) ||
 (showEntities && (r.entityNames ?? []).some(n => n.toLowerCase().includes(q))) ||
 parsedTags.some(t => t.includes(q))
 )
 })
 const filtered = showRedactions && redactionFilter
 ? (textFiltered ?? reports).filter(r => r.hasRedactions)
 : textFiltered

 const toggleSelect = (id: string) => {
 setSelectedIds(prev => {
 const next = new Set(prev)
 if (next.has(id)) next.delete(id)
 else next.add(id)
 return next
 })
 }

 const deleteSelected = async () => {
 if (!window.confirm(`Delete ${selectedIds.size} document${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
 setDeleting(true)
 await Promise.all([...selectedIds].map(id => fetch(`/api/reports/${id}`, { method: 'DELETE' })))
 setSelectedIds(new Set())
 setDeleting(false)
 router.refresh()
 }

 const list = searchMode === 'semantic' && semanticResults ? semanticResults : (filtered ?? reports)
 const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
 const safePage = Math.min(page, totalPages)
 const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

 return (
 <>
 {/* Search input */}
 <div className="sticky top-40 z-10 bg-[var(--background)] flex items-center gap-2 mb-4 pt-1 pb-2">
 <div className="relative flex-1">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
 <input
 type="text"
 value={query}
 onChange={e => setQuery(e.target.value)}
 placeholder={showEntities ? 'Filter by title, summary, source, beat, or entity name…' : 'Filter by title, summary, person, or area…'}
 className="w-full border border-[var(--border)] rounded-[4px] pl-9 pr-8 py-2 text-sm text-[var(--text-body)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] placeholder:text-[var(--text-muted)]"
 />
 {query && (
 <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-subtle)]">
 <X size={13} />
 </button>
 )}
 </div>
 <button
  onClick={() => setSearchMode(m => m === 'keyword' ? 'semantic' : 'keyword')}
  title={searchMode === 'keyword' ? 'Switch to semantic search (AI-powered)' : 'Switch to keyword search'}
  className={cn(
   'flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] border text-xs font-medium transition-colors shrink-0',
   searchMode === 'semantic'
    ? 'bg-[var(--blue-dim,rgba(59,130,246,0.1))] border-[var(--blue)] text-[var(--blue)] hover:bg-blue-100'
    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-subtle)] hover:border-[var(--border-mid)] hover:text-[var(--text-body)]'
  )}
 >
  <Sparkles size={12} />
  {searchMode === 'semantic' ? 'Semantic' : 'Keyword'}
 </button>
 {showRedactions && (
 <button
 onClick={() => setRedactionFilter(v => !v)}
 title="Show only documents with detected redactions"
 className={cn(
 'flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] border text-xs font-medium transition-colors shrink-0',
 redactionFilter
 ? 'bg-[var(--red-dim)] border-[var(--red)] text-[var(--red)] hover:bg-red-100'
 : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-subtle)] hover:border-[var(--border-mid)] hover:text-[var(--text-body)]'
 )}
 >
 <EyeOff size={12} />
 Redacted
 </button>
 )}
 </div>

 {semanticLoading && (
 <p className="text-xs text-[var(--text-muted)] mb-3 flex items-center gap-1.5">
 <Loader2 size={12} className="animate-spin" /> Searching semantically…
 </p>
 )}

 {(searchMode === 'semantic' && semanticResults !== null) && (
 <p className="text-xs text-[var(--text-muted)] mb-3">
 {semanticResults.length === 0
 ? `No ${modeConfig.documentLabelPlural.toLowerCase()} match semantically`
 : `${semanticResults.length} semantic ${semanticResults.length !== 1 ? 'matches' : 'match'}`}
 {query ? <> for &ldquo;{query}&rdquo;</> : null}
 </p>
 )}

 {(searchMode === 'keyword' && filtered !== null) && (
 <p className="text-xs text-[var(--text-muted)] mb-3">
 {filtered.length === 0
 ? `No ${modeConfig.documentLabelPlural.toLowerCase()} match`
 : `${filtered.length} ${filtered.length !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()} match`}
 {query ? <> &ldquo;{query}&rdquo;</> : null}
 {redactionFilter ? <> with redactions</> : null}
 </p>
 )}

 {selectedIds.size > 0 && (
 <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-[var(--ink)] text-[var(--ink-contrast)] rounded-[4px] text-sm">
 <span className="flex-1 text-xs">{selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} selected</span>
 {showEntities && (
 <button
 onClick={() => setTimelineOpen(true)}
 className="flex items-center gap-1.5 text-xs bg-[var(--surface)] text-[var(--text-bright)] px-2.5 py-1 rounded-md font-medium hover:bg-[var(--surface-2)] transition-colors"
 >
 <Layers size={12} />
 Combined timeline
 </button>
 )}
 <button
 onClick={deleteSelected}
 disabled={deleting}
 className="flex items-center gap-1.5 text-xs bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-md font-medium disabled:opacity-50 transition-colors"
 >
 {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
 Delete selected
 </button>
 <button onClick={() => setSelectedIds(new Set())} className="text-[var(--text-muted)] hover:text-white">
 <X size={14} />
 </button>
 </div>
 )}

 <div className="space-y-3">
 {pageItems.map((report) => {
 const metrics = parseMetrics(report.metrics)
 const comparison = parseJsonSafe<Comparison | null>(report.comparison, null)
 const questions = parseJsonSafe<{ text: string; priority: string }[]>(report.questions, [])
 const highQs = questions.filter(q => q.priority === 'high')
 const isSelected = selectedIds.has(report.id)

 return (
 <div
 key={report.id}
 className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] transition-all hover:border-[var(--border-mid)] hover:shadow-sm"
 >
 <div className="px-4 py-4">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 <button
 onClick={() => toggleSelect(report.id)}
 className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
 title="Select"
 >
 {isSelected
 ? <CheckSquare size={14} className="text-[var(--text-bright)]" />
 : <Square size={14} />
 }
 </button>
 <AreaBadge area={report.area} />
 <Link
 href={`/reports/${report.id}`}
 className="text-sm font-semibold text-[var(--text-bright)] hover:underline"
 >
 {report.title}
 </Link>
 {showRedactions && report.hasRedactions && (
 <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-[var(--red-dim)] text-[var(--red)] border border-[var(--red)] font-medium">
 <EyeOff size={10} />
 Redacted
 </span>
 )}
 {report.tags && (() => { try { const t = JSON.parse(report.tags) as string[]; return t.slice(0, 4).map(tag => <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)]">{tag}</span>) } catch { return null } })()}
 </div>
 <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] flex-wrap">
 <span className="flex items-center gap-1">
 <Clock size={10} />
 {formatRelativeDate(report.createdAt)}
 </span>
 {report.reportDate && <span>Report date: {formatDate(report.reportDate)}</span>}
 {report.directReport && <span>{report.directReport.name} · {report.directReport.title}</span>}
 <span className="uppercase tracking-wide">{report.fileType}</span>
 </div>
 </div>
 {report.displayContent?.startsWith('image:') && (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={`/api/reports/${report.id}/image`}
 alt=""
 className="w-12 h-12 rounded-[4px] object-cover shrink-0 border border-[var(--border)]"
 />
 )}
 <Link href={`/reports/${report.id}`} className="shrink-0 mt-1 group">
 <ArrowRight size={14} className="text-[var(--border)] group-hover:text-[var(--text-subtle)] transition-colors" />
 </Link>
 </div>

 {report.summary && (
 <p className="text-sm text-[var(--text-body)] mt-2 line-clamp-2 leading-relaxed">{report.summary}</p>
 )}

 {/* Cross-module jump links — only shown when analysis routes exist for this mode */}
 {(entitiesHref || timelineHref) && (
 <div className="flex items-center gap-3 mt-1.5">
 {entitiesHref && (
 <Link
 href={entitiesHref}
 className="text-[10px] text-[var(--text-muted)] hover:text-[var(--blue)] transition-colors font-medium"
 >
 Entities →
 </Link>
 )}
 {timelineHref && (
 <Link
 href={timelineHref}
 className="text-[10px] text-[var(--text-muted)] hover:text-[var(--blue)] transition-colors font-medium"
 >
 Timeline →
 </Link>
 )}
 </div>
 )}

 {metrics.length > 0 && (
 <div className="flex items-center gap-4 mt-3 flex-wrap">
 {metrics.slice(0, 4).map((m, mi) => (
 <div key={mi} className="text-xs">
 <span className="text-[var(--text-muted)]">{m.label}: </span>
 <span className={cn(
 'font-medium',
 m.status === 'positive' ? 'text-green-700' :
 m.status === 'negative' ? 'text-red-700' :
 m.status === 'warning' ? 'text-amber-700' :
 'text-[var(--text-body)]'
 )}>{m.value}</span>
 </div>
 ))}
 {metrics.length > 4 && <span className="text-xs text-[var(--text-muted)]">+{metrics.length - 4} more</span>}
 </div>
 )}

 {(comparison || highQs.length > 0) && (
 <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1.5">
 {comparison?.headline && (
 <p className="text-xs text-[var(--text-subtle)] flex items-start gap-1.5">
 <GitCompare size={11} className="shrink-0 mt-0.5 text-[var(--text-muted)]" />
 {comparison.headline}
 </p>
 )}
 {highQs.slice(0, 2).map((q, qi) => (
 <p key={qi} className="text-xs text-[var(--text-subtle)] flex items-start gap-1.5">
 <span className="shrink-0 text-[var(--red)] font-bold">?</span>
 {q.text}
 </p>
 ))}
 </div>
 )}
 </div>
 </div>
 )
 })}

 {list.length === 0 && (
 <p className="text-sm text-[var(--text-muted)] text-center py-12">No {modeConfig.documentLabelPlural.toLowerCase()} match your search.</p>
 )}
 </div>

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between pt-2">
 <span className="text-xs text-[var(--text-muted)]">
 {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, list.length)} of {list.length}
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

 {/* Combined timeline modal */}
 {timelineOpen && selectedIds.size > 0 && (
 <CombinedTimelineModal
 reportIds={[...selectedIds]}
 onClose={() => setTimelineOpen(false)}
 />
 )}
 </>
 )
}
