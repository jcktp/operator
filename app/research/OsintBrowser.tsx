'use client'

import { useState, useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import SearchInput from '@/components/ui/SearchInput'
import { OSINT_RESOURCES, OSINT_CATEGORIES } from '@/lib/osint-resources'

export default function OsintBrowser() {
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
 'People & Organisations': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
 'Sanctions & Watchlists': 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
 'Leaked & Public Archives': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
 'Geospatial & Satellite': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
 'Image & Video Verification': 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
 'Social Media & Web': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
 'Social Media & Web Archiving': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
 'Flight & Vessel Tracking': 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
 'Financial & Ownership': 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
 'Court & Legal Records': 'bg-zinc-100 text-zinc-700 /50 ',
 'Bellingcat Toolkit': 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
 }

 return (
 <div className="space-y-4">
 {/* Search + filter controls — sticky so they stay visible while scrolling */}
 <div className="sticky top-0 z-10 bg-[var(--surface)] pb-2 space-y-3">
 <SearchInput
 size="lg"
 value={query}
 onChange={e => setQuery(e.target.value)}
 placeholder="Search tools…"
 clearable
 onClear={() => setQuery('')}
 />

 {/* Category filter chips */}
 <div className="flex flex-wrap gap-1.5">
 <button
 onClick={() => setActiveCategory(null)}
 className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors ${
 activeCategory === null
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)]'
 : 'bg-[var(--surface-2)] text-[var(--text-body)] hover:bg-[var(--surface-3)]'
 }`}
 >
 All
 </button>
 {OSINT_CATEGORIES.map(cat => (
 <button
 key={cat}
 onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
 className={`px-2.5 py-1 rounded-[4px] text-xs font-medium transition-colors ${
 activeCategory === cat
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)]'
 : 'bg-[var(--surface-2)] text-[var(--text-subtle)] hover:bg-[var(--surface-3)] '
 }`}
 >
 {cat}
 </button>
 ))}
 </div>
 </div>

 {/* Results count */}
 <p className="text-xs text-[var(--text-muted)]">
 {filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}
 {activeCategory ? ` in ${activeCategory}` : ''}
 {query ? ` matching"${query}"` : ''}
 </p>

 {/* Resource cards */}
 {filtered.length === 0 ? (
 <div className="text-sm text-[var(--text-muted)] py-10 text-center">
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
 className="group flex flex-col gap-2 p-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-mid)] hover:shadow-sm transition-all"
 >
 {/* Name + external link icon */}
 <div className="flex items-start justify-between gap-2">
 <span className="text-sm font-medium text-[var(--text-bright)] group-hover:underline leading-snug">
 {resource.name}
 </span>
 <ExternalLink
 size={12}
 className="shrink-0 mt-0.5 text-[var(--text-muted)] group-hover:text-[var(--text-subtle)] transition-colors"
 />
 </div>

 {/* Description */}
 <p className="text-xs text-[var(--text-subtle)] leading-relaxed flex-1">
 {resource.description}
 </p>

 {/* Footer: category badge + tags */}
 <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
 <span
 className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
 categoryColors[resource.category] ?? 'bg-[var(--surface-2)] text-[var(--text-body)]'
 }`}
 >
 {resource.category}
 </span>
 {resource.tags.slice(0, 3).map(tag => (
 <span
 key={tag}
 className="inline-block px-1.5 py-0.5 rounded text-[10px] text-[var(--text-muted)] bg-[var(--surface-2)]/50 border border-[var(--border)]"
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
