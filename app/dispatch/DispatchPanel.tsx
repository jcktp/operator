'use client'

import { useEffect, useState } from 'react'
import { X, Send, MessageSquare, Paperclip, Link2, Loader2, Globe, GlobeLock, Clock, Plus, BookOpen, BookmarkPlus, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { renderMarkdown } from './MarkdownRenderer'
import { useMode } from '@/components/ModeContext'
import { getSuggestions } from './dispatchSuggestions'
import DispatchHistoryView, { type ChatSummary } from './DispatchHistoryView'
import { downloadCode, markdownToHtml } from './dispatchUtils'
import { useChatLogic } from './useChatLogic'

import type { PersonaId } from '@/lib/personas'

interface Props {
 context: string
 currentUrl?: string
 onClose?: () => void
 initialChat?: { id: string; title: string; messages: Array<{ role: 'user' | 'assistant'; content: string; attachmentName?: string }> }
 initialMessage?: string
 fullPage?: boolean
 compact?: boolean
 currentProjectId?: string | null
 currentProjectName?: string | null
 /** Lift persona to a parent (e.g. the sidebar in the Dispatch page). */
 persona?: PersonaId
 setPersona?: (p: PersonaId) => void
 /** Hide the in-chat persona selector row when the parent renders one elsewhere (e.g. sidebar). */
 hideInlinePersonaSelector?: boolean
}

export default function DispatchPanel({ context, currentUrl, onClose, initialChat, initialMessage, fullPage, compact, currentProjectId, currentProjectName, persona, setPersona, hideInlinePersonaSelector }: Props) {
 const modeConfig = useMode()
 const c = useChatLogic({ context, modeId: modeConfig.id, initialChat, initialMessage, persona, setPersona })
 const personaList = Object.values(c.personaMap)
 const activePersona = c.personaMap[c.persona]
 const [savedNoteIdx, setSavedNoteIdx] = useState<number | null>(null)

 const saveMessageAsNote = async (content: string, idx: number) => {
 const html = markdownToHtml(content)
 const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
 const snippet = content.replace(/[#*`_\-]/g, '').replace(/\s+/g, ' ').slice(0, 50).trim()
 const title = `${date} — ${snippet || 'Note from Dispatch'}`
 const folder = currentProjectName ?? 'General'
 await fetch('/api/journal', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ title, folder, content: html, projectId: currentProjectId ?? null }),
 })
 setSavedNoteIdx(idx)
 setTimeout(() => setSavedNoteIdx(null), 3000)
 }

 useEffect(() => {
 c.bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
 }, [c.messages, c.loading])

 useEffect(() => { c.inputRef.current?.focus() }, [])

 useEffect(() => { c.syncSettings() }, [])

 useEffect(() => { c.refreshMemory() }, [])

 useEffect(() => {
 if (currentUrl && c.prevUrlRef.current && currentUrl !== c.prevUrlRef.current) {
 c.clearChat()
 }
 c.prevUrlRef.current = currentUrl
 }, [currentUrl])

 return (
 <div className={cn("h-full flex flex-col bg-[var(--surface)] overflow-hidden")}>
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
 <div className="flex items-center gap-2">
 <MessageSquare size={14} className="text-[var(--text-muted)]" />
 <span className="text-sm font-semibold text-[var(--text-bright)]">{activePersona.name}</span>
 <span className="text-xs text-[var(--text-muted)]">{activePersona.tagline}</span>
 </div>
 <div className="flex items-center gap-1">
 {c.view === 'history' ? (
 <button type="button" onClick={() => c.setView('chat')} title="Back to chat" aria-label="Back to chat"
 className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">
 <X size={13} />
 </button>
 ) : (
 <>
 {c.messages.length > 0 && (
 <button onClick={c.clearChat} title="New chat"
 className="flex items-center gap-1 px-2 py-1.5 rounded-[4px] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors">
 <Plus size={13} /> New chat
 </button>
 )}
 <button type="button" onClick={c.openHistory} title="Chat history" aria-label="Chat history"
 className="p-1.5 rounded-[4px] transition-colors text-[var(--text-muted)] hover:text-[var(--text-subtle)] hover:bg-[var(--surface-2)]">
 <Clock size={13} />
 </button>
 {!fullPage && (
 <Link
 href={c.chatId ? `/dispatch?chat=${c.chatId}` : '/dispatch'}
 title="Open full Dispatch"
 className="p-1.5 rounded-[4px] transition-colors text-[var(--text-muted)] hover:text-[var(--text-subtle)] hover:bg-[var(--surface-2)]"
 >
 <ExternalLink size={13} />
 </Link>
 )}
 </>
 )}
 {onClose && (
 <button type="button" onClick={onClose} aria-label="Close dispatch panel"
 className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">
 <X size={14} />
 </button>
 )}
 </div>
 </div>

 {/* History view */}
 {c.view === 'history' && (
 <DispatchHistoryView
 historyLoading={c.historyLoading}
 history={c.history}
 userMemory={c.userMemory}
 setUserMemory={c.setUserMemory}
 chatId={c.view === 'history' ? null : null}
 onNewChat={c.clearChat}
 onLoadChat={c.loadChat}
 onDeleteChat={c.deleteChat}
 />
 )}

 {/* Chat view */}
 {c.view === 'chat' && <>
 {/* Persona selector — hidden when the parent (e.g. Dispatch sidebar) renders its own */}
 {!hideInlinePersonaSelector && (
 <div className="flex gap-1 px-3 pt-2.5 pb-0 shrink-0">
 {personaList.map(p => {
 const locked = c.messages.length > 0
 const active = c.persona === p.id
 return (
 <button
 key={p.id}
 onClick={() => !locked && c.setPersona(p.id)}
 title={locked && !active ? 'Start a new chat to switch persona' : p.description}
 disabled={locked && !active}
 className={cn(
 'flex-1 py-1.5 rounded-[4px] text-xs font-medium transition-colors',
 active
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)]'
 : locked
 ? 'text-[var(--border)] cursor-not-allowed'
 : 'text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 )}
 >
 {p.name}
 </button>
 )
 })}
 </div>
 )}

 <div className="flex-1 overflow-y-auto p-4 space-y-4">
 {c.messages.length === 0 && (
 <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
 <div className="w-10 h-10 rounded-[10px] bg-[var(--surface-2)] flex items-center justify-center">
 <MessageSquare size={18} className="text-[var(--text-muted)]" />
 </div>
 <div>
 <p className="text-sm font-medium text-[var(--text-body)]">
 {c.userName ? `Hi ${c.userName}` : activePersona.name}
 </p>
 <p className="text-xs text-[var(--text-muted)] mt-1">
 {c.userRole
 ? `${activePersona.description} Ready to help you as ${c.userRole}.`
 : activePersona.description}
 </p>
 </div>
 <div className="flex flex-col gap-2 w-full mt-2">
 {getSuggestions(c.persona, c.userRole, modeConfig.id).map(suggestion => (
 <button key={suggestion} onClick={() => { c.setInput(suggestion); c.inputRef.current?.focus() }}
 className="text-xs text-left px-3 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] hover:border-[var(--border-mid)] text-[var(--text-subtle)] transition-colors">
 {suggestion}
 </button>
 ))}
 </div>
 </div>
 )}

 {c.messages.map((m, i) => (
 <div key={`${m.role}-${i}-${m.content.slice(0, 20)}`} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
 {m.attachmentName && (
 <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mb-0.5 px-1">
 <Paperclip size={9} />
 <span className="truncate max-w-[180px]">{m.attachmentName}</span>
 </div>
 )}
 <div className={cn(
 'max-w-[85%] rounded-[10px] px-3.5 py-2.5 text-sm leading-relaxed',
 m.role === 'user'
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] rounded-br-sm whitespace-pre-wrap'
 : 'bg-[var(--surface-2)] text-[var(--text-body)] rounded-bl-sm'
 )}>
 {m.role === 'assistant' ? renderMarkdown(m.content, downloadCode) : m.content}
 </div>
 {m.role === 'assistant' && !c.loading && (
 <div className="mt-1 flex items-center gap-1">
 {savedNoteIdx === i ? (
 <span className="text-[10px] text-[var(--green)] px-1">
 Saved to {currentProjectName ?? modeConfig.navJournal}
 </span>
 ) : (
 <button
 onClick={() => saveMessageAsNote(m.content, i)}
 title={`Save to ${currentProjectName ? `${currentProjectName} folder` : modeConfig.navJournal}`}
 className="flex items-center gap-1 text-[10px] text-[var(--border)] hover:text-[var(--text-muted)] transition-colors px-1 py-0.5 rounded"
 >
 <BookmarkPlus size={11} />
 Save as note
 </button>
 )}
 </div>
 )}
 </div>
 ))}

 {c.searching && (
 <div className="flex justify-start">
 <div className="bg-[var(--surface-2)] rounded-[10px] rounded-bl-sm px-4 py-3 flex items-center gap-2">
 <Globe size={12} className="text-[var(--green)] animate-pulse shrink-0" />
 <span className="text-xs text-[var(--text-muted)]">
 Searching the web for: <span className="font-medium text-[var(--text-body)] truncate max-w-[200px] inline-block align-bottom">{c.searching}</span>
 </span>
 </div>
 </div>
 )}

 {c.loading && !c.searching && c.messages.at(-1)?.role !== 'assistant' && (
 <div className="flex justify-start">
 <div className="bg-[var(--surface-2)] rounded-[10px] rounded-bl-sm px-4 py-3">
 <div className="flex gap-1">
 <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:-0.3s]" />
 <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce [animation-delay:-0.15s]" />
 <div className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" />
 </div>
 </div>
 </div>
 )}
 <div ref={c.bottomRef} />
 </div>

 {/* Note saved toast */}
 {c.savedNoteTitle && (
 <div className="mx-3 mb-1 flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-sm px-3 py-2 text-xs text-[var(--text-body)]">
 <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
 <BookOpen size={11} className="text-[var(--text-muted)] shrink-0" />
 <span>Saved to {modeConfig.navJournal}:</span>
 <span className="font-medium truncate">{c.savedNoteTitle}</span>
 </div>
 )}

 {/* Attachment preview */}
 {c.pendingAttachment && (
 <div className="mx-3 mb-1 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-[10px] px-3 py-2">
 <Paperclip size={12} className="text-blue-500 shrink-0" />
 <span className="text-xs text-blue-700 truncate flex-1">{c.pendingAttachment.name}</span>
 <button onClick={() => c.setPendingAttachment(null)} className="shrink-0 text-blue-400 hover:text-blue-600">
 <X size={12} />
 </button>
 </div>
 )}

 {/* URL input */}
 {c.showUrlInput && (
 <div className="mx-3 mb-1 flex gap-2">
 <input
 autoFocus
 value={c.urlInput}
 onChange={e => c.setUrlInput(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter') c.fetchUrl(); if (e.key === 'Escape') c.setShowUrlInput(false) }}
 placeholder="Paste a URL to read…"
 className="flex-1 text-xs border border-[var(--border)] rounded-[6px] px-3 py-2 focus:outline-none focus:ring-2"
 />
 <button onClick={c.fetchUrl} disabled={!c.urlInput.trim() || c.fetchingUrl}
 className="shrink-0 px-3 py-2 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs rounded-[6px] hover:bg-[var(--ink)] disabled:opacity-40 flex items-center gap-1">
 {c.fetchingUrl ? <Loader2 size={11} className="animate-spin" /> : 'Fetch'}
 </button>
 </div>
 )}

 {/* Input bar */}
 <div className="border-t border-[var(--border)] p-3 shrink-0">
 <input ref={c.fileRef} type="file"
 accept=".txt,.md,.csv,.xlsx,.xls,.pdf,.pptx,.docx,.doc,.mp3,.wav,.m4a,.ogg,.webm,.flac"
 className="hidden"
 onChange={c.handleFileAttach}
 />
 {compact ? (
 /* Compact layout: textarea + send in one row, action icons below */
 <>
 <div className="flex gap-2 items-stretch p-px">
 <textarea
 ref={c.inputRef}
 value={c.input}
 onChange={e => c.setInput(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); c.send() } }}
 placeholder="Ask anything…"
 rows={1}
 className="flex-1 resize-none bg-[var(--surface-2)] border border-[var(--border)] rounded-[6px] px-3 py-2 text-sm text-[var(--text-bright)] focus:outline-none focus:ring-2 placeholder-gray-400 max-h-28 overflow-y-auto"
 style={{ fieldSizing: 'content' } as React.CSSProperties}
 />
 <button onClick={c.send} disabled={(!c.input.trim() && !c.pendingAttachment) || c.loading}
 className="shrink-0 flex items-center justify-center px-2.5 py-2.5 bg-[var(--ink)] text-[var(--ink-contrast)] rounded-[6px] hover:bg-[var(--ink)] transition-colors disabled:opacity-40">
 <Send size={14} />
 </button>
 </div>
 <div className="flex items-center gap-0.5 mt-1.5">
 <button onClick={() => c.fileRef.current?.click()} disabled={c.attachLoading} title="Attach file"
 className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-subtle)] hover:bg-[var(--surface-2)] rounded-[4px] transition-colors disabled:opacity-40">
 {c.attachLoading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
 </button>
 <button onClick={() => c.setShowUrlInput(v => !v)} title="Fetch a web page"
 className={cn('p-1.5 rounded-[4px] transition-colors', c.showUrlInput ? 'bg-[var(--ink)] text-[var(--ink-contrast)]' : 'text-[var(--text-muted)] hover:text-[var(--text-subtle)] hover:bg-[var(--surface-2)]')}>
 <Link2 size={12} />
 </button>
 <div className="relative">
 <button onClick={c.toggleWebAccess}
 title={c.isApiProvider ? 'Online — API providers always require internet' : c.webAccess ? 'Online access on' : 'Online access off'}
 className={cn('p-1.5 rounded-[4px] transition-colors', c.webAccess ? 'text-[var(--green)] hover:bg-green-50' : 'text-[var(--border)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-2)]')}>
 {c.webAccess || c.isApiProvider ? <Globe size={12} /> : <GlobeLock size={12} />}
 </button>
 {c.apiLockNotice && (
 <div className="absolute bottom-full left-0 mb-2 w-52 bg-[var(--ink)] text-[var(--ink-contrast)] text-[11px] rounded-[4px] px-3 py-2 shadow-lg z-50 leading-snug">
 Always on for API providers.
 <div className="absolute bottom-0 left-3 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
 </div>
 )}
 </div>
 <span className="ml-auto text-[10px] text-[var(--border)]">⏎ send</span>
 </div>
 </>
 ) : (
 /* Full layout: icons left of textarea */
 <>
 <div className="flex gap-2 items-end">
 <button
 onClick={() => c.fileRef.current?.click()}
 disabled={c.attachLoading}
 title="Attach file (CSV, Excel, PDF, TXT…)"
 className="shrink-0 p-2 text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] rounded-[10px] transition-colors disabled:opacity-40"
 >
 {c.attachLoading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
 </button>
 <button
 onClick={() => c.setShowUrlInput(v => !v)}
 title="Fetch a web page"
 className={cn('shrink-0 p-2 rounded-[10px] transition-colors', c.showUrlInput ? 'bg-[var(--ink)] text-[var(--ink-contrast)]' : 'text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)]')}
 >
 <Link2 size={14} />
 </button>
 <div className="relative">
 <button
 onClick={c.toggleWebAccess}
 title={c.isApiProvider ? 'Online — API providers always require internet' : c.webAccess ? 'Online access on — click to disable' : 'Online access off — click to enable'}
 className={cn('shrink-0 p-2 rounded-[10px] transition-colors', c.webAccess ? 'text-[var(--green)] hover:bg-green-50' : 'text-[var(--border)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-2)]')}
 >
 {c.webAccess || c.isApiProvider ? <Globe size={14} /> : <GlobeLock size={14} />}
 </button>
 {c.apiLockNotice && (
 <div className="absolute bottom-full right-0 mb-2 w-56 bg-[var(--ink)] text-[var(--ink-contrast)] text-[11px] rounded-[4px] px-3 py-2 shadow-lg z-50 leading-snug">
 Always on for API providers. Enable air-gap mode in Settings to disconnect.
 <div className="absolute bottom-0 right-3 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
 </div>
 )}
 </div>
 <textarea
 ref={c.inputRef}
 value={c.input}
 onChange={e => c.setInput(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); c.send() } }}
 placeholder="Ask anything…"
 rows={1}
 className="flex-1 resize-none border border-[var(--border)] rounded-[6px] px-3 py-2 text-sm text-[var(--text-bright)] focus:outline-none focus:ring-2 placeholder-gray-400 max-h-32 overflow-y-auto"
 style={{ fieldSizing: 'content' } as React.CSSProperties}
 />
 <button onClick={c.send} disabled={(!c.input.trim() && !c.pendingAttachment) || c.loading}
 className="shrink-0 flex items-center justify-center px-2.5 py-2.5 bg-[var(--ink)] text-[var(--ink-contrast)] rounded-[6px] hover:bg-[var(--ink)] transition-colors disabled:opacity-40">
 <Send size={14} />
 </button>
 </div>
 <p className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
 </>
 )}
 </div>
 </>}
 </div>
 )
}
