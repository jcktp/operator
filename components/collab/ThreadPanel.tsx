'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import MessageBubble, { type ChatMsg } from './MessageBubble'
import MessageComposer from './MessageComposer'

interface Props {
  projectId: string
  threadId: string
  currentInstanceId: string
  onClose: () => void
  onMessageSent?: () => void
}

export default function ThreadPanel({ projectId, threadId, currentInstanceId, onClose, onMessageSent }: Props) {
  const [root, setRoot] = useState<ChatMsg | null>(null)
  const [replies, setReplies] = useState<ChatMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/collab/chat/${projectId}/thread/${threadId}`)
      if (r.ok) {
        const d = await r.json() as { root: ChatMsg; replies: ChatMsg[] }
        setRoot(d.root)
        setReplies(d.replies)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projectId, threadId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (content: string, references: string) => {
    setSending(true)
    try {
      const r = await fetch(`/api/collab/chat/${projectId}/thread/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, references }),
      })
      if (r.ok) {
        const d = await r.json() as { message: ChatMsg }
        setReplies(prev => [...prev, d.message])
        onMessageSent?.()
      }
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    const r = await fetch(`/api/collab/chat/${projectId}/${id}`, { method: 'DELETE' })
    if (r.ok) {
      const d = await r.json() as { message: ChatMsg }
      setReplies(prev => prev.map(m => m.id === id ? d.message : m))
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
      setReplies(prev => prev.map(m => m.id === id ? d.message : m))
    }
  }

  return (
    <div className="absolute inset-0 bg-[var(--surface)] z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] shrink-0">
        <button
          onClick={onClose}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-body)]"
        >
          <X size={13} />
        </button>
        <span className="text-xs font-semibold text-[var(--text-subtle)]">Thread</span>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-[var(--border-mid)]" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-4 py-3 gap-4">
          {/* Root message */}
          {root && (
            <div className="border-b border-[var(--border)] pb-3">
              <MessageBubble
                message={root}
                currentInstanceId={currentInstanceId}
              />
            </div>
          )}

          {/* Replies */}
          <div className="flex flex-col gap-3">
            {replies.map(r => (
              <MessageBubble
                key={r.id}
                message={r}
                currentInstanceId={currentInstanceId}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="px-4 py-3 border-t border-[var(--border)] shrink-0">
        <MessageComposer
          projectId={projectId}
          onSend={handleSend}
          placeholder="Reply in thread…"
          sending={sending}
        />
      </div>
    </div>
  )
}
