'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, X, ChevronDown, ChevronRight, GitFork } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25
import { formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'

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
}: {
  entities: EntityEntry[]
  entityColors: Record<string, string>
  entityLabels: Record<string, string>
}) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  const q = query.trim().toLowerCase()
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
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search entities by name or context…"
          className="w-full border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>

      {q && (
        <p className="text-xs text-gray-400 mb-3">
          {filtered.length === 0 ? 'No entities match' : `${filtered.length} entit${filtered.length !== 1 ? 'ies' : 'y'} match`} &ldquo;{query}&rdquo;
        </p>
      )}

      {q && filtered.length > 0 && totalPages > 1 && (
        <p className="text-xs text-gray-400 mb-3">Showing page {safePage} of {totalPages}</p>
      )}

      <div className="space-y-2">
        {pageItems.map(entity => {
          const key = `${entity.type}::${entity.name}`
          const isExpanded = expanded.has(key)
          return (
            <div key={key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleExpand(key)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${entityColors[entity.type] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {entityLabels[entity.type] ?? entity.type}
                </span>
                <span className="flex-1 font-medium text-sm text-gray-900">{entity.name}</span>
                {entity.contexts[0] && (
                  <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[200px]">{entity.contexts[0]}</span>
                )}
                <span className="shrink-0 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {entity.count} doc{entity.count !== 1 ? 's' : ''}
                </span>
                <Link
                  href={`/entities/graph?name=${encodeURIComponent(entity.name)}`}
                  onClick={e => e.stopPropagation()}
                  title="Entity relationship map"
                  className="shrink-0 p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <GitFork size={12} />
                </Link>
                {isExpanded ? (
                  <ChevronDown size={13} className="shrink-0 text-gray-400" />
                ) : (
                  <ChevronRight size={13} className="shrink-0 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {entity.reports.map(report => (
                    <Link
                      key={report.id}
                      href={`/reports/${report.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <AreaBadge area={report.area} />
                      <span className="flex-1 text-sm text-gray-700">{report.title}</span>
                      <span className="text-xs text-gray-400 shrink-0">{formatRelativeDate(new Date(report.createdAt))}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-12">No entities match your search.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-gray-400">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ←
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
              .reduce<(number | '…')[]>((acc, n, i, arr) => {
                if (i > 0 && (n as number) - (arr[i - 1] as number) > 1) acc.push('…')
                acc.push(n)
                return acc
              }, [])
              .map((n, i) =>
                n === '…' ? (
                  <span key={`e-${i}`} className="px-1 text-xs text-gray-400">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n as number)}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                      safePage === n ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {n}
                  </button>
                )
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  )
}
