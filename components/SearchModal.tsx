'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, BookOpen, Loader2, Layers } from 'lucide-react'
import { AREA_COLORS } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useMode } from '@/components/ModeContext'

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

interface TopicMatch {
  field: 'summary' | 'metric' | 'insight' | 'question'
  text: string
}

interface TopicHit {
  reportId: string
  reportTitle: string
  area: string
  directName?: string
  date: string
  matches: TopicMatch[]
}

type ResultItem =
  | { kind: 'report'; data: ReportHit }
  | { kind: 'journal'; data: JournalHit }

const FIELD_LABEL: Record<TopicMatch['field'], string> = {
  summary: 'Summary',
  metric: 'Metric',
  insight: 'Flag',
  question: 'Question',
}

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const modeConfig = useMode()
  const docLabel = modeConfig.documentLabel        // e.g. "Report", "Notes", "Case File"
  const docLabelPlural = modeConfig.documentLabelPlural  // e.g. "Reports", "Notes", "Case Files"
  const journalLabel = modeConfig.navJournal       // e.g. "Journal", "Notebook", "Research Notes"
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'search' | 'topic'>('search')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [topicHits, setTopicHits] = useState<TopicHit[] | null>(null)
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

  // Keyboard nav (only for regular search mode)
  useEffect(() => {
    if (mode !== 'search') return
    const onKey = (e: KeyboardEvent) => {
      const items = flatItems()
      if (!items.length) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter')     { e.preventDefault(); navigate(items[activeIdx]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flatItems, navigate, activeIdx, mode])

  // Debounced search
  useEffect(() => {
    setActiveIdx(0)
    setResults(null)
    setTopicHits(null)
    if (query.length < 2) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        if (mode === 'search') {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
          const data = await res.json() as SearchResults
          setResults(data)
        } else {
          const res = await fetch(`/api/topic-search?q=${encodeURIComponent(query)}`)
          const data = await res.json() as { hits: TopicHit[] }
          setTopicHits(data.hits)
        }
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, mode])

  const items = flatItems()
  const hasResults = mode === 'search' ? items.length > 0 : (topicHits?.length ?? 0) > 0
  const showEmpty = !loading && query.length >= 2 && !hasResults

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/40 flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-[10px] shadow-2xl overflow-hidden dark:bg-zinc-900"
        onClick={e => e.stopPropagation()}
      >
        {/* Mode tabs + input */}
        <div className="border-b border-gray-100 dark:border-zinc-800">
          <div className="flex gap-0 border-b border-gray-100 dark:border-zinc-800">
            <button
              onClick={() => setMode('search')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                mode === 'search'
                  ? 'text-gray-900 border-gray-900 dark:text-zinc-50 dark:border-zinc-50'
                  : 'text-gray-400 border-transparent hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300'
              )}
            >
              <Search size={11} /> Search
            </button>
            <button
              onClick={() => setMode('topic')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                mode === 'topic'
                  ? 'text-gray-900 border-gray-900 dark:text-zinc-50 dark:border-zinc-50'
                  : 'text-gray-400 border-transparent hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300'
              )}
            >
              <Layers size={11} /> Research topic
            </button>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            {loading
              ? <Loader2 size={16} className="text-gray-400 shrink-0 animate-spin dark:text-zinc-500" />
              : <Search size={16} className="text-gray-400 shrink-0 dark:text-zinc-500" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={mode === 'search' ? `Search ${docLabelPlural.toLowerCase()}, insights, ${journalLabel.toLowerCase()}…` : `Research a topic across all ${docLabelPlural.toLowerCase()}…`}
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent dark:text-zinc-50 dark:placeholder-zinc-500"
            />
            <kbd className="hidden sm:inline text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 dark:text-zinc-500 dark:border-zinc-700">Esc</kbd>
          </div>
        </div>

        {/* Results */}
        {(hasResults || showEmpty) && (
          <div className="max-h-[420px] overflow-y-auto py-2">
            {showEmpty && (
              <p className="text-sm text-gray-400 text-center py-8">
                {mode === 'topic'
                  ? `No ${docLabelPlural.toLowerCase()} mention "${query}"`
                  : `No results for "${query}"`}
              </p>
            )}

            {/* Regular search results */}
            {mode === 'search' && hasResults && (
              <>
                {results!.reports.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-1.5">{docLabelPlural}</p>
                    {results!.reports.map((r, i) => {
                      const color = AREA_COLORS[r.area]
                      const isActive = activeIdx === i
                      return (
                        <button
                          key={r.id}
                          onClick={() => navigate({ kind: 'report', data: r })}
                          onMouseEnter={() => setActiveIdx(i)}
                          className={cn(
                            'w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors',
                            isActive ? 'bg-gray-50 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                          )}
                        >
                          <FileText size={14} className="text-gray-400 shrink-0 mt-0.5 dark:text-zinc-500" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium border', color)}>
                                {r.area}
                              </span>
                              <span className="text-sm font-medium text-gray-900 truncate dark:text-zinc-50">{r.title}</span>
                              {r.directReport && (
                                <span className="text-xs text-gray-400 dark:text-zinc-500">{r.directReport.name}</span>
                              )}
                            </div>
                            {r.snippet && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 dark:text-zinc-400">{r.snippet}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {results!.journal.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-1.5 mt-1">{journalLabel}</p>
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
                            isActive ? 'bg-gray-50 dark:bg-zinc-800' : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                          )}
                        >
                          <BookOpen size={14} className="text-gray-400 shrink-0 mt-0.5 dark:text-zinc-500" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {j.folder && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium border bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                  {j.folder}
                                </span>
                              )}
                              <span className="text-sm font-medium text-gray-900 truncate dark:text-zinc-50">{j.title}</span>
                            </div>
                            {j.snippet && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 dark:text-zinc-400">{j.snippet}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* Topic research results */}
            {mode === 'topic' && hasResults && topicHits && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-1.5">
                  {topicHits.length} {topicHits.length === 1 ? docLabel.toLowerCase() : docLabelPlural.toLowerCase()} mention &ldquo;{query}&rdquo;
                </p>
                {topicHits.map(hit => {
                  const color = AREA_COLORS[hit.area]
                  return (
                    <button
                      key={hit.reportId}
                      onClick={() => { router.push(`/reports/${hit.reportId}`); onClose() }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 dark:hover:bg-zinc-800 dark:border-zinc-800"
                    >
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium border', color)}>
                          {hit.area}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate dark:text-zinc-50">{hit.reportTitle}</span>
                        {hit.directName && <span className="text-xs text-gray-400 dark:text-zinc-500">{hit.directName}</span>}
                        <span className="text-[10px] text-gray-400 ml-auto dark:text-zinc-500">{hit.date}</span>
                      </div>
                      <div className="space-y-1">
                        {hit.matches.map((m, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 w-14 text-right dark:text-zinc-500">{FIELD_LABEL[m.field]}</span>
                            <p className="text-xs text-gray-600 line-clamp-2 dark:text-zinc-300">{m.text}</p>
                          </div>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Hint when empty */}
        {!hasResults && !showEmpty && query.length < 2 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-gray-400">
              {mode === 'search'
                ? `Search across ${docLabelPlural.toLowerCase()}, insights, metrics, and ${journalLabel.toLowerCase()} entries`
                : `Find every mention of a topic across all ${docLabelPlural.toLowerCase()} — metrics, flags, and summaries`}
            </p>
          </div>
        )}

        {/* Footer */}
        {mode === 'search' && hasResults && (
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 dark:border-zinc-800">
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5 dark:text-zinc-500">
              <kbd className="border border-gray-200 rounded px-1 py-0.5 dark:border-zinc-700">↑↓</kbd> navigate
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5 dark:text-zinc-500">
              <kbd className="border border-gray-200 rounded px-1 py-0.5 dark:border-zinc-700">↵</kbd> open
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1.5 dark:text-zinc-500">
              <kbd className="border border-gray-200 rounded px-1 py-0.5 dark:border-zinc-700">Esc</kbd> close
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
