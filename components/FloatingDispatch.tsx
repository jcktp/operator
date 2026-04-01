'use client'

import { useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { useDispatch } from './DispatchContext'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const DispatchPanel = dynamic(() => import('@/app/dispatch/DispatchPanel'), { ssr: false })

const ALLOWED_PATHS = ['/', '/dashboard']

export default function FloatingDispatch() {
  const { open, setOpen, aiContext, pendingMessage, setPendingMessage } = useDispatch()
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
        setPendingMessage('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, setOpen, setPendingMessage])

  if (!ALLOWED_PATHS.includes(pathname)) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-6 z-40 flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-md hover:shadow-lg text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-all"
        title="Open Dispatch"
      >
        <MessageSquare size={14} className="shrink-0" />
        <span>Ask Dispatch…</span>
      </button>
    )
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed bottom-4 right-6 z-40',
        'w-[480px] max-w-[calc(100vw-2rem)] h-[520px]',
        'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-xl overflow-hidden'
      )}
    >
      <DispatchPanel
        context={aiContext}
        onClose={() => { setOpen(false); setPendingMessage('') }}
        initialMessage={pendingMessage || undefined}
      />
    </div>
  )
}
