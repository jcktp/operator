'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, X, ArrowRight, GitCompare, Clock, EyeOff, CheckSquare, Square, Layers, Filter } from 'lucide-react'
import { cn, formatRelativeDate, formatDate, AREA_COLORS, parseJsonSafe } from '@/lib/utils'
import type { Metric } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import CombinedTimelineModal from './CombinedTimelineModal'

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
  isJournalism = false,
}: {
  reports: Report[]
  isJournalism?: boolean
}) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [redactionFilter, setRedactionFilter] = useState(false)

  const q = query.trim().toLowerCase()
  const textFiltered = q.length < 1 ? null : reports.filter(r => {
    return (
      r.title.toLowerCase().includes(q) ||
      (r.summary ?? '').toLowerCase().includes(q) ||
      (r.directReport?.name ?? '').toLowerCase().includes(q) ||
      (r.area ?? '').toLowerCase().includes(q) ||
      (isJournalism && (r.entityNames ?? []).some(n => n.toLowerCase().includes(q)))
    )
  })
  const filtered = isJournalism && redactionFilter
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

  return (
    <>
      {/* Search input */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isJournalism ? 'Filter by title, summary, source, beat, or entity name…' : 'Filter by title, summary, person, or area…'}
            className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        {/* Journalism: redaction filter toggle */}
        {isJournalism && (
          <button
            onClick={() => setRedactionFilter(v => !v)}
            title="Show only documents with detected redactions"
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors shrink-0',
              redactionFilter
                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            <EyeOff size={12} />
            Redacted
          </button>
        )}
      </div>

      {(filtered !== null) && (
        <p className="text-xs text-gray-400 mb-3">
          {filtered.length === 0
            ? 'No reports match'
            : `${filtered.length} report${filtered.length !== 1 ? 's' : ''} match`}
          {query ? <> &ldquo;{query}&rdquo;</> : null}
          {redactionFilter ? <> with redactions</> : null}
        </p>
      )}

      {/* Journalism: multi-select timeline toolbar */}
      {isJournalism && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm">
          <span className="flex-1 text-xs">{selectedIds.size} document{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setTimelineOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-white text-gray-900 px-2.5 py-1 rounded-md font-medium hover:bg-gray-100 transition-colors"
          >
            <Layers size={12} />
            Combined timeline
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="space-y-3">
        {list.map((report) => {
          const metrics    = parseJsonSafe<Metric[]>(report.metrics, [])
          const comparison = parseJsonSafe<Comparison | null>(report.comparison, null)
          const questions  = parseJsonSafe<{ text: string; priority: string }[]>(report.questions, [])
          const highQs     = questions.filter(q => q.priority === 'high')
          const isSelected = selectedIds.has(report.id)

          return (
            <div
              key={report.id}
              className={cn(
                'bg-white border rounded-xl transition-all',
                isJournalism ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              )}
            >
              <div className="px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {/* Journalism: checkbox for multi-select */}
                      {isJournalism && (
                        <button
                          onClick={() => toggleSelect(report.id)}
                          className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors"
                          title="Select for combined timeline"
                        >
                          {isSelected
                            ? <CheckSquare size={14} className="text-gray-900" />
                            : <Square size={14} />
                          }
                        </button>
                      )}
                      <AreaBadge area={report.area} />
                      <Link
                        href={`/reports/${report.id}`}
                        className="text-sm font-semibold text-gray-900 hover:underline"
                      >
                        {report.title}
                      </Link>
                      {/* Journalism: redaction indicator */}
                      {isJournalism && report.hasRedactions && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-medium">
                          <EyeOff size={10} />
                          Redacted
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
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
                      className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-200"
                    />
                  )}
                  <Link href={`/reports/${report.id}`} className="shrink-0 mt-1 group">
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </Link>
                </div>

                {report.summary && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2 leading-relaxed">{report.summary}</p>
                )}

                {metrics.length > 0 && (
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    {metrics.slice(0, 4).map((m, mi) => (
                      <div key={mi} className="text-xs">
                        <span className="text-gray-400">{m.label}: </span>
                        <span className={cn(
                          'font-medium',
                          m.status === 'positive' ? 'text-green-700' :
                          m.status === 'negative' ? 'text-red-700' :
                          m.status === 'warning'  ? 'text-amber-700' :
                          'text-gray-700'
                        )}>{m.value}</span>
                      </div>
                    ))}
                    {metrics.length > 4 && <span className="text-xs text-gray-400">+{metrics.length - 4} more</span>}
                  </div>
                )}

                {(comparison || highQs.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    {comparison?.headline && (
                      <p className="text-xs text-gray-500 flex items-start gap-1.5">
                        <GitCompare size={11} className="shrink-0 mt-0.5 text-gray-400" />
                        {comparison.headline}
                      </p>
                    )}
                    {highQs.slice(0, 2).map((q, qi) => (
                      <p key={qi} className="text-xs text-gray-500 flex items-start gap-1.5">
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
          <p className="text-sm text-gray-400 text-center py-12">No reports match your search.</p>
        )}
      </div>

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
