'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Trash2, MessageSquare, Paperclip, Link2, Loader2, Globe, GlobeLock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { renderMarkdown } from './MarkdownRenderer'
import { extractFileText } from './extractFileText'

interface Message {
  role: 'user' | 'assistant'
  content: string
  attachmentName?: string
}

interface Props {
  context: string
  onClose?: () => void
  initialChat?: { id: string; title: string; messages: Message[] }
  initialMessage?: string
}

// ── Component ─────────────────────────────────────────────────────────────

export default function DispatchPanel({ context, onClose, initialChat, initialMessage }: Props) {
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((d: { settings?: Record<string, string> }) => {
      setWebAccess(d.settings?.ollama_web_access !== 'false')
    }).catch(() => {})
  }, [])

  const toggleWebAccess = async () => {
    const next = !webAccess
    setWebAccess(next)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'ollama_web_access', value: next ? 'true' : 'false' }),
    }).catch(() => {})
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

  const downloadCode = (code: string, lang: string) => {
    const ext: Record<string, string> = {
      python: 'py', javascript: 'js', typescript: 'ts', jsx: 'jsx', tsx: 'tsx',
      css: 'css', html: 'html', sql: 'sql', json: 'json', csv: 'csv',
      markdown: 'md', md: 'md', bash: 'sh', shell: 'sh', txt: 'txt',
    }
    const extension = ext[lang.toLowerCase()] ?? lang ?? 'txt'
    const mime = extension === 'csv' ? 'text/csv' : extension === 'json' ? 'application/json' : 'text/plain'
    const blob = new Blob([code], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dispatch-output.${extension}`
    a.click()
    URL.revokeObjectURL(url)
  }

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
        body: JSON.stringify({ messages: next, context: extraContext }),
      })
      const data = await res.json()
      const reply: Message = {
        role: 'assistant',
        content: data.content ?? `Error: ${data.error ?? 'Unknown error'}`,
      }
      const withReply = [...next, reply]
      setMessages(withReply)
      await autoSave(withReply, chatId)
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
    inputRef.current?.focus()
  }

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">
            {chatId ? 'Dispatch' : 'New chat'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={clearChat} title="Clear chat"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-8">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <MessageSquare size={18} className="text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Ask about your business</p>
              <p className="text-xs text-gray-400 mt-1">Attach files, paste URLs, or just ask</p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              {[
                'What are the biggest risks right now?',
                'Which area needs the most attention?',
                'Summarise what changed this week',
              ].map(s => (
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

        {loading && (
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
    </div>
  )
}
