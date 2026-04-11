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
 className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--ink)] text-white text-sm font-medium rounded-[10px] hover:opacity-90 transition-colors"
 >
 <Plus size={14} /> New chat
 </button>
 </div>

 {/* Search */}
 <div className="px-3 pb-2 shrink-0">
 <div className="relative">
 <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
 <input
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Search chats…"
 className="w-full text-xs pl-7 pr-7 py-2 border border-[var(--border)] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-inset bg-[var(--surface)] text-[var(--text-body)] placeholder-gray-400"
 />
 {search && (
 <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-subtle)]">
 <X size={11} />
 </button>
 )}
 </div>
 </div>

 <div className="border-t border-[var(--border)]" />

 {historyLoading && (
 <div className="flex justify-center py-8">
 <Loader2 size={16} className="animate-spin text-[var(--border)]" />
 </div>
 )}

 {!historyLoading && history.length === 0 && (
 <p className="text-xs text-[var(--text-muted)] text-center py-8">No previous chats</p>
 )}

 {!historyLoading && history.length > 0 && filtered.length === 0 && (
 <p className="text-xs text-[var(--text-muted)] text-center py-8">No chats match &ldquo;{search}&rdquo;</p>
 )}

 {!historyLoading && filtered.map(chat => (
 <div
 key={chat.id}
 role="button"
 tabIndex={0}
 onClick={() => onLoadChat(chat)}
 onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onLoadChat(chat) }}
 className={cn(
 'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] border-b border-[var(--border)] transition-colors group cursor-pointer',
 chat.id === chatId && 'bg-[var(--surface-2)]'
 )}
 >
 <MessageSquare size={13} className="text-[var(--border)] shrink-0 mt-0.5" />
 <div className="flex-1 min-w-0">
 <p className="text-xs font-medium text-[var(--text-body)] truncate">{chat.title}</p>
 <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
 {new Date(chat.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
 </p>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 <ChevronRight size={12} className="text-[var(--border)] group-hover:text-[var(--text-muted)]" />
 <button
 onClick={e => onDeleteChat(chat.id, e)}
 className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--border)] hover:text-[var(--red)] transition-all"
 title="Delete chat"
 >
 <Trash2 size={11} />
 </button>
 </div>
 </div>
 ))}

 {/* Memory section — pinned to bottom */}
 {!historyLoading && (
 <div className="mt-auto border-t border-[var(--border)] px-4 py-3">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-[11px] font-medium text-[var(--text-muted)]">AI memory</p>
 <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
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
 className="text-[11px] text-[var(--red)] hover:text-[var(--red)] transition-colors"
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
