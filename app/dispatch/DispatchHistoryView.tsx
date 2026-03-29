'use client'

import { MessageSquare, Plus, Trash2, ChevronRight, Loader2 } from 'lucide-react'
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
  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <button
        onClick={onNewChat}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 border-b border-gray-100 transition-colors"
      >
        <Plus size={14} className="text-gray-400" /> New chat
      </button>

      {historyLoading && (
        <div className="flex justify-center py-8">
          <Loader2 size={16} className="animate-spin text-gray-300" />
        </div>
      )}

      {!historyLoading && history.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-8">No previous chats</p>
      )}

      {!historyLoading && history.length > 0 && history.map(chat => (
        <div
          key={chat.id}
          role="button"
          tabIndex={0}
          onClick={() => onLoadChat(chat)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onLoadChat(chat) }}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 transition-colors group cursor-pointer',
            chat.id === chatId && 'bg-gray-50'
          )}
        >
          <MessageSquare size={13} className="text-gray-300 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 truncate">{chat.title}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {new Date(chat.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-400" />
            <button
              onClick={e => onDeleteChat(chat.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-400 transition-all"
              title="Delete chat"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      ))}

      {/* Memory section — pinned to bottom */}
      {!historyLoading && (
        <div className="mt-auto border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-gray-500">AI memory</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
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
