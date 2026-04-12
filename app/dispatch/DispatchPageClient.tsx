'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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
 currentProjectId?: string | null
 currentProjectName?: string | null
}

export default function DispatchPageClient({ chats: initial, context, currentProjectId, currentProjectName }: Props) {
 const [chats, setChats] = useState(initial)
 const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null)
 const [clearConfirm, setClearConfirm] = useState(false)
 const searchParams = useSearchParams()

 // Pre-select a chat when linked from the embedded panel (?chat=<id>)
 useEffect(() => {
 const chatId = searchParams.get('chat')
 if (chatId && initial.length > 0) {
 const match = initial.find(c => c.id === chatId)
 if (match) setSelectedChat(match)
 }
 }, [searchParams, initial])

 const deleteChat = async (id: string, e: React.MouseEvent) => {
 e.stopPropagation()
 const prev = chats
 setChats(c => c.filter(x => x.id !== id))
 if (selectedChat?.id === id) setSelectedChat(null)
 try {
 const res = await fetch(`/api/dispatch/${id}`, { method: 'DELETE' })
 if (!res.ok) throw new Error(`HTTP ${res.status}`)
 } catch (err) {
 console.error('Failed to delete chat:', err)
 setChats(prev) // rollback on failure
 }
 }

 const clearAll = async () => {
 if (!clearConfirm) {
 setClearConfirm(true)
 setTimeout(() => setClearConfirm(false), 3000)
 return
 }
 try {
 const res = await fetch('/api/dispatch/clear', { method: 'DELETE' })
 if (!res.ok) throw new Error(`HTTP ${res.status}`)
 setChats([])
 setSelectedChat(null)
 } catch (err) {
 console.error('Failed to clear chats:', err)
 }
 setClearConfirm(false)
 }

 const panelKey = selectedChat?.id ?? 'new'

 return (
 <div className="fixed top-14 left-0 right-0 bottom-0 z-10 flex bg-[var(--surface)] overflow-hidden">
 {/* Sidebar */}
 <aside className="w-64 max-w-[70vw] shrink-0 flex flex-col bg-[var(--surface-2)] border-r border-[var(--border)] h-full">
 {/* Sidebar header */}
 <div className="px-4 py-3.5 border-b border-[var(--border)] flex items-center justify-between shrink-0">
 <div className="flex items-center gap-2">
 <MessageSquare size={14} className="text-[var(--text-muted)]" />
 <span className="text-sm font-semibold text-[var(--text-bright)]">Dispatch</span>
 </div>
 <button
 onClick={() => setSelectedChat(null)}
 title="New chat"
 className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-3)] transition-colors"
 >
 <Plus size={14} />
 </button>
 </div>

 {/* Chat list */}
 <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
 {chats.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-4">
 <MessageSquare size={20} className="text-[var(--border)]" />
 <p className="text-xs text-[var(--text-muted)]">No saved chats yet.<br />Start a conversation.</p>
 </div>
 ) : (
 chats.map(chat => (
 <div
 key={chat.id}
 onClick={() => setSelectedChat(chat)}
 className={`flex items-start gap-2.5 px-3 py-2.5 rounded-[10px] cursor-pointer group transition-colors ${
 selectedChat?.id === chat.id
 ? 'bg-[var(--ink)]'
 : 'hover:bg-[var(--surface-3)]'
 }`}
 >
 <div className="flex-1 min-w-0">
 <p className={`text-xs font-medium truncate ${selectedChat?.id === chat.id ? 'text-white' : 'text-[var(--text-body)]'}`}>
 {chat.title}
 </p>
 <p className={`text-[10px] mt-0.5 truncate ${selectedChat?.id === chat.id ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>
 {chat.messageCount} msgs · {formatRelativeDate(new Date(chat.updatedAt))}
 </p>
 </div>
 <button
 onClick={e => deleteChat(chat.id, e)}
 className={`shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
 selectedChat?.id === chat.id
 ? 'text-[var(--text-muted)] hover:text-[var(--red)]'
 : 'text-[var(--border)] hover:text-[var(--red)]'
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
 <div className="p-3 border-t border-[var(--border)] shrink-0">
 <button
 onClick={clearAll}
 className={`w-full text-xs px-3 py-1.5 rounded-[4px] transition-colors flex items-center justify-center gap-1.5 ${
 clearConfirm
 ? 'bg-[var(--red-dim)] text-[var(--red)] hover:bg-red-100'
 : 'text-[var(--text-muted)] hover:text-[var(--text-subtle)] hover:bg-[var(--surface-3)]'
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
 currentProjectId={currentProjectId ?? null}
 currentProjectName={currentProjectName ?? null}
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
