'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChats(c => c.filter(x => x.id !== id))
    if (selectedChat?.id === id) setSelectedChat(null)
    await fetch(`/api/dispatch/${id}`, { method: 'DELETE' })
    router.refresh()
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
    router.refresh()
  }

  const panelKey = selectedChat?.id ?? 'new'

  return (
    <div className="flex gap-6 items-start">
      {/* Left: chat list */}
      <div className="w-72 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Saved chats</span>
          <div className="flex items-center gap-1">
            {chats.length > 0 && (
              <button
                onClick={clearAll}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                  clearConfirm
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                {clearConfirm ? 'Confirm clear all' : 'Clear all'}
              </button>
            )}
            <button
              onClick={() => setSelectedChat(null)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="New chat"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {chats.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-400">
            <MessageSquare size={20} className="mx-auto mb-2 opacity-30" />
            No saved chats yet
          </div>
        ) : (
          <div className="space-y-1">
            {chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className={`flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer group transition-colors ${
                  selectedChat?.id === chat.id
                    ? 'bg-gray-900 text-white'
                    : 'hover:bg-gray-100'
                }`}
              >
                <MessageSquare size={13} className={`shrink-0 mt-0.5 ${selectedChat?.id === chat.id ? 'text-gray-400' : 'text-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${selectedChat?.id === chat.id ? 'text-white' : 'text-gray-800'}`}>
                    {chat.title}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${selectedChat?.id === chat.id ? 'text-gray-400' : 'text-gray-400'}`}>
                    {chat.messageCount} msgs · {formatRelativeDate(new Date(chat.updatedAt))}
                  </p>
                </div>
                <button
                  onClick={e => deleteChat(chat.id, e)}
                  className={`shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                    selectedChat?.id === chat.id
                      ? 'text-gray-400 hover:text-red-400'
                      : 'text-gray-300 hover:text-red-500'
                  }`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: dispatch panel */}
      <div className="flex-1 min-w-0 h-[calc(100vh-140px)] min-h-[500px]">
        <DispatchPanel
          key={panelKey}
          context={context}
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
