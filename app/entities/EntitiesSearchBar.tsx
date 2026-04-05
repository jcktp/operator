'use client'

import { useState } from 'react'
import { Search, Wand2, X, Loader2, FileText } from 'lucide-react'
import Link from 'next/link'
import { useEntitiesSearch } from './EntitiesSearchContext'

const QUESTION_PATTERNS = /^(what|when|who|where|how|which|why|tell me|show me|list|summarize|how many|find)/i

function isQuestion(text: string): boolean {
  return QUESTION_PATTERNS.test(text.trim()) || text.trim().endsWith('?')
}

interface Source { id: string; title: string }
interface Answer { text: string; sources: Source[] }

export default function EntitiesSearchBar({
  projectId,
  activeTab,
}: {
  projectId?: string | null
  activeTab: string
}) {
  const { query, setQuery } = useEntitiesSearch()
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [error, setError] = useState('')

  const showAiHint = isQuestion(query.trim()) && query.trim().length > 3

  const placeholder =
    activeTab === 'timeline'
      ? 'Search events or ask a question…'
      : activeTab === 'entities'
      ? 'Search entities or ask a question…'
      : 'Ask a question…'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q || !isQuestion(q)) return

    setLoading(true)
    setAnswer(null)
    setError('')

    try {
      const res = await fetch('/api/entities-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, projectId }),
      })
      const data = await res.json() as { answer?: string; sources?: Source[]; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setAnswer({ text: data.answer ?? '', sources: data.sources ?? [] })
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setQuery('')
    setAnswer(null)
    setError('')
  }

  return (
    <div className="mb-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          {showAiHint
            ? <Wand2 size={14} className="absolute left-3 text-indigo-400 dark:text-indigo-500 pointer-events-none" />
            : <Search size={14} className="absolute left-3 text-gray-400 dark:text-zinc-500 pointer-events-none" />
          }
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setAnswer(null); setError('') }}
            placeholder={placeholder}
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600 transition-shadow"
          />
          {query && (
            <button type="button" onClick={clear} className="absolute right-3 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">
              <X size={13} />
            </button>
          )}
        </div>
        {showAiHint && (
          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1 ml-1">
            Press Enter to ask AI
          </p>
        )}
      </form>

      {(loading || answer || error) && (
        <div className="mt-2 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 p-3 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-indigo-500 dark:text-indigo-400">
              <Loader2 size={12} className="animate-spin" />
              Analysing…
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {answer && (
            <>
              <p className="text-sm text-gray-800 dark:text-zinc-200 leading-relaxed">{answer.text}</p>
              {answer.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                  {answer.sources.map(s => (
                    <Link
                      key={s.id}
                      href={`/reports/${s.id}`}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                    >
                      <FileText size={10} />
                      {s.title.length > 40 ? s.title.slice(0, 40) + '…' : s.title}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
