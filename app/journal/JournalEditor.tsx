'use client'

import { useState, useCallback, useRef } from 'react'
import { Check, Loader2 } from 'lucide-react'

interface Props {
  weekStart: string
  initialContent: string
  compact?: boolean
}

export default function JournalEditor({ weekStart, initialContent, compact }: Props) {
  const [content, setContent] = useState(initialContent)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback(async (value: string) => {
    setStatus('saving')
    try {
      await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, content: value }),
      })
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('idle')
    }
  }, [weekStart])

  const handleChange = (value: string) => {
    setContent(value)
    setStatus('idle')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 800)
  }

  return (
    <div className={compact ? '' : 'bg-white border border-gray-200 rounded-xl overflow-hidden'}>
      <div className="relative">
        <textarea
          value={content}
          onChange={e => handleChange(e.target.value)}
          placeholder={compact ? 'Add notes…' : 'Write your weekly notes here — what happened, what you learned, what to watch next week…'}
          className={`w-full resize-none text-sm text-gray-800 placeholder-gray-400 leading-relaxed focus:outline-none ${
            compact ? 'px-4 py-3 min-h-[120px]' : 'px-4 pt-4 pb-8 min-h-[200px]'
          }`}
        />
        <div className="absolute bottom-2 right-3 flex items-center gap-1 text-xs text-gray-400 pointer-events-none">
          {status === 'saving' && <><Loader2 size={10} className="animate-spin" /> Saving</>}
          {status === 'saved'  && <><Check size={10} className="text-green-500" /> Saved</>}
        </div>
      </div>
    </div>
  )
}
