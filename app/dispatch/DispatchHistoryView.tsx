'use client'

import { useState, useMemo } from 'react'
import { MessageSquare, Plus, Trash2, ChevronRight, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatSummary {
  id: string
  title: string
  updatedAt: string
  messages: string // JSON
}

interface Props {
  historyLoading: boolean
  history: ChatSummary[]
  userMemory: string
  setUserMemory: (m: string) => void
  chatId: string | null
  onNewChat: () => void
  onLoadChat: (chat: ChatSummary) => void
  onDeleteChat: (id: string, e: React.MouseEvent) => void
}

export default function DispatchHistoryView({
  historyLoading, history, userMemory, setUserMemory, chatId, onNewChat, onLoadChat, onDeleteChat,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return history
    return history.filter(c => c.title.toLowerCase().includes(q))
  }, [history, search])

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* New chat — prominent button */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors"
        >
          <Plus size={14} /> New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats…"
            className="w-full text-xs pl-7 pr-7 py-2 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-inset focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-zinc-800" />

      {historyLoading && (
        <div className="flex justify-center py-8">
          <Loader2 size={16} className="animate-spin text-gray-300 dark:text-zinc-600" />
        </div>
      )}

      {!historyLoading && history.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-8">No previous chats</p>
      )}

      {!historyLoading && history.length > 0 && filtered.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-8">No chats match &ldquo;{search}&rdquo;</p>
      )}

      {!historyLoading && filtered.map(chat => (
        <div
          key={chat.id}
          role="button"
          tabIndex={0}
          onClick={() => onLoadChat(chat)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onLoadChat(chat) }}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800 border-b border-gray-100 dark:border-zinc-800 transition-colors group cursor-pointer',
            chat.id === chatId && 'bg-gray-50 dark:bg-zinc-800'
          )}
        >
          <MessageSquare size={13} className="text-gray-300 dark:text-zinc-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 dark:text-zinc-100 truncate">{chat.title}</p>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
              {new Date(chat.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ChevronRight size={12} className="text-gray-300 dark:text-zinc-600 group-hover:text-gray-400 dark:group-hover:text-zinc-400" />
            <button
              onClick={e => onDeleteChat(chat.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-all"
              title="Delete chat"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      ))}

      {/* Memory section — pinned to bottom */}
      {!historyLoading && (
        <div className="mt-auto border-t border-gray-100 dark:border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">AI memory</p>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
                {userMemory
                  ? `${userMemory.split('\n').filter(Boolean).length} fact${userMemory.split('\n').filter(Boolean).length !== 1 ? 's' : ''} learned`
                  : 'Nothing learned yet'}
              </p>
            </div>
            {userMemory && (
              <button
                onClick={async () => {
                  await fetch('/api/dispatch/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memory: '' }) })
                  setUserMemory('')
                }}
                className="text-[11px] text-red-400 hover:text-red-600 transition-colors"
              >
                Clear memory
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
