'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users } from 'lucide-react'
import UnreadBadge from './UnreadBadge'
import { cn } from '@/lib/utils'

const POLL_MS = 60_000

export default function CollabNotificationBell() {
  const [total, setTotal] = useState(0)
  const [enabled, setEnabled] = useState(false)
  const pathname = usePathname()

  const fetchUnread = async () => {
    try {
      const r = await fetch('/api/collab/notifications/unread')
      if (!r.ok) return   // 404 = collab disabled
      setEnabled(true)
      const d = await r.json() as { total: number }
      setTotal(d.total ?? 0)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchUnread()
    const timer = setInterval(fetchUnread, POLL_MS)
    return () => clearInterval(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null

  const isActive = pathname.startsWith('/collab')

  return (
    <Link
      href="/collab"
      className={cn(
        'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0',
        isActive
          ? 'bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-50'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
      )}
      title="Collaboration"
    >
      <Users size={13} />
      Collab
      {total > 0 && (
        <UnreadBadge count={total} className="absolute -top-0.5 -right-0.5" />
      )}
    </Link>
  )
}
