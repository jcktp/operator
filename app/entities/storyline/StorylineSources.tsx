'use client'

import { useState } from 'react'
import { Plus, X, Tag, UserCircle, Loader2 } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'

export interface DirectOption {
  id: string
  name: string
  title: string
  area: string
  updatedAt: string
}

export interface StorySourceItem {
  id: string
  directReportId: string
  tags: string   // JSON string[]
  notes: string | null
  directReport: DirectOption
}

interface Props {
  storyId: string
  sources: StorySourceItem[]
  allDirects: DirectOption[]
  onChange: (sources: StorySourceItem[]) => void
}

const PRESET_TAGS = ['on-record', 'off-record', 'anonymous', 'whistleblower', 'expert', 'official', 'disputed']

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

export default function StorylineSources({ storyId, sources, allDirects, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [selectedDirectId, setSelectedDirectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState<Record<string, string>>({})

  const assignedIds = new Set(sources.map(s => s.directReportId))
  const available = allDirects.filter(d => !assignedIds.has(d.id))

  const handleAdd = async () => {
    if (!selectedDirectId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/storyline/${storyId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directReportId: selectedDirectId }),
      })
      const data = await res.json() as { source: StorySourceItem }
      onChange([...sources, data.source])
      setSelectedDirectId('')
      setAdding(false)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (sourceId: string) => {
    await fetch(`/api/storyline/${storyId}/sources/${sourceId}`, { method: 'DELETE' })
    onChange(sources.filter(s => s.id !== sourceId))
  }

  const handleAddTag = async (source: StorySourceItem, tag: string) => {
    const current = parseTags(source.tags)
    if (current.includes(tag)) return
    const newTags = [...current, tag]
    const res = await fetch(`/api/storyline/${storyId}/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    const data = await res.json() as { source: StorySourceItem }
    onChange(sources.map(s => s.id === source.id ? data.source : s))
    setTagInput(prev => ({ ...prev, [source.id]: '' }))
  }

  const handleRemoveTag = async (source: StorySourceItem, tag: string) => {
    const newTags = parseTags(source.tags).filter(t => t !== tag)
    const res = await fetch(`/api/storyline/${storyId}/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    const data = await res.json() as { source: StorySourceItem }
    onChange(sources.map(s => s.id === source.id ? data.source : s))
  }

  return (
    <div className="space-y-3">
      {sources.map(source => {
        const tags = parseTags(source.tags)
        const tInput = tagInput[source.id] ?? ''
        const suggestions = PRESET_TAGS.filter(t => !tags.includes(t) && t.includes(tInput))

        return (
          <div key={source.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <UserCircle size={14} className="text-gray-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-zinc-100">{source.directReport.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500">{source.directReport.title} · {source.directReport.area}</p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-500">Last contact {formatRelativeDate(source.directReport.updatedAt)}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemove(source.id)}
                className="text-gray-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
              >
                <X size={12} />
              </button>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                >
                  <Tag size={8} />
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(source, tag)}
                    className="ml-0.5 hover:text-red-400 transition-colors"
                  >
                    <X size={8} />
                  </button>
                </span>
              ))}
              {/* Tag input */}
              <div className="relative">
                <input
                  value={tInput}
                  onChange={e => setTagInput(prev => ({ ...prev, [source.id]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && tInput.trim()) {
                      handleAddTag(source, tInput.trim())
                    }
                  }}
                  placeholder="+ tag"
                  className="text-[10px] border border-dashed border-gray-300 dark:border-zinc-600 rounded px-1.5 py-0.5 w-16 focus:outline-none focus:border-indigo-400 bg-transparent text-gray-500 dark:text-zinc-400 placeholder-gray-400 dark:placeholder-zinc-600"
                />
                {tInput && suggestions.length > 0 && (
                  <div className="absolute left-0 top-full mt-0.5 z-10 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-max">
                    {suggestions.slice(0, 5).map(s => (
                      <button
                        key={s}
                        onClick={() => handleAddTag(source, s)}
                        className="block w-full text-left px-2.5 py-1 text-[10px] text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Add source */}
      {adding ? (
        <div className="flex gap-2">
          <select
            value={selectedDirectId}
            onChange={e => setSelectedDirectId(e.target.value)}
            className="flex-1 text-xs border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400"
          >
            <option value="">Select a contact…</option>
            {available.map(d => (
              <option key={d.id} value={d.id}>{d.name} — {d.area}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={loading || !selectedDirectId}
            className="shrink-0 px-3 py-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : 'Add'}
          </button>
          <button
            onClick={() => { setAdding(false); setSelectedDirectId('') }}
            className="shrink-0 px-3 py-1.5 border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={available.length === 0}
          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-40"
        >
          <Plus size={11} />
          {available.length === 0 ? 'All contacts assigned' : 'Assign source'}
        </button>
      )}

      {sources.length === 0 && !adding && (
        <p className="text-[11px] text-gray-400 dark:text-zinc-500">No sources assigned yet.</p>
      )}
    </div>
  )
}
