'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Users } from 'lucide-react'

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
}: {
  entities: EntityItem[]
  crossLinks: CrossDocLink[]
}) {
  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('all')

  const filtered = filter === 'all' ? entities : entities.filter(e => e.type === filter)
  const crossLinkMap = new Map(crossLinks.map(c => [c.name, c]))

  const counts = FILTER_OPTIONS.reduce<Record<string, number>>((acc, t) => {
    acc[t] = t === 'all' ? entities.length : entities.filter(e => e.type === t).length
    return acc
  }, {})

  if (entities.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
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
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === opt
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {opt === 'all' ? 'All' : ENTITY_LABELS[opt]}
              <span className={`ml-1.5 ${filter === opt ? 'text-gray-300' : 'text-gray-400'}`}>
                {counts[opt]}
              </span>
            </button>
          )
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {filtered.map((entity) => {
          const cross = crossLinkMap.get(entity.name)
          return (
            <div key={entity.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border mt-0.5 ${ENTITY_COLORS[entity.type] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {ENTITY_LABELS[entity.type] ?? entity.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{entity.name}</p>
                {entity.context && (
                  <p className="text-xs text-gray-400 mt-0.5">{entity.context}</p>
                )}
                {cross && cross.reportIds.length > 0 && (
                  <div className="mt-1.5">
                    <p className="text-xs text-gray-500">
                      Also appears in{' '}
                      {cross.reportIds.slice(0, 3).map((rid, i) => (
                        <span key={rid}>
                          {i > 0 && ', '}
                          <Link href={`/reports/${rid}`} className="text-blue-600 hover:underline">
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
    </section>
  )
}
