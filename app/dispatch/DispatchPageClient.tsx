'use client'

import { useState } from 'react'
import { Trash2, MessageSquare, Plus, AlertTriangle } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import DispatchPanel from './DispatchPanel'

interface Message { role: 'user' | 'assistant'; content: string }

interface ChatSummary {
  id: string
  title: string
  messageCount: number
  preview: string
  updatedAt: string
  messages: Message[]
}

interface Props {
  chats: ChatSummary[]
  context: string
}

export default function DispatchPageClient({ chats: initial, context }: Props) {
  const [chats, setChats] = useState(initial)
  const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChats(c => c.filter(x => x.id !== id))
    if (selectedChat?.id === id) setSelectedChat(null)
    await fetch(`/api/dispatch/${id}`, { method: 'DELETE' })
  }

  const clearAll = async () => {
    if (!clearConfirm) {
      setClearConfirm(true)
      setTimeout(() => setClearConfirm(false), 3000)
      return
    }
    await fetch('/api/dispatch/clear', { method: 'DELETE' })
    setChats([])
    setSelectedChat(null)
    setClearConfirm(false)
  }

  const panelKey = selectedChat?.id ?? 'new'

  return (
    <div className="fixed top-14 left-0 right-0 bottom-0 z-10 flex bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col bg-gray-50 dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 h-full">
        {/* Sidebar header */}
        <div className="px-4 py-3.5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-gray-500 dark:text-zinc-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Dispatch</span>
          </div>
          <button
            onClick={() => setSelectedChat(null)}
            title="New chat"
            className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
              <MessageSquare size={20} className="text-gray-300 dark:text-zinc-600" />
              <p className="text-xs text-gray-400 dark:text-zinc-500">No saved chats yet.<br />Start a conversation.</p>
            </div>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer group transition-colors ${
                  selectedChat?.id === chat.id
                    ? 'bg-gray-900 dark:bg-zinc-100'
                    : 'hover:bg-gray-200 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${selectedChat?.id === chat.id ? 'text-white dark:text-zinc-900' : 'text-gray-800 dark:text-zinc-100'}`}>
                    {chat.title}
                  </p>
                  <p className={`text-[10px] mt-0.5 truncate ${selectedChat?.id === chat.id ? 'text-gray-400 dark:text-zinc-500' : 'text-gray-400 dark:text-zinc-500'}`}>
                    {chat.messageCount} msgs · {formatRelativeDate(new Date(chat.updatedAt))}
                  </p>
                </div>
                <button
                  onClick={e => deleteChat(chat.id, e)}
                  className={`shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                    selectedChat?.id === chat.id
                      ? 'text-gray-400 dark:text-zinc-500 hover:text-red-400'
                      : 'text-gray-300 dark:text-zinc-600 hover:text-red-500'
                  }`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Clear all footer */}
        {chats.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-zinc-800 shrink-0">
            <button
              onClick={clearAll}
              className={`w-full text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                clearConfirm
                  ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900'
                  : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800'
              }`}
            >
              {clearConfirm && <AlertTriangle size={11} />}
              {clearConfirm ? 'Confirm — clear all chats' : 'Clear all'}
            </button>
          </div>
        )}
      </aside>

      {/* Chat panel */}
      <div className="flex-1 min-w-0 h-full">
        <DispatchPanel
          key={panelKey}
          context={context}
          fullPage
          initialChat={selectedChat ? {
            id: selectedChat.id,
            title: selectedChat.title,
            messages: selectedChat.messages,
          } : undefined}
        />
      </div>
    </div>
  )
}
