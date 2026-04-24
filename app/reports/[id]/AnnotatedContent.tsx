'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Highlighter, Trash2, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Annotation {
  id: string
  startOffset: number
  endOffset: number
  text: string
  note: string | null
  color: string
  createdAt: string
}

const COLORS = [
  { name: 'yellow', bg: 'rgba(250, 204, 21, 0.3)', border: 'rgb(250, 204, 21)' },
  { name: 'green', bg: 'rgba(74, 222, 128, 0.3)', border: 'rgb(74, 222, 128)' },
  { name: 'blue', bg: 'rgba(96, 165, 250, 0.3)', border: 'rgb(96, 165, 250)' },
  { name: 'pink', bg: 'rgba(244, 114, 182, 0.3)', border: 'rgb(244, 114, 182)' },
]

function getColorStyle(name: string) {
  return COLORS.find(c => c.name === name) ?? COLORS[0]
}

export default function AnnotatedContent({
  content,
  reportId,
}: {
  content: string
  reportId: string
}) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null)
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null)
  const [activeNote, setActiveNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchAnnotations = useCallback(async () => {
    const res = await fetch(`/api/annotations?reportId=${reportId}`)
    const data = await res.json() as { annotations: Annotation[] }
    setAnnotations(data.annotations)
  }, [reportId])

  useEffect(() => { fetchAnnotations() }, [fetchAnnotations])

  const handleMouseUp = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !containerRef.current) {
      setSelection(null)
      setToolbarPos(null)
      return
    }

    const range = sel.getRangeAt(0)
    if (!containerRef.current.contains(range.commonAncestorContainer)) return

    // Calculate character offset within the plain text content
    const textContent = containerRef.current.textContent ?? ''
    const preRange = document.createRange()
    preRange.setStart(containerRef.current, 0)
    preRange.setEnd(range.startContainer, range.startOffset)
    const startOffset = preRange.toString().length
    const selectedText = sel.toString()
    const endOffset = startOffset + selectedText.length

    if (selectedText.trim().length < 2) return

    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    setSelection({ start: startOffset, end: endOffset, text: selectedText })
    setToolbarPos({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
    })
  }

  const createAnnotation = async (color: string) => {
    if (!selection) return
    await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportId,
        startOffset: selection.start,
        endOffset: selection.end,
        text: selection.text,
        color,
      }),
    })
    setSelection(null)
    setToolbarPos(null)
    window.getSelection()?.removeAllRanges()
    fetchAnnotations()
  }

  const deleteAnnotation = async (id: string) => {
    await fetch(`/api/annotations/${id}`, { method: 'DELETE' })
    setActiveNote(null)
    fetchAnnotations()
  }

  const saveNote = async (id: string) => {
    await fetch(`/api/annotations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText }),
    })
    fetchAnnotations()
  }

  // Render text with highlight spans
  const renderAnnotatedText = () => {
    if (annotations.length === 0) return content

    // Sort annotations by start offset
    const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset)
    const parts: React.ReactNode[] = []
    let cursor = 0

    for (const ann of sorted) {
      // Skip overlapping annotations (start is behind current cursor)
      if (ann.startOffset < cursor) continue
      if (ann.startOffset > cursor) {
        parts.push(<span key={`t-${cursor}`}>{content.slice(cursor, ann.startOffset)}</span>)
      }
      const colorStyle = getColorStyle(ann.color)
      parts.push(
        <mark
          key={ann.id}
          onClick={() => { setActiveNote(ann.id); setNoteText(ann.note ?? '') }}
          className="cursor-pointer rounded-sm px-0.5 transition-all hover:brightness-90"
          style={{ backgroundColor: colorStyle.bg, borderBottom: `2px solid ${colorStyle.border}` }}
          title={ann.note ?? 'Click to add note'}
        >
          {content.slice(ann.startOffset, ann.endOffset)}
        </mark>
      )
      cursor = ann.endOffset
    }
    if (cursor < content.length) {
      parts.push(<span key={`t-${cursor}`}>{content.slice(cursor)}</span>)
    }
    return parts
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="text-sm text-[var(--text-body)] leading-relaxed whitespace-pre-wrap"
      >
        {renderAnnotatedText()}
      </div>

      {/* Selection toolbar */}
      {toolbarPos && selection && (
        <div
          className="absolute z-20 flex items-center gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-[6px] shadow-lg px-2 py-1.5"
          style={{ left: toolbarPos.x, top: toolbarPos.y, transform: 'translate(-50%, -100%)' }}
        >
          <Highlighter size={12} className="text-[var(--text-muted)] mr-1" />
          {COLORS.map(c => (
            <button
              key={c.name}
              onClick={() => createAnnotation(c.name)}
              className="w-5 h-5 rounded-full border-2 border-transparent hover:border-[var(--border-mid)] transition-colors"
              style={{ backgroundColor: c.border }}
              title={`Highlight ${c.name}`}
            />
          ))}
        </div>
      )}

      {/* Annotation sidebar panel */}
      {annotations.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <h3 className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em] mb-3">
            Highlights ({annotations.length})
          </h3>
          <div className="space-y-2">
            {annotations.map(ann => {
              const colorStyle = getColorStyle(ann.color)
              const isActive = activeNote === ann.id
              return (
                <div
                  key={ann.id}
                  className={cn(
                    'border rounded-[6px] p-3 text-xs transition-colors',
                    isActive ? 'border-[var(--border-mid)] bg-[var(--surface-2)]' : 'border-[var(--border)] bg-[var(--surface)]'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: colorStyle.border }} />
                    <p className="flex-1 text-[var(--text-body)] line-clamp-2">&ldquo;{ann.text}&rdquo;</p>
                    <button
                      onClick={() => deleteAnnotation(ann.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--red)] transition-colors shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {isActive ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Add a note…"
                        className="flex-1 text-xs border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-[var(--text-body)] focus:outline-none focus:ring-1 focus:ring-[var(--ink)]"
                        onKeyDown={e => { if (e.key === 'Enter') { saveNote(ann.id); setActiveNote(null) } }}
                      />
                      <button
                        onClick={() => { saveNote(ann.id); setActiveNote(null) }}
                        className="text-[10px] text-[var(--blue)] font-medium hover:underline"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setActiveNote(null)}
                        className="text-[var(--text-muted)]"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : ann.note ? (
                    <p
                      className="mt-1 text-[var(--text-subtle)] ml-4 cursor-pointer hover:text-[var(--text-body)]"
                      onClick={() => { setActiveNote(ann.id); setNoteText(ann.note ?? '') }}
                    >
                      {ann.note}
                    </p>
                  ) : (
                    <button
                      onClick={() => { setActiveNote(ann.id); setNoteText('') }}
                      className="mt-1 ml-4 text-[var(--text-muted)] hover:text-[var(--text-subtle)] flex items-center gap-1"
                    >
                      <MessageSquare size={10} />
                      Add note
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
