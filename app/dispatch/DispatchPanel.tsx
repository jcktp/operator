'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Trash2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message { role: 'user' | 'assistant'; content: string }

interface Props {
  context: string
  onClose?: () => void
  initialChat?: { id: string; title: string; messages: Message[] }
}

/** Very simple markdown → JSX: **bold**, *italic*, headings, bullets */
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    // Heading
    if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^#+/) ?? [''])[0].length
      const content = renderInline(line.replace(/^#+\s/, ''))
      const Tag = `h${Math.min(level + 2, 6)}` as 'h3' | 'h4' | 'h5' | 'h6'
      elements.push(<Tag key={i} className="font-semibold mt-2 mb-0.5">{content}</Tag>)
      return
    }
    // Bullet
    if (/^[-*]\s/.test(line)) {
      elements.push(
        <div key={i} className="flex gap-1.5 my-0.5">
          <span className="shrink-0 mt-1 w-1 h-1 bg-current rounded-full" />
          <span>{renderInline(line.replace(/^[-*]\s/, ''))}</span>
        </div>
      )
      return
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = (line.match(/^\d+/) ?? ['1'])[0]
      elements.push(
        <div key={i} className="flex gap-1.5 my-0.5">
          <span className="shrink-0 text-xs font-medium">{num}.</span>
          <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
        </div>
      )
      return
    }
    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-1.5" />)
      return
    }
    elements.push(<p key={i} className="my-0.5">{renderInline(line)}</p>)
  })
  return <>{elements}</>
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** and *italic* and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
        if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>
        if (/^`[^`]+`$/.test(part)) return <code key={i} className="bg-black/10 rounded px-0.5 text-[0.85em] font-mono">{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function DispatchPanel({ context, onClose, initialChat }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialChat?.messages ?? [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(initialChat?.id ?? null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Auto-save after messages change
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

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/dispatch/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context }),
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
            <button
              onClick={clearChat}
              title="Clear chat"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
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
              <p className="text-xs text-gray-400 mt-1">Dispatch has context from all your recent reports</p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              {[
                'What are the biggest risks right now?',
                'Which area needs the most attention?',
                'Summarise what changed this week',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus() }}
                  className="text-xs text-left px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 text-gray-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
              m.role === 'user'
                ? 'bg-gray-900 text-white rounded-br-sm whitespace-pre-wrap'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            )}>
              {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
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

      {/* Input */}
      <div className="border-t border-gray-100 p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder="Ask anything…"
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400 max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="shrink-0 p-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
