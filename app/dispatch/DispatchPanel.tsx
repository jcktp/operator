'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Trash2, MessageSquare, Paperclip, Link2, Loader2, Globe, GlobeLock, Clock, Plus, ChevronRight, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renderMarkdown } from './MarkdownRenderer'
import { extractFileText } from './extractFileText'
import { getPersonasForMode, type PersonaId } from '@/lib/personas'
import { useMode } from '@/components/ModeContext'
import { getSuggestions } from './dispatchSuggestions'
import { useSettings } from '@/lib/use-settings'
import DispatchHistoryView, { type ChatSummary } from './DispatchHistoryView'
import { downloadCode } from './dispatchUtils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  attachmentName?: string
}


interface Props {
  context: string
  currentUrl?: string
  onClose?: () => void
  initialChat?: { id: string; title: string; messages: Message[] }
  initialMessage?: string
}

// ── Component ─────────────────────────────────────────────────────────────

export default function DispatchPanel({ context, currentUrl, onClose, initialChat, initialMessage }: Props) {
  const modeConfig = useMode()
  const { settings, saveSetting } = useSettings()
  const personaMap = getPersonasForMode(modeConfig.id)
  const personaList = Object.values(personaMap)
  const [messages, setMessages] = useState<Message[]>(initialChat?.messages ?? [])
  const [input, setInput] = useState(initialMessage ?? '')
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(initialChat?.id ?? null)
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; content: string } | null>(null)
  const [attachLoading, setAttachLoading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [webAccess, setWebAccess] = useState(true)
  const [persona, setPersona] = useState<PersonaId>('dispatch')
  const [userMemory, setUserMemory] = useState('')
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [history, setHistory] = useState<ChatSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [savedNoteTitle, setSavedNoteTitle] = useState<string | null>(null)
  const savedNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    setWebAccess(settings.ollama_web_access !== 'false')
    setUserName(settings.ceo_name ?? '')
    setUserRole(settings.user_role ?? '')
  }, [settings])

  useEffect(() => {
    fetch('/api/dispatch/memory').then(r => r.json()).then((d: { memory?: string }) => {
      setUserMemory(d.memory ?? '')
    }).catch(() => {})
  }, [])

  const prevUrlRef = useRef<string | undefined>(currentUrl)
  useEffect(() => {
    if (currentUrl && prevUrlRef.current && currentUrl !== prevUrlRef.current) {
      setMessages([])
      setChatId(null)
      setPendingAttachment(null)
    }
    prevUrlRef.current = currentUrl
  }, [currentUrl])

  const toggleWebAccess = async () => {
    const next = !webAccess
    setWebAccess(next)
    await saveSetting('ollama_web_access', next ? 'true' : 'false')
  }

  const autoSave = useCallback(async (msgs: Message[], currentId: string | null) => {
    if (msgs.length === 0) return
    const title = msgs.find(m => m.role === 'user')?.content.slice(0, 60) || 'Untitled chat'
    try {
      if (currentId) {
        await fetch(`/api/dispatch/${currentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgs, title }),
        })
      } else {
        const res = await fetch('/api/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: msgs, title }),
        })
        const data = await res.json()
        if (data.chat?.id) setChatId(data.chat.id)
      }
    } catch {}
  }, [])

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachLoading(true)
    try {
      const content = await extractFileText(file)
      setPendingAttachment({ name: file.name, content })
    } finally {
      setAttachLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const fetchUrl = async () => {
    const url = urlInput.trim()
    if (!url) return
    setFetchingUrl(true)
    try {
      const res = await fetch('/api/dispatch/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.content) {
        setPendingAttachment({ name: url, content: `[Web page: ${url}]\n\n${data.content}` })
        setUrlInput('')
        setShowUrlInput(false)
      } else {
        setUrlInput(data.error ?? 'Could not fetch URL')
      }
    } finally {
      setFetchingUrl(false)
    }
  }

  const send = async () => {
    const text = input.trim()
    if ((!text && !pendingAttachment) || loading) return

    let userContent = text
    let extraContext = context

    if (pendingAttachment) {
      const MAX = 6000
      const snippet = pendingAttachment.content.slice(0, MAX)
      const truncated = pendingAttachment.content.length > MAX ? ' [truncated]' : ''
      extraContext += `\n\nATTACHED FILE: ${pendingAttachment.name}\n\`\`\`\n${snippet}${truncated}\n\`\`\``
      if (!userContent) userContent = `I've attached ${pendingAttachment.name} — please analyse it.`
    }

    const userMsg: Message = {
      role: 'user',
      content: userContent,
      attachmentName: pendingAttachment?.name,
    }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setPendingAttachment(null)
    setLoading(true)

    try {
      const res = await fetch('/api/dispatch/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context: extraContext, persona, userMemory }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        const reply: Message = { role: 'assistant', content: `Error: ${data.error ?? 'Unknown error'}` }
        const withReply = [...next, reply]
        setMessages(withReply)
        await autoSave(withReply, chatId)
        return
      }

      // Stream NDJSON lines from the server (fix #5)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let fullContent = ''
      let savedNote: { title: string; folder: string } | null = null
      let firstChunk = true

      const addOrUpdate = (content: string) => {
        if (firstChunk) {
          firstChunk = false
          setLoading(false) // hide bouncing dots once text arrives
          setMessages(m => [...m, { role: 'assistant' as const, content }])
        } else {
          setMessages(m => {
            const arr = [...m]
            arr[arr.length - 1] = { role: 'assistant', content }
            return arr
          })
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const ev = JSON.parse(line) as { t: string; v?: string; noteSaved?: { title: string; folder: string } | null; error?: string }
            if (ev.t === 'chunk' && ev.v) {
              fullContent += ev.v
              addOrUpdate(fullContent)
            } else if (ev.t === 'done') {
              savedNote = ev.noteSaved ?? null
            } else if (ev.t === 'error') {
              fullContent = `Error: ${ev.error ?? 'Unknown error'}`
              addOrUpdate(fullContent)
            }
          } catch {}
        }
      }

      await autoSave([...next, { role: 'assistant' as const, content: fullContent || 'No response.' }], chatId)

      if (savedNote) {
        setSavedNoteTitle(savedNote.title)
        if (savedNoteTimerRef.current) clearTimeout(savedNoteTimerRef.current)
        savedNoteTimerRef.current = setTimeout(() => setSavedNoteTitle(null), 4000)
      }

      // Refresh memory in case background extraction added new facts
      fetch('/api/dispatch/memory').then(r => r.json()).then((d: { memory?: string }) => {
        setUserMemory(d.memory ?? '')
      }).catch(() => {})
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error — could not reach the AI.' }])
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setChatId(null)
    setPendingAttachment(null)
    setView('chat')
    inputRef.current?.focus()
  }

  const openHistory = async () => {
    setView('history')
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/dispatch')
      const data = await res.json() as { chats?: ChatSummary[] }
      setHistory(data.chats ?? [])
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadChat = (chat: ChatSummary) => {
    const msgs = JSON.parse(chat.messages || '[]') as Message[]
    setMessages(msgs)
    setChatId(chat.id)
    setPendingAttachment(null)
    setView('chat')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/dispatch/${id}`, { method: 'DELETE' }).catch(() => {})
    setHistory(h => h.filter(c => c.id !== id))
    if (chatId === id) { setMessages([]); setChatId(null) }
  }

  const activePersona = personaMap[persona]

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">
            {activePersona.name}
          </span>
          <span className="text-xs text-gray-400">{activePersona.tagline}</span>
        </div>
        <div className="flex items-center gap-1">
          {view === 'history' ? (
            <button onClick={() => setView('chat')} title="Back to chat"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={13} />
            </button>
          ) : (
            <>
              {messages.length > 0 && (
                <button onClick={clearChat} title="New chat"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <Plus size={13} />
                </button>
              )}
              <button onClick={openHistory} title="Chat history"
                className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <Clock size={13} />
              </button>
            </>
          )}
          {onClose && (
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* History view */}
      {view === 'history' && (
        <DispatchHistoryView
          historyLoading={historyLoading}
          history={history}
          userMemory={userMemory}
          setUserMemory={setUserMemory}
          chatId={chatId}
          onNewChat={clearChat}
          onLoadChat={loadChat}
          onDeleteChat={deleteChat}
        />
      )}

      {/* Chat view */}
      {view === 'chat' && <>
      {/* Persona selector — locked once chat starts */}
      <div className="flex gap-1 px-3 pt-2.5 pb-0 shrink-0">
        {personaList.map(p => {
          const locked = messages.length > 0
          const active = persona === p.id
          return (
            <button
              key={p.id}
              onClick={() => !locked && setPersona(p.id)}
              title={locked && !active ? 'Start a new chat to switch persona' : p.description}
              disabled={locked && !active}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                active
                  ? 'bg-gray-900 text-white'
                  : locked
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              )}
            >
              {p.name}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <MessageSquare size={18} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {userName ? `Hi ${userName}` : activePersona.name}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {userRole
                  ? `${activePersona.description} Ready to help you as ${userRole}.`
                  : activePersona.description}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              {getSuggestions(persona, userRole, modeConfig.id).map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                  className="text-xs text-left px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 text-gray-600 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
            {m.attachmentName && (
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5 px-1">
                <Paperclip size={9} />
                <span className="truncate max-w-[180px]">{m.attachmentName}</span>
              </div>
            )}
            <div className={cn(
              'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
              m.role === 'user'
                ? 'bg-gray-900 text-white rounded-br-sm whitespace-pre-wrap'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            )}>
              {m.role === 'assistant'
                ? renderMarkdown(m.content, downloadCode)
                : m.content}
            </div>
          </div>
        ))}

        {loading && messages.at(-1)?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Note saved toast */}
      {savedNoteTitle && (
        <div className="mx-3 mb-1 flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs text-gray-700">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          <BookOpen size={11} className="text-gray-400 shrink-0" />
          <span>Saved to {modeConfig.navJournal}:</span>
          <span className="font-medium truncate">{savedNoteTitle}</span>
        </div>
      )}

      {/* Attachment preview */}
      {pendingAttachment && (
        <div className="mx-3 mb-1 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
          <Paperclip size={12} className="text-blue-500 shrink-0" />
          <span className="text-xs text-blue-700 truncate flex-1">{pendingAttachment.name}</span>
          <button onClick={() => setPendingAttachment(null)} className="shrink-0 text-blue-400 hover:text-blue-600">
            <X size={12} />
          </button>
        </div>
      )}

      {/* URL input */}
      {showUrlInput && (
        <div className="mx-3 mb-1 flex gap-2">
          <input
            autoFocus
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') fetchUrl(); if (e.key === 'Escape') setShowUrlInput(false) }}
            placeholder="Paste a URL to read…"
            className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button onClick={fetchUrl} disabled={!urlInput.trim() || fetchingUrl}
            className="shrink-0 px-3 py-2 bg-gray-900 text-white text-xs rounded-xl hover:bg-gray-800 disabled:opacity-40 flex items-center gap-1">
            {fetchingUrl ? <Loader2 size={11} className="animate-spin" /> : 'Fetch'}
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-100 p-3 shrink-0">
        <div className="flex gap-2 items-end">
          {/* Attach file */}
          <input ref={fileRef} type="file"
            accept=".txt,.md,.csv,.xlsx,.xls,.pdf,.pptx,.docx,.doc"
            className="hidden"
            onChange={handleFileAttach}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={attachLoading}
            title="Attach file (CSV, Excel, PDF, TXT…)"
            className="shrink-0 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-40"
          >
            {attachLoading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          </button>
          {/* Fetch URL */}
          <button
            onClick={() => setShowUrlInput(v => !v)}
            title="Fetch a web page"
            className={cn('shrink-0 p-2 rounded-xl transition-colors', showUrlInput ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100')}
          >
            <Link2 size={14} />
          </button>
          {/* Online access toggle */}
          <button
            onClick={toggleWebAccess}
            title={webAccess ? 'Online access on — click to disable' : 'Online access off — click to enable'}
            className={cn('shrink-0 p-2 rounded-xl transition-colors', webAccess ? 'text-green-600 hover:bg-green-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100')}
          >
            {webAccess ? <Globe size={14} /> : <GlobeLock size={14} />}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask anything…"
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400 max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button onClick={send} disabled={(!input.trim() && !pendingAttachment) || loading}
            className="shrink-0 p-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40">
            <Send size={14} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
      </>}
    </div>
  )
}
