'use client'

import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, MessageSquare } from 'lucide-react'
import ReferenceChip from './ReferenceChip'
import MessageComposer from './MessageComposer'
import type { ReferenceItem } from './ReferencePicker'

export interface ChatMsg {
  id: string
  projectId: string
  threadId: string | null
  content: string
  authorId: string
  authorName: string
  references: string | null
  editedAt: string | null
  deletedAt: string | null
  syncClock: number
  createdAt: string
  replyCount?: number
}

interface Props {
  message: ChatMsg
  currentInstanceId: string
  onEdit?: (id: string, content: string, references: string) => void
  onDelete?: (id: string) => void
  onReply?: (id: string) => void
  unread?: boolean
}

const REF_RE = /→\[(\w+)::([^:]+)::([^\]]+)\]/g

function renderContent(content: string, refs: ReferenceItem[], projectId: string) {
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  const re = new RegExp(REF_RE.source, 'g')
  let match: RegExpExecArray | null
  let key = 0

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<InlineText key={key++} text={content.slice(lastIdx, match.index)} />)
    }
    const refType = match[1] as ReferenceItem['type']
    const refId = match[2]
    const label = match[3]
    parts.push(
      <ReferenceChip
        key={key++}
        refType={refType}
        refId={refId}
        label={label}
        projectId={projectId}
      />
    )
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < content.length) {
    parts.push(<InlineText key={key++} text={content.slice(lastIdx)} />)
  }
  return parts
}

/** Renders plain text with `inline code` support */
function InlineText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const segments = text.split(/(`[^`]+`)/)
  segments.forEach((seg, i) => {
    if (seg.startsWith('`') && seg.endsWith('`')) {
      parts.push(
        <code key={i} className="px-1 py-0.5 bg-[var(--surface-2)] rounded text-[11px] font-mono">
          {seg.slice(1, -1)}
        </code>
      )
    } else {
      parts.push(<span key={i}>{seg}</span>)
    }
  })
  return <>{parts}</>
}

export default function MessageBubble({ message, currentInstanceId, onEdit, onDelete, onReply, unread }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const isOwn = message.authorId === currentInstanceId
  const isDeleted = !!message.deletedAt

  const refs: ReferenceItem[] = (() => {
    try { return message.references ? JSON.parse(message.references) as ReferenceItem[] : [] }
    catch { return [] }
  })()

  const time = new Date(message.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const handleEditSend = (content: string, references: string) => {
    onEdit?.(message.id, content, references)
    setEditing(false)
  }

  return (
    <div className={`group flex flex-col gap-1 ${unread ? 'bg-[var(--blue-dim)] -mx-3 px-3 py-1 rounded-[4px]' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--text-subtle)]">{message.authorName}</span>
        <span className="text-[10px] text-[var(--text-muted)]">{time}</span>
        {message.editedAt && (
          <span className="text-[10px] text-[var(--text-muted)] italic">edited</span>
        )}
        {!isDeleted && isOwn && (
          <div className="relative ml-auto opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Message options"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-body)]"
            >
              <MoreHorizontal size={12} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-28 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-lg py-1 z-20">
                <button
                  type="button"
                  onClick={() => { setEditing(true); setMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-[var(--text-body)] hover:bg-[var(--surface-2)]"
                >
                  <Pencil size={11} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => { onDelete?.(message.id); setMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-500 hover:bg-[var(--red-dim)]"
                >
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isDeleted ? (
        <p className="text-xs text-[var(--text-muted)] italic">This message was deleted.</p>
      ) : editing ? (
        <MessageComposer
          projectId={message.projectId}
          onSend={handleEditSend}
          placeholder="Edit message…"
          autoFocus
          initialContent={message.content}
        />
      ) : (
        <div className="text-sm text-[var(--text-subtle)] leading-relaxed break-words">
          {renderContent(message.content, refs, message.projectId)}
        </div>
      )}

      {/* Reply bar */}
      {!isDeleted && !editing && (
        <div className="flex items-center gap-3 mt-0.5">
          {(message.replyCount ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => onReply?.(message.id)}
              className="flex items-center gap-1 text-[11px] font-medium text-[var(--blue)] hover:opacity-80 transition-colors"
            >
              <MessageSquare size={10} />
              {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onReply?.(message.id)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-body)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Reply
          </button>
        </div>
      )}
    </div>
  )
}
