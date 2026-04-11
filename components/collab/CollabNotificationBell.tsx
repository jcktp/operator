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
    // Re-check immediately when collab is enabled mid-session
    window.addEventListener('collab:enabled', fetchUnread)
    return () => {
      clearInterval(timer)
      window.removeEventListener('collab:enabled', fetchUnread)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null

  const isActive = pathname.startsWith('/collab')

  return (
    <Link
      href="/collab"
      className={cn(
        'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors shrink-0',
        isActive
          ? 'font-bold text-white'
          : 'font-normal text-white/55 hover:text-white'
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
