'use client'

import { useEffect, useState } from 'react'
import { X, Send, MessageSquare, Paperclip, Link2, Loader2, Globe, GlobeLock, Clock, Plus, BookOpen, BookmarkPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renderMarkdown } from './MarkdownRenderer'
import { useMode } from '@/components/ModeContext'
import { getSuggestions } from './dispatchSuggestions'
import DispatchHistoryView, { type ChatSummary } from './DispatchHistoryView'
import { downloadCode } from './dispatchUtils'
import { useChatLogic } from './useChatLogic'

interface Props {
  context: string
  currentUrl?: string
  onClose?: () => void
  initialChat?: { id: string; title: string; messages: Array<{ role: 'user' | 'assistant'; content: string; attachmentName?: string }> }
  initialMessage?: string
  fullPage?: boolean
  currentProjectId?: string | null
  currentProjectName?: string | null
}

export default function DispatchPanel({ context, currentUrl, onClose, initialChat, initialMessage, fullPage, currentProjectId, currentProjectName }: Props) {
  const modeConfig = useMode()
  const c = useChatLogic({ context, modeId: modeConfig.id, initialChat, initialMessage })
  const personaList = Object.values(c.personaMap)
  const activePersona = c.personaMap[c.persona]
  const [savedNoteIdx, setSavedNoteIdx] = useState<number | null>(null)

  const saveMessageAsNote = async (content: string, idx: number) => {
    // Convert markdown-ish content to simple HTML paragraphs
    const html = content
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('')
    const title = content.replace(/[#*`_]/g, '').slice(0, 60).trim() || 'Note from Dispatch'
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
    <div className={cn('h-full flex flex-col bg-white dark:bg-zinc-900 overflow-hidden', !fullPage && 'border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-sm')}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-gray-400 dark:text-zinc-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50">{activePersona.name}</span>
          <span className="text-xs text-gray-400 dark:text-zinc-500">{activePersona.tagline}</span>
        </div>
        <div className="flex items-center gap-1">
          {c.view === 'history' ? (
            <button onClick={() => c.setView('chat')} title="Back to chat"
              className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
              <X size={13} />
            </button>
          ) : (
            <>
              {c.messages.length > 0 && (
                <button onClick={c.clearChat} title="New chat"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                  <Plus size={13} /> New chat
                </button>
              )}
              <button onClick={c.openHistory} title="Chat history"
                className="p-1.5 rounded-lg transition-colors text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800">
                <Clock size={13} />
              </button>
            </>
          )}
          {onClose && (
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
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
        {/* Persona selector */}
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
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  active
                    ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : locked
                      ? 'text-gray-300 dark:text-zinc-600 cursor-not-allowed'
                      : 'text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800'
                )}
              >
                {p.name}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {c.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
              <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                <MessageSquare size={18} className="text-gray-400 dark:text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">
                  {c.userName ? `Hi ${c.userName}` : activePersona.name}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  {c.userRole
                    ? `${activePersona.description} Ready to help you as ${c.userRole}.`
                    : activePersona.description}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full mt-2">
                {getSuggestions(c.persona, c.userRole, modeConfig.id).map(suggestion => (
                  <button key={suggestion} onClick={() => { c.setInput(suggestion); c.inputRef.current?.focus() }}
                    className="text-xs text-left px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:border-gray-300 dark:hover:border-zinc-600 text-gray-600 dark:text-zinc-300 transition-colors">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {c.messages.map((m, i) => (
            <div key={`${m.role}-${i}-${m.content.slice(0, 20)}`} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
              {m.attachmentName && (
                <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500 mb-0.5 px-1">
                  <Paperclip size={9} />
                  <span className="truncate max-w-[180px]">{m.attachmentName}</span>
                </div>
              )}
              <div className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-br-sm whitespace-pre-wrap'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 rounded-bl-sm'
              )}>
                {m.role === 'assistant' ? renderMarkdown(m.content, downloadCode) : m.content}
              </div>
              {m.role === 'assistant' && !c.loading && (
                <div className="mt-1 flex items-center gap-1">
                  {savedNoteIdx === i ? (
                    <span className="text-[10px] text-green-500 px-1">
                      Saved to {currentProjectName ?? modeConfig.navJournal}
                    </span>
                  ) : (
                    <button
                      onClick={() => saveMessageAsNote(m.content, i)}
                      title={`Save to ${currentProjectName ? `${currentProjectName} folder` : modeConfig.navJournal}`}
                      className="flex items-center gap-1 text-[10px] text-gray-300 dark:text-zinc-600 hover:text-gray-500 dark:hover:text-zinc-400 transition-colors px-1 py-0.5 rounded"
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
              <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Globe size={12} className="text-green-500 animate-pulse shrink-0" />
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  Searching the web for: <span className="font-medium text-gray-700 dark:text-zinc-200 truncate max-w-[200px] inline-block align-bottom">{c.searching}</span>
                </span>
              </div>
            </div>
          )}

          {c.loading && !c.searching && c.messages.at(-1)?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-500 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={c.bottomRef} />
        </div>

        {/* Note saved toast */}
        {c.savedNoteTitle && (
          <div className="mx-3 mb-1 flex items-center gap-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-sm px-3 py-2 text-xs text-gray-700 dark:text-zinc-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            <BookOpen size={11} className="text-gray-400 dark:text-zinc-500 shrink-0" />
            <span>Saved to {modeConfig.navJournal}:</span>
            <span className="font-medium truncate">{c.savedNoteTitle}</span>
          </div>
        )}

        {/* Attachment preview */}
        {c.pendingAttachment && (
          <div className="mx-3 mb-1 flex items-center gap-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2">
            <Paperclip size={12} className="text-blue-500 shrink-0" />
            <span className="text-xs text-blue-700 dark:text-blue-300 truncate flex-1">{c.pendingAttachment.name}</span>
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
              className="flex-1 text-xs border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            <button onClick={c.fetchUrl} disabled={!c.urlInput.trim() || c.fetchingUrl}
              className="shrink-0 px-3 py-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-200 disabled:opacity-40 flex items-center gap-1">
              {c.fetchingUrl ? <Loader2 size={11} className="animate-spin" /> : 'Fetch'}
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-gray-100 dark:border-zinc-800 p-3 shrink-0">
          <div className="flex gap-2 items-end">
            <input ref={c.fileRef} type="file"
              accept=".txt,.md,.csv,.xlsx,.xls,.pdf,.pptx,.docx,.doc"
              className="hidden"
              onChange={c.handleFileAttach}
            />
            <button
              onClick={() => c.fileRef.current?.click()}
              disabled={c.attachLoading}
              title="Attach file (CSV, Excel, PDF, TXT…)"
              className="shrink-0 p-2 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-40"
            >
              {c.attachLoading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
            </button>
            <button
              onClick={() => c.setShowUrlInput(v => !v)}
              title="Fetch a web page"
              className={cn('shrink-0 p-2 rounded-xl transition-colors', c.showUrlInput ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800')}
            >
              <Link2 size={14} />
            </button>
            <div className="relative">
              <button
                onClick={c.toggleWebAccess}
                title={c.isApiProvider ? 'Online — API providers always require internet' : c.webAccess ? 'Online access on — click to disable' : 'Online access off — click to enable'}
                className={cn('shrink-0 p-2 rounded-xl transition-colors', c.webAccess ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950' : 'text-gray-300 dark:text-zinc-600 hover:text-gray-500 dark:hover:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800')}
              >
                {c.webAccess || c.isApiProvider ? <Globe size={14} /> : <GlobeLock size={14} />}
              </button>
              {c.apiLockNotice && (
                <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] rounded-lg px-3 py-2 shadow-lg z-50 leading-snug">
                  Always on for API providers. Enable air-gap mode in Settings to disconnect.
                  <div className="absolute bottom-0 right-3 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900 dark:border-t-zinc-100" />
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
              className="flex-1 resize-none border border-gray-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 placeholder-gray-400 dark:placeholder-zinc-500 max-h-32 overflow-y-auto dark:bg-zinc-800"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
            <button onClick={c.send} disabled={(!c.input.trim() && !c.pendingAttachment) || c.loading}
              className="shrink-0 p-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40">
              <Send size={14} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
        </div>
      </>}
    </div>
  )
}
