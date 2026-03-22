'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, MessageSquare, ArrowRight } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'

interface ChatSummary {
  id: string
  title: string
  messageCount: number
  preview: string
  updatedAt: string
}

export default function DispatchChatList({ chats: initial }: { chats: ChatSummary[] }) {
  const [chats, setChats] = useState(initial)
  const router = useRouter()

  const deleteChat = async (id: string) => {
    setChats(c => c.filter(x => x.id !== id))
    await fetch(`/api/dispatch/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
      {chats.map(chat => (
        <div key={chat.id} className="flex items-start gap-3 px-4 py-4 group hover:bg-gray-50 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
            <MessageSquare size={14} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{chat.title}</p>
            {chat.preview && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{chat.preview}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {chat.messageCount} message{chat.messageCount !== 1 ? 's' : ''} · {formatRelativeDate(new Date(chat.updatedAt))}
            </p>
          </div>
          <button
            onClick={() => deleteChat(chat.id)}
            className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete chat"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
