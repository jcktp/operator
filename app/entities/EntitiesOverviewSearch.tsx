'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, X, ChevronDown, ChevronRight, GitFork } from 'lucide-react'
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

  const q = query.trim().toLowerCase()
  const filtered = q
    ? entities.filter(e => e.name.toLowerCase().includes(q) || e.contexts.some(c => c.toLowerCase().includes(q)))
    : entities

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

      <div className="space-y-2">
        {filtered.map(entity => {
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
    </>
  )
}
