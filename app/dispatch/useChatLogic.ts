'use client'

import { useState, useRef, useCallback } from 'react'
import { getPersonasForMode, type PersonaId } from '@/lib/personas'
import { useSettings } from '@/lib/use-settings'
import { extractFileText } from './extractFileText'
import type { ChatSummary } from './DispatchHistoryView'

interface Message {
  role: 'user' | 'assistant'
  content: string
  attachmentName?: string
}

interface Props {
  context: string
  modeId: string
  initialChat?: { id: string; title: string; messages: Message[] }
  initialMessage?: string
}

export function useChatLogic({ context, modeId, initialChat, initialMessage }: Props) {
  const { settings, saveSetting } = useSettings()
  const personaMap = getPersonasForMode(modeId)

  const [messages, setMessages] = useState<Message[]>(initialChat?.messages ?? [])
  const [input, setInput] = useState(initialMessage ?? '')
  const [loading, setLoading] = useState(false)
  const [chatId, setChatId] = useState<string | null>(initialChat?.id ?? null)
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; content: string } | null>(null)
  const [attachLoading, setAttachLoading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [webAccess, setWebAccess] = useState(false)
  const [persona, setPersona] = useState<PersonaId>('dispatch')
  const [userMemory, setUserMemory] = useState('')
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [history, setHistory] = useState<ChatSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [savedNoteTitle, setSavedNoteTitle] = useState<string | null>(null)
  const [searching, setSearching] = useState<string | null>(null)

  const savedNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const prevUrlRef = useRef<string | undefined>(undefined)

  const refreshMemory = () => {
    fetch('/api/dispatch/memory').then(r => r.json()).then((d: { memory?: string }) => {
      setUserMemory(d.memory ?? '')
    }).catch(() => {})
  }

  const syncSettings = () => {
    setWebAccess(settings.ollama_web_access === 'true')
    setUserName(settings.ceo_name ?? '')
    setUserRole(settings.user_role ?? '')
  }

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

    const userMsg: Message = { role: 'user', content: userContent, attachmentName: pendingAttachment?.name }
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

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let fullContent = ''
      let savedNote: { title: string; folder: string } | null = null
      let firstChunk = true

      const addOrUpdate = (content: string) => {
        if (firstChunk) {
          firstChunk = false
          setLoading(false)
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
            const ev = JSON.parse(line) as { t: string; v?: string; name?: string; query?: string; noteSaved?: { title: string; folder: string } | null; error?: string }
            if (ev.t === 'chunk' && ev.v) { setSearching(null); fullContent += ev.v; addOrUpdate(fullContent) }
            else if (ev.t === 'tool' && ev.name === 'search_web') { setSearching(ev.query ?? 'the web') }
            else if (ev.t === 'done') { setSearching(null); savedNote = ev.noteSaved ?? null }
            else if (ev.t === 'error') { setSearching(null); fullContent = `Error: ${ev.error ?? 'Unknown error'}`; addOrUpdate(fullContent) }
          } catch {}
        }
      }

      // If the stream ended with no content (e.g. tool call completed but model
      // emitted no follow-up text), add a visible placeholder so loading clears.
      if (firstChunk) {
        const fallbackContent = fullContent || 'No response.'
        setLoading(false)
        setMessages(m => [...m, { role: 'assistant' as const, content: fallbackContent }])
        fullContent = fallbackContent
      }

      await autoSave([...next, { role: 'assistant' as const, content: fullContent }], chatId)

      if (savedNote) {
        setSavedNoteTitle(savedNote.title)
        if (savedNoteTimerRef.current) clearTimeout(savedNoteTimerRef.current)
        savedNoteTimerRef.current = setTimeout(() => setSavedNoteTitle(null), 4000)
      }

      refreshMemory()
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error — could not reach the AI.' }])
    } finally {
      setLoading(false)
      setSearching(null)
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

  return {
    // State
    messages, input, setInput, loading,
    pendingAttachment, setPendingAttachment,
    attachLoading, urlInput, setUrlInput, fetchingUrl,
    showUrlInput, setShowUrlInput,
    webAccess, persona, setPersona, userMemory, setUserMemory,
    view, setView, history, historyLoading,
    userName, userRole, savedNoteTitle, searching,
    // Refs
    bottomRef, inputRef, fileRef, prevUrlRef,
    // Actions
    toggleWebAccess, autoSave, handleFileAttach,
    fetchUrl, send, clearChat, openHistory, loadChat, deleteChat,
    syncSettings, refreshMemory,
    // Derived
    personaMap,
  }
}
