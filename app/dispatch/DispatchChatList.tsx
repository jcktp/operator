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
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {chats.map(chat => (
 <div key={chat.id} className="flex items-start gap-3 px-4 py-4 group hover:bg-[var(--surface-2)] transition-colors">
 <div className="w-8 h-8 rounded-[4px] bg-[var(--surface-2)] flex items-center justify-center shrink-0 mt-0.5">
 <MessageSquare size={14} className="text-[var(--text-muted)]" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-[var(--text-bright)] truncate">{chat.title}</p>
 {chat.preview && (
 <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-relaxed">{chat.preview}</p>
 )}
 <p className="text-xs text-[var(--text-muted)] mt-1">
 {chat.messageCount} message{chat.messageCount !== 1 ? 's' : ''} · {formatRelativeDate(new Date(chat.updatedAt))}
 </p>
 </div>
 <button
 onClick={() => deleteChat(chat.id)}
 className="shrink-0 p-1.5 text-[var(--border)] hover:text-[var(--red)] rounded-[4px] hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
 title="Delete chat"
 >
 <Trash2 size={13} />
 </button>
 </div>
 ))}
 </div>
 )
}
