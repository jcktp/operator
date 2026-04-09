'use client'

import { useState, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'
import ReferencePicker, { type ReferenceItem } from './ReferencePicker'

interface Props {
  projectId: string
  onSend: (content: string, references: string) => void
  placeholder?: string
  sending?: boolean
  initialContent?: string
  autoFocus?: boolean
}

/** Converts ref to inline token: →[entity::id::label] */
function refToken(item: ReferenceItem): string {
  return `→[${item.type}::${item.id}::${item.label}]`
}

/** Extracts all reference items from content string */
export function extractRefs(content: string): ReferenceItem[] {
  const re = /→\[(\w+)::([^:]+)::([^\]]+)\]/g
  const refs: ReferenceItem[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    refs.push({ type: m[1] as ReferenceItem['type'], id: m[2], label: m[3] })
  }
  return refs
}

export default function MessageComposer({ projectId, onSend, placeholder = 'Message…', sending = false, initialContent = '', autoFocus = false }: Props) {
  const [content, setContent] = useState(initialContent)
  const [showPicker, setShowPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '@') {
      setShowPicker(true)
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape') {
      setShowPicker(false)
    }
  }

  const submit = useCallback(() => {
    const trimmed = content.trim()
    if (!trimmed || sending) return
    const refs = extractRefs(trimmed)
    onSend(trimmed, JSON.stringify(refs))
    setContent('')
  }, [content, sending, onSend])

  const insertReference = (item: ReferenceItem) => {
    const token = refToken(item)
    const el = textareaRef.current
    if (!el) { setContent(c => c + token); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    // Remove the '@' that triggered the picker
    const before = content.slice(0, Math.max(0, start - 1))
    const after = content.slice(end)
    const newContent = before + token + after
    setContent(newContent)
    setTimeout(() => {
      el.setSelectionRange(before.length + token.length, before.length + token.length)
      el.focus()
    }, 0)
  }

  return (
    <div className="relative">
      {showPicker && (
        <ReferencePicker
          projectId={projectId}
          onSelect={insertReference}
          onClose={() => setShowPicker(false)}
        />
      )}
      <div className="flex items-end gap-2 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none min-h-[22px] max-h-32 overflow-y-auto"
          style={{ height: 'auto' }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 128)}px`
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!content.trim() || sending}
          className="shrink-0 p-1.5 rounded-lg bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
        >
          <Send size={12} />
        </button>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 px-1">
        Type <code className="bg-gray-100 dark:bg-zinc-700 rounded px-0.5">@</code> to reference · <code className="bg-gray-100 dark:bg-zinc-700 rounded px-0.5">↵</code> to send · Shift+↵ for newline
      </p>
    </div>
  )
}
