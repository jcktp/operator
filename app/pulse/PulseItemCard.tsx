'use client'

import { ExternalLink, BookOpen, Loader2, X } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'

const TYPE_COLORS: Record<string, string> = {
  rss:      'bg-orange-50 text-orange-700 border-orange-200',
  reddit:   'bg-red-50 text-red-700 border-red-200',
  youtube:  'bg-red-50 text-red-800 border-red-300',
  bluesky:  'bg-sky-50 text-sky-700 border-sky-200',
  mastodon: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  webhook:  'bg-purple-50 text-purple-700 border-purple-200',
}

interface PulseItem {
  id: string
  title: string
  url: string | null
  summary: string | null
  publishedAt: string | null
  savedToJournal: boolean
  feedId: string
}

interface Props {
  item: PulseItem & { feedName: string; feedType: string }
  isKeywordMode: boolean
  activeKeywords: Set<string>
  savingItemId: string | null
  savingFolder: Record<string, string>
  setSavingFolder: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onSave: (id: string, folder?: string) => void
  onUnsave: (id: string) => void
}

function highlight(text: string, activeKeywords: Set<string>): React.ReactNode {
  if (activeKeywords.size === 0) return text
  const pattern = new RegExp(`(${[...activeKeywords].map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, i) =>
    pattern.test(part) ? <mark key={i} className="bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded px-0.5">{part}</mark> : part
  )
}

export default function PulseItemCard({ item, isKeywordMode, activeKeywords, savingItemId, savingFolder, setSavingFolder, onSave, onUnsave }: Props) {
  const showHighlight = isKeywordMode && activeKeywords.size > 0

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${TYPE_COLORS[item.feedType] ?? 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-zinc-700'}`}>
              {item.feedName}
            </span>
            {item.publishedAt && (
              <span className="text-xs text-gray-400 dark:text-zinc-500">{formatRelativeDate(item.publishedAt)}</span>
            )}
          </div>
          <p className="text-sm font-medium leading-snug text-gray-900 dark:text-zinc-50">
            {showHighlight ? highlight(item.title, activeKeywords) : item.title}
          </p>
          {item.summary && item.summary !== item.title && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">
              {showHighlight ? highlight(item.summary, activeKeywords) : item.summary}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {item.url && (
            <a
              href={`/browser?url=${encodeURIComponent(item.url)}`}
              className="p-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
              title="Open in Operator Browser"
            >
              <ExternalLink size={13} />
            </a>
          )}
          {item.savedToJournal ? (
            <div className="flex items-center gap-1">
              <a href="/journal?folder=Pulse"
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-green-200 dark:border-green-800 text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
                title="Saved to Journal — click to view"
              >
                <BookOpen size={11} />
                Saved
              </a>
              <button
                onClick={() => onUnsave(item.id)}
                disabled={savingItemId === item.id}
                className="p-1 rounded text-gray-300 dark:text-zinc-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                title="Remove from Journal"
              >
                {savingItemId === item.id ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
              </button>
            </div>
          ) : isKeywordMode ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={savingFolder[item.id] ?? 'Pulse'}
                onChange={e => setSavingFolder(sf => ({ ...sf, [item.id]: e.target.value }))}
                placeholder="Folder"
                className="w-20 text-xs border border-gray-200 dark:border-zinc-700 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
              />
              <button
                onClick={() => onSave(item.id, savingFolder[item.id])}
                disabled={savingItemId === item.id}
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                title="Save to Journal"
              >
                {savingItemId === item.id ? <Loader2 size={11} className="animate-spin" /> : <BookOpen size={11} />}
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => onSave(item.id)}
              disabled={savingItemId === item.id}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              title="Save to Journal"
            >
              {savingItemId === item.id ? <Loader2 size={11} className="animate-spin" /> : <BookOpen size={11} />}
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
