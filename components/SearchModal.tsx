'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, BookOpen, Loader2 } from 'lucide-react'
import { AREA_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ReportHit {
  id: string
  title: string
  area: string
  directReport: { name: string } | null
  snippet: string
}

interface JournalHit {
  id: string
  title: string
  folder: string
  snippet: string
}

interface SearchResults {
  reports: ReportHit[]
  journal: JournalHit[]
}

type ResultItem =
  | { kind: 'report'; data: ReportHit }
  | { kind: 'journal'; data: JournalHit }

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // Close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const flatItems = useCallback((): ResultItem[] => {
    if (!results) return []
    return [
      ...results.reports.map(r => ({ kind: 'report' as const, data: r })),
      ...results.journal.map(j => ({ kind: 'journal' as const, data: j })),
    ]
  }, [results])

  const navigate = useCallback((item: ResultItem) => {
    if (item.kind === 'report') router.push(`/reports/${item.data.id}`)
    else router.push(`/journal`)
    onClose()
  }, [router, onClose])

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const items = flatItems()
      if (!items.length) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter')     { e.preventDefault(); navigate(items[activeIdx]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flatItems, navigate, activeIdx])

  // Debounced search
  useEffect(() => {
    setActiveIdx(0)
    if (query.length < 2) { setResults(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json() as SearchResults
        setResults(data)
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const items = flatItems()
  const hasResults = items.length > 0
  const showEmpty = !loading && query.length >= 2 && !hasResults

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/40 flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          {loading
            ? <Loader2 size={16} className="text-gray-400 shrink-0 animate-spin" />
            : <Search size={16} className="text-gray-400 shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search reports, insights, journal…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        {(hasResults || showEmpty) && (
          <div className="max-h-[400px] overflow-y-auto py-2">
            {showEmpty && (
              <p className="text-sm text-gray-400 text-center py-8">No results for &ldquo;{query}&rdquo;</p>
            )}

            {hasResults && (
              <>
                {results!.reports.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-1.5">Reports</p>
                    {results!.reports.map((r, i) => {
                      const idx = i
                      const color = AREA_COLORS[r.area]
                      const isActive = activeIdx === idx
                      return (
                        <button
                          key={r.id}
                          onClick={() => navigate({ kind: 'report', data: r })}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={cn(
                            'w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors',
                            isActive ? 'bg-gray-50' : 'hover:bg-gray-50'
                          )}
                        >
                          <FileText size={14} className="text-gray-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium border', color)}>
                                {r.area}
                              </span>
                              <span className="text-sm font-medium text-gray-900 truncate">{r.title}</span>
                              {r.directReport && (
                                <span className="text-xs text-gray-400">{r.directReport.name}</span>
                              )}
                            </div>
                            {r.snippet && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.snippet}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {results!.journal.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-1.5 mt-1">Journal</p>
                    {results!.journal.map((j, i) => {
                      const idx = (results?.reports.length ?? 0) + i
                      const isActive = activeIdx === idx
                      return (
                        <button
                          key={j.id}
                          onClick={() => navigate({ kind: 'journal', data: j })}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={cn(
                            'w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors',
                            isActive ? 'bg-gray-50' : 'hover:bg-gray-50'
                          )}
                        >
                          <BookOpen size={14} className="text-gray-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {j.folder && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium border bg-gray-50 text-gray-600 border-gray-200">
                                  {j.folder}
                                </span>
                              )}
                              <span className="text-sm font-medium text-gray-900 truncate">{j.title}</span>
                            </div>
                            {j.snippet && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{j.snippet}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Hint when empty */}
        {!hasResults && !showEmpty && query.length < 2 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-400">Search across reports, insights, metrics, and journal entries</p>
          </div>
        )}

        {/* Footer */}
        {hasResults && (
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4">
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <kbd className="border border-gray-200 rounded px-1 py-0.5">↑↓</kbd> navigate
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <kbd className="border border-gray-200 rounded px-1 py-0.5">↵</kbd> open
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <kbd className="border border-gray-200 rounded px-1 py-0.5">Esc</kbd> close
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
