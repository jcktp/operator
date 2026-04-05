'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useDispatch } from './DispatchContext'
import IdleGuard from './IdleGuard'
import { useState } from 'react'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { setOpen, setPendingMessage } = useDispatch()
  const pathname = usePathname()
  const [autoLockMinutes, setAutoLockMinutes] = useState(0)
  const chirpRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => { chirpRef.current = new Audio('/sounds/chirp.mp3') }, [])
  const playChirp = () => { const a = chirpRef.current; if (!a) return; a.currentTime = 0; a.volume = 0.4; a.play().catch(() => {}) }

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((d: { settings?: Record<string, string> }) => {
        const v = parseInt(d.settings?.auto_lock_minutes ?? '0')
        if (!isNaN(v)) setAutoLockMinutes(v)
      })
      .catch(() => {})
  }, [])

  // Close dispatch when navigating away from overview/report pages
  useEffect(() => {
    if (pathname !== '/' && !pathname.startsWith('/reports/')) {
      setOpen(false)
      setPendingMessage('')
    }
  }, [pathname, setOpen, setPendingMessage])

  if (pathname.startsWith('/request/') || pathname === '/login' || pathname === '/starting') {
    return <>{children}</>
  }

  const isReportPage = /^\/reports\/[^/]+/.test(pathname)
  const isFixedPage = isReportPage || pathname === '/entities' || pathname === '/dashboard' || pathname === '/' || pathname === '/files' || pathname === '/pulse'

  // Fixed-layout pages: full-height, no page scroll — panes scroll internally
  if (isFixedPage) {
    return (
      <>
        <IdleGuard autoLockMinutes={autoLockMinutes} />
        <main className="pt-20 h-screen overflow-hidden px-6 sm:px-8 max-w-[1600px] mx-auto flex flex-col">
          {children}
        </main>
      </>
    )
  }

  return (
    <>
      <IdleGuard autoLockMinutes={autoLockMinutes} />
      <main className="pt-20 pb-8 px-6 sm:px-8 max-w-6xl mx-auto">
        {children}
        <footer className="mt-16 pt-4 border-t border-gray-100 dark:border-zinc-800 flex justify-end">
          <a
            href="https://github.com/jcktp"
            target="_blank"
            rel="noopener noreferrer"
            onClick={playChirp}
            className="flex items-center gap-1.5 text-[10px] text-gray-300 hover:text-gray-500 transition-colors select-none dark:text-zinc-700 dark:hover:text-zinc-500 w-fit"
          >
            <svg width="10" height="14" viewBox="0 0 16 22" fill="none" aria-hidden="true">
              <rect x="6" y="0" width="3" height="5" rx="1.5" fill="currentColor" opacity="0.7" />
              <rect x="1" y="4" width="14" height="17" rx="2.5" fill="currentColor" opacity="0.5" />
              <rect x="4" y="7"   width="8" height="1" rx="0.5" fill="currentColor" opacity="0.9" />
              <rect x="4" y="9.5" width="8" height="1" rx="0.5" fill="currentColor" opacity="0.9" />
              <rect x="4" y="12" width="8" height="1" rx="0.5" fill="currentColor" opacity="0.9" />
              <rect x="3" y="15" width="10" height="4" rx="1.5" fill="currentColor" opacity="0.8" />
            </svg>
            Built with purpose by Jorick.
          </a>
        </footer>
      </main>
    </>
  )
}
