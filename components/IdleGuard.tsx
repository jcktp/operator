'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  autoLockMinutes: number // 0 = disabled
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

export default function IdleGuard({ autoLockMinutes }: Props) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!autoLockMinutes || autoLockMinutes <= 0) return

    const ms = autoLockMinutes * 60 * 1000

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        // Invalidate session and redirect to login
        try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
        router.push('/login?reason=idle')
      }, ms)
    }

    reset()
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [autoLockMinutes, router])

  return null
}
