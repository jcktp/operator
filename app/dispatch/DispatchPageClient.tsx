'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Trash2, Plus, AlertTriangle } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useMode } from '@/components/ModeContext'
import { getPersonasForMode, type PersonaId } from '@/lib/personas'
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
 const modeConfig = useMode()
 const [chats, setChats] = useState(initial)
 const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null)
 const [persona, setPersona] = useState<PersonaId>('dispatch')
 const [clearConfirm, setClearConfirm] = useState(false)
 const searchParams = useSearchParams()

 const personaMap = getPersonasForMode(modeConfig.id)
 const personaList = Object.values(personaMap)

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
 setChats(prev)
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

 const startNewChat = () => {
 setSelectedChat(null)
 // persona stays as the current selection
 }

 const personaLocked = false // sidebar lets the user freely switch persona for new chats; in-chat lock not enforced here
 const panelKey = selectedChat?.id ?? `new-${persona}`

 return (
 <div className="flex flex-1 min-h-0 -mx-6 sm:-mx-8 -mb-6 overflow-hidden bg-[var(--surface)]">
 {/* ── Persona / chat sidebar — 204px per Layout E spec ─────────── */}
 <aside style={{ width: 204 }} className="flex-shrink-0 max-w-[70vw] flex flex-col bg-[var(--surface)] border-r border-[var(--border)] h-full">
 {/* PERSONA section */}
 <div className="px-3 pt-4 pb-3 border-b border-[var(--border)] space-y-1.5">
 <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] px-1 mb-1">Persona</p>
 {personaList.map(p => {
 const isActive = persona === p.id
 return (
 <button
 key={p.id}
 type="button"
 onClick={() => !personaLocked && setPersona(p.id)}
 title={p.description}
 className={cn(
 'w-full text-left px-2.5 py-2 rounded-[6px] transition-colors border',
 isActive
 ? 'bg-[var(--blue-dim)] border-[var(--blue)] text-[var(--blue)]'
 : 'border-transparent text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 )}
 >
 <p className={cn('text-xs', isActive ? 'font-semibold text-[var(--blue)]' : 'font-medium')}>{p.name}</p>
 <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight">{p.tagline}</p>
 </button>
 )
 })}
 </div>

 {/* RECENT CHATS section */}
 <div className="px-3 pt-3 flex items-center justify-between">
 <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] px-1">Recent chats</p>
 <button
 onClick={startNewChat}
 title="New chat"
 className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
 >
 <Plus size={12} />
 </button>
 </div>
 <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5">
 {chats.length === 0 ? (
 <p className="text-[11px] text-[var(--text-muted)] text-center px-3 py-6">
 No saved chats yet.
 </p>
 ) : (
 chats.map(chat => {
 const isActive = selectedChat?.id === chat.id
 return (
 <div
 key={chat.id}
 role="button"
 tabIndex={0}
 onClick={() => setSelectedChat(chat)}
 onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelectedChat(chat) }}
 className={cn(
 'w-full text-left px-2.5 py-2 rounded-[6px] cursor-pointer group transition-colors',
 isActive ? 'bg-[var(--ink)]' : 'hover:bg-[var(--surface-2)]'
 )}
 >
 <div className="flex items-start gap-2">
 <div className="flex-1 min-w-0">
 <p className={cn('text-xs font-medium truncate', isActive ? 'text-white' : 'text-[var(--text-body)]')}>
 {chat.title}
 </p>
 <p className={cn('text-[10px] mt-0.5 truncate', isActive ? 'text-white/60' : 'text-[var(--text-muted)]')}>
 {chat.messageCount} msgs · {formatRelativeDate(new Date(chat.updatedAt))}
 </p>
 </div>
 <button
 type="button"
 onClick={e => deleteChat(chat.id, e)}
 className={cn(
 'shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
 isActive ? 'text-white/50 hover:text-white' : 'text-[var(--text-muted)] hover:text-[var(--red)]'
 )}
 >
 <Trash2 size={11} />
 </button>
 </div>
 </div>
 )
 })
 )}
 </div>

 {/* Clear all footer */}
 {chats.length > 0 && (
 <div className="p-2 border-t border-[var(--border)] shrink-0">
 <button
 onClick={clearAll}
 className={cn(
 'w-full text-[11px] px-3 py-1.5 rounded-[6px] transition-colors flex items-center justify-center gap-1.5',
 clearConfirm
 ? 'bg-[var(--red-dim)] text-[var(--red)]'
 : 'text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 )}
 >
 {clearConfirm && <AlertTriangle size={11} />}
 {clearConfirm ? 'Confirm — clear all' : 'Clear all'}
 </button>
 </div>
 )}
 </aside>

 {/* ── Chat panel ──────────────────────────────────────────────── */}
 <div style={{ flex: '1 1 0%', minWidth: 0 }} className="h-full">
 <DispatchPanel
 key={panelKey}
 context={context}
 fullPage
 currentProjectId={currentProjectId ?? null}
 currentProjectName={currentProjectName ?? null}
 persona={persona}
 setPersona={setPersona}
 hideInlinePersonaSelector
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
