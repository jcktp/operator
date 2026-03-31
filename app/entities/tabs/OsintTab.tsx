'use client'

import { useState, useMemo } from 'react'
import { Search, ExternalLink, X } from 'lucide-react'
import { OSINT_RESOURCES, OSINT_CATEGORIES } from '@/lib/osint-resources'

export default function OsintTab() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return OSINT_RESOURCES.filter(r => {
      const matchesCategory = activeCategory === null || r.category === activeCategory
      if (!matchesCategory) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some(t => t.includes(q))
      )
    })
  }, [query, activeCategory])

  const categoryColors: Record<string, string> = {
    'People & Organisations':     'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'Sanctions & Watchlists':     'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    'Leaked & Public Archives':   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'Geospatial & Satellite':     'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    'Social Media & Web Archiving': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'Flight & Vessel Tracking':   'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    'Financial & Ownership':      'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    'Court & Legal Records':      'bg-zinc-100 text-zinc-700 dark:bg-zinc-700/50 dark:text-zinc-300',
  }

  return (
    <div className="space-y-4">
      {/* Search + filter controls */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 pointer-events-none"
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === null
                ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          {OSINT_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400 dark:text-zinc-500">
        {filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}
        {activeCategory ? ` in ${activeCategory}` : ''}
        {query ? ` matching "${query}"` : ''}
      </p>

      {/* Resource cards */}
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-400 dark:text-zinc-500 py-10 text-center">
          No resources match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(resource => (
            <a
              key={resource.url}
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-2 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all"
            >
              {/* Name + external link icon */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 group-hover:underline leading-snug">
                  {resource.name}
                </span>
                <ExternalLink
                  size={12}
                  className="shrink-0 mt-0.5 text-gray-300 dark:text-zinc-600 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition-colors"
                />
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed flex-1">
                {resource.description}
              </p>

              {/* Footer: category badge + tags */}
              <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    categoryColors[resource.category] ?? 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {resource.category}
                </span>
                {resource.tags.slice(0, 3).map(tag => (
                  <span
                    key={tag}
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
