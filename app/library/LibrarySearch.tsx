'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, X, ArrowRight, GitCompare, Clock, EyeOff, CheckSquare, Square, Layers, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 25
import { cn, formatRelativeDate, formatDate, AREA_COLORS, parseJsonSafe } from '@/lib/utils'
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
}: {
  reports: Report[]
  showEntities?: boolean
  showRedactions?: boolean
}) {
  const modeConfig = useMode()
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [redactionFilter, setRedactionFilter] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [query, redactionFilter])

  const q = query.trim().toLowerCase()
  const textFiltered = q.length < 1 ? null : reports.filter(r => {
    return (
      r.title.toLowerCase().includes(q) ||
      (r.summary ?? '').toLowerCase().includes(q) ||
      (r.directReport?.name ?? '').toLowerCase().includes(q) ||
      (r.area ?? '').toLowerCase().includes(q) ||
      (showEntities && (r.entityNames ?? []).some(n => n.toLowerCase().includes(q)))
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

  const list = filtered ?? reports
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <>
      {/* Search input */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={showEntities ? 'Filter by title, summary, source, beat, or entity name…' : 'Filter by title, summary, person, or area…'}
            className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">
              <X size={13} />
            </button>
          )}
        </div>
        {showRedactions && (
          <button
            onClick={() => setRedactionFilter(v => !v)}
            title="Show only documents with detected redactions"
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors shrink-0',
              redactionFilter
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100'
                : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-gray-300 hover:text-gray-700 dark:hover:text-zinc-200'
            )}
          >
            <EyeOff size={12} />
            Redacted
          </button>
        )}
      </div>

      {(filtered !== null) && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-3">
          {filtered.length === 0
            ? `No ${modeConfig.documentLabelPlural.toLowerCase()} match`
            : `${filtered.length} ${filtered.length !== 1 ? modeConfig.documentLabelPlural.toLowerCase() : modeConfig.documentLabel.toLowerCase()} match`}
          {query ? <> &ldquo;{query}&rdquo;</> : null}
          {redactionFilter ? <> with redactions</> : null}
        </p>
      )}

      {showEntities && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm">
          <span className="flex-1 text-xs">{selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setTimelineOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 px-2.5 py-1 rounded-md font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Layers size={12} />
            Combined timeline
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 dark:text-zinc-600 hover:text-white dark:hover:text-zinc-900">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        {pageItems.map((report) => {
          const metrics    = parseJsonSafe<Metric[]>(report.metrics, [])
          const comparison = parseJsonSafe<Comparison | null>(report.comparison, null)
          const questions  = parseJsonSafe<{ text: string; priority: string }[]>(report.questions, [])
          const highQs     = questions.filter(q => q.priority === 'high')
          const isSelected = selectedIds.has(report.id)

          return (
            <div
              key={report.id}
              className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl transition-all hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm"
            >
              <div className="px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {showEntities && (
                        <button
                          onClick={() => toggleSelect(report.id)}
                          className="shrink-0 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
                          title="Select for combined timeline"
                        >
                          {isSelected
                            ? <CheckSquare size={14} className="text-gray-900 dark:text-zinc-50" />
                            : <Square size={14} />
                          }
                        </button>
                      )}
                      <AreaBadge area={report.area} />
                      <Link
                        href={`/reports/${report.id}`}
                        className="text-sm font-semibold text-gray-900 dark:text-zinc-50 hover:underline"
                      >
                        {report.title}
                      </Link>
                      {showRedactions && report.hasRedactions && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 font-medium">
                          <EyeOff size={10} />
                          Redacted
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-zinc-500 flex-wrap">
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
                      className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-zinc-700"
                    />
                  )}
                  <Link href={`/reports/${report.id}`} className="shrink-0 mt-1 group">
                    <ArrowRight size={14} className="text-gray-300 dark:text-zinc-600 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition-colors" />
                  </Link>
                </div>

                {report.summary && (
                  <p className="text-sm text-gray-600 dark:text-zinc-300 mt-2 line-clamp-2 leading-relaxed">{report.summary}</p>
                )}

                {metrics.length > 0 && (
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    {metrics.slice(0, 4).map((m, mi) => (
                      <div key={mi} className="text-xs">
                        <span className="text-gray-400 dark:text-zinc-500">{m.label}: </span>
                        <span className={cn(
                          'font-medium',
                          m.status === 'positive' ? 'text-green-700' :
                          m.status === 'negative' ? 'text-red-700' :
                          m.status === 'warning'  ? 'text-amber-700' :
                          'text-gray-700 dark:text-zinc-200'
                        )}>{m.value}</span>
                      </div>
                    ))}
                    {metrics.length > 4 && <span className="text-xs text-gray-400 dark:text-zinc-500">+{metrics.length - 4} more</span>}
                  </div>
                )}

                {(comparison || highQs.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800 space-y-1.5">
                    {comparison?.headline && (
                      <p className="text-xs text-gray-500 dark:text-zinc-400 flex items-start gap-1.5">
                        <GitCompare size={11} className="shrink-0 mt-0.5 text-gray-400 dark:text-zinc-500" />
                        {comparison.headline}
                      </p>
                    )}
                    {highQs.slice(0, 2).map((q, qi) => (
                      <p key={qi} className="text-xs text-gray-500 dark:text-zinc-400 flex items-start gap-1.5">
                        <span className="shrink-0 text-red-400 font-bold">?</span>
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
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-12">No {modeConfig.documentLabelPlural.toLowerCase()} match your search.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-gray-400 dark:text-zinc-500">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, list.length)} of {list.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs text-gray-600 dark:text-zinc-300 px-2">Page {safePage} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-default transition-colors"
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
