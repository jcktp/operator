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
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-3">
          {filtered.length === 0 ? 'No entities match' : `${filtered.length} entit${filtered.length !== 1 ? 'ies' : 'y'} match`} &ldquo;{query}&rdquo;
        </p>
      )}

      {q && filtered.length > 0 && totalPages > 1 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-3">Showing page {safePage} of {totalPages}</p>
      )}

      {focus && <FocusEntity name={focus} />}

      <div className="space-y-2">
        {pageItems.map(entity => {
          const key = `${entity.type}::${entity.name}`
          const isExpanded = expanded.has(key)
          const rowId = `entity-${entity.name.replace(/\s+/g, '-').toLowerCase()}`
          return (
            <div key={key} id={rowId} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => { toggleExpand(key); setSelected({ type: 'entity', name: entity.name, entityType: entity.type }) }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${entityColors[entity.type] ?? 'bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-700'}`}>
                  {entityLabels[entity.type] ?? entity.type}
                </span>
                <span className="flex-1 font-medium text-sm text-gray-900 dark:text-zinc-50">{entity.name}</span>
                {entity.contexts[0] && (
                  <span className="text-xs text-gray-400 dark:text-zinc-500 hidden sm:block truncate max-w-[200px]">{entity.contexts[0]}</span>
                )}
                <span className="shrink-0 text-xs text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                  {entity.count} doc{entity.count !== 1 ? 's' : ''}
                </span>
                <Link
                  href={`/entities/graph?name=${encodeURIComponent(entity.name)}`}
                  onClick={e => e.stopPropagation()}
                  title="Entity relationship map"
                  className="shrink-0 p-1 text-gray-300 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors"
                >
                  <GitFork size={12} />
                </Link>
                {isExpanded ? (
                  <ChevronDown size={13} className="shrink-0 text-gray-400 dark:text-zinc-500" />
                ) : (
                  <ChevronRight size={13} className="shrink-0 text-gray-400 dark:text-zinc-500" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-zinc-800 divide-y divide-gray-100 dark:divide-zinc-800">
                  {entity.reports.map(report => (
                    <Link
                      key={report.id}
                      href={`/reports/${report.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <AreaBadge area={report.area} />
                      <span className="flex-1 text-sm text-gray-700 dark:text-zinc-200">{report.title}</span>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">{formatRelativeDate(new Date(report.createdAt))}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-12">No entities match your search.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-xs text-gray-400 dark:text-zinc-500">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
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
    </>
  )
}
