'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import MessageBubble, { type ChatMsg } from './MessageBubble'
import MessageComposer from './MessageComposer'
import ThreadPanel from './ThreadPanel'

interface Props {
  projectId: string
  projectName: string
}

interface IdentityData {
  instanceId: string
  displayName: string
}

const POLL_INTERVAL_MS = 30_000

export default function ChatTab({ projectId, projectName }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [identity, setIdentity] = useState<IdentityData | null>(null)
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const [isShared, setIsShared] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastMsgIdRef = useRef<string | null>(null)

  // Load identity + check if project is shared
  useEffect(() => {
    Promise.all([
      fetch('/api/collab/identity').then(r => r.ok ? r.json() : null),
      fetch(`/api/collab/projects/${projectId}/share`).then(r => r.ok ? r.json() : { shares: [] }),
    ]).then(([idData, shareData]: [IdentityData | null, { shares: unknown[] }]) => {
      setIdentity(idData)
      setIsShared((shareData.shares ?? []).length > 0)
    }).catch(() => {})

    setNotifPermission(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  }, [projectId])

  // Request notification permission after having a peer
  const requestNotifPermission = useCallback(async () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
  }, [])

  const fireNotification = useCallback((msg: ChatMsg) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (msg.authorId === identity?.instanceId) return
    if (document.visibilityState === 'visible') return
    new Notification(`${msg.authorName} in ${projectName}`, {
      body: msg.content.replace(/→\[\w+::[^:]+::([^\]]+)\]/g, '$1').slice(0, 80),
      icon: '/icon.png',
    })
  }, [identity, projectName])

  const loadMessages = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    try {
      const r = await fetch(`/api/collab/chat/${projectId}`)
      if (!r.ok) return
      const d = await r.json() as { messages: ChatMsg[] }
      const incoming = d.messages ?? []

      if (!isInitial && incoming.length > 0) {
        const lastKnown = lastMsgIdRef.current
        const newMsgs = lastKnown
          ? incoming.filter(m => m.id !== lastKnown && new Date(m.createdAt) > new Date(messages[messages.length - 1]?.createdAt ?? 0))
          : []
        for (const msg of newMsgs) fireNotification(msg)
      }

      setMessages(incoming)
      if (incoming.length > 0) lastMsgIdRef.current = incoming[incoming.length - 1].id
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [projectId, messages, fireNotification])

  // Initial load
  useEffect(() => {
    loadMessages(true)
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for new messages
  useEffect(() => {
    const timer = setInterval(() => loadMessages(false), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [loadMessages])

  // Mark as read when tab is visible + scroll to bottom on load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      const last = messages[messages.length - 1]
      fetch('/api/collab/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, lastReadMsgId: last.id }),
      }).catch(() => {})
    }
  }, [loading, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Request notifications once peers are confirmed
  useEffect(() => {
    if (isShared && notifPermission === 'default') {
      requestNotifPermission()
    }
  }, [isShared, notifPermission, requestNotifPermission])

  const handleSend = async (content: string, references: string) => {
    setSending(true)
    try {
      const r = await fetch(`/api/collab/chat/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, references }),
      })
      if (r.ok) {
        const d = await r.json() as { message: ChatMsg }
        setMessages(prev => [...prev, { ...d.message, replyCount: 0 }])
        lastMsgIdRef.current = d.message.id
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        // Mark as read immediately after sending
        fetch('/api/collab/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, lastReadMsgId: d.message.id }),
        }).catch(() => {})
      }
    } finally {
      setSending(false)
    }
  }

  const handleEdit = async (id: string, content: string, references: string) => {
    const r = await fetch(`/api/collab/chat/${projectId}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, references }),
    })
    if (r.ok) {
      const d = await r.json() as { message: ChatMsg }
      setMessages(prev => prev.map(m => m.id === id ? { ...d.message, replyCount: m.replyCount } : m))
    }
  }

  const handleDelete = async (id: string) => {
    const r = await fetch(`/api/collab/chat/${projectId}/${id}`, { method: 'DELETE' })
    if (r.ok) {
      const d = await r.json() as { message: ChatMsg }
      setMessages(prev => prev.map(m => m.id === id ? { ...d.message, replyCount: m.replyCount } : m))
    }
  }

  const handleReplyCount = useCallback(() => {
    // Reload to update reply counts on root messages
    loadMessages(false)
  }, [loadMessages])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-[var(--border-mid)]" />
      </div>
    )
  }

  if (!isShared) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <MessageSquare size={28} className="text-[var(--border-mid)]" />
        <div>
          <p className="text-sm font-medium text-[var(--text-body)]">Chat not available</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Share this project with a peer to enable the chat channel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Thread panel slide-over */}
      {activeThread && identity && (
        <ThreadPanel
          projectId={projectId}
          threadId={activeThread}
          currentInstanceId={identity.instanceId}
          onClose={() => setActiveThread(null)}
          onMessageSent={handleReplyCount}
        />
      )}

      {/* Message list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1 py-2 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <MessageSquare size={22} className="text-[var(--border-mid)]" />
            <p className="text-xs text-[var(--text-muted)]">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentInstanceId={identity?.instanceId ?? ''}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReply={id => setActiveThread(id)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 pt-3 border-t border-[var(--border)]">
        <MessageComposer
          projectId={projectId}
          onSend={handleSend}
          sending={sending}
        />
      </div>
    </div>
  )
}
