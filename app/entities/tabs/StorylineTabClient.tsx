'use client'

import { useState } from 'react'
import { Plus, BookOpen, ChevronRight, Loader2 } from 'lucide-react'
import StorylineEditor from '../storyline/StorylineEditor'
import type { PickerReport } from '../storyline/StorylineReportPicker'
import type { DirectOption } from '../storyline/StorylineSources'

interface Evidence {
  id: string
  url: string
  title: string
  notes?: string | null
}

interface Story {
  id: string
  title: string
  description: string | null
  status: string
  reportIds: string
  narrative: string | null
  events: string | null
  claimStatuses: string | null
  evidence: Evidence[]
}

interface Props {
  stories: Story[]
  allReports: PickerReport[]
  allDirects: DirectOption[]
}

export default function StorylineTabClient({ stories: initialStories, allReports, allDirects }: Props) {
  const [stories, setStories] = useState<Story[]>(initialStories)
  const [selectedId, setSelectedId] = useState<string | null>(initialStories[0]?.id ?? null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const selectedStory = stories.find(s => s.id === selectedId) ?? null

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/storyline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), reportIds: [], status: 'researching' }),
      })
      const data = await res.json() as { story: Story }
      setStories(prev => [data.story, ...prev])
      setSelectedId(data.story.id)
      setNewTitle('')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = (updated: Story) => {
    setStories(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  const handleDelete = (id: string) => {
    const remaining = stories.filter(s => s.id !== id)
    setStories(remaining)
    setSelectedId(remaining[0]?.id ?? null)
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Sidebar — story list */}
      <aside className="w-56 shrink-0 space-y-2 sticky top-24">
        {/* Create new */}
        <div className="space-y-1.5">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="New story title…"
            className="w-full text-xs border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
          >
            {creating ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Create story
          </button>
        </div>

        {/* Story list */}
        {stories.length > 0 && (
          <div className="space-y-0.5 mt-3">
            {stories.map(s => {
              const isActive = s.id === selectedId
              const claimCount = (() => {
                try { return (JSON.parse(s.claimStatuses ?? '[]') as Array<{ status: string }>).length } catch { return 0 }
              })()
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-300'
                  }`}
                >
                  <BookOpen size={12} className="shrink-0" />
                  <span className="flex-1 text-xs font-medium truncate">{s.title}</span>
                  {claimCount > 0 && (
                    <span className={`text-[10px] shrink-0 ${isActive ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500'}`}>
                      {claimCount}
                    </span>
                  )}
                  <ChevronRight size={10} className="shrink-0 opacity-40" />
                </button>
              )
            })}
          </div>
        )}

        {stories.length === 0 && !newTitle && (
          <p className="text-xs text-gray-400 dark:text-zinc-500 text-center pt-4">
            No stories yet. Create one to start building a narrative.
          </p>
        )}
      </aside>

      {/* Editor pane */}
      <div className="flex-1 min-w-0">
        {selectedStory ? (
          <StorylineEditor
            key={selectedStory.id}
            story={selectedStory}
            allReports={allReports}
            allDirects={allDirects}
            onUpdate={handleUpdate}
            onDelete={() => handleDelete(selectedStory.id)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen size={24} className="text-gray-300 dark:text-zinc-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">Select a story or create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}
