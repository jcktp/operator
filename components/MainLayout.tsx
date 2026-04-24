'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useDispatch } from './DispatchContext'
import IdleGuard from './IdleGuard'
import { useState } from 'react'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { setOpen, setPendingMessage } = useDispatch()
  const pathname = usePathname()
  const [autoLockMinutes, setAutoLockMinutes] = useState(0)

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
  const isFixedPage = isReportPage || pathname === '/entities' || pathname === '/dashboard' || pathname === '/' || pathname === '/files' || pathname === '/pulse' || pathname === '/settings' || pathname === '/network' || pathname === '/collab' || pathname.startsWith('/collab')

  // Fixed-layout pages: full-height, no page scroll — panes scroll internally
  if (isFixedPage) {
    return (
      <>
        <IdleGuard autoLockMinutes={autoLockMinutes} />
        <main className="pt-20 pb-6 h-screen overflow-hidden px-6 sm:px-8 max-w-[1600px] mx-auto flex flex-col">
          {children}
        </main>
      </>
    )
  }

  return (
    <>
      <IdleGuard autoLockMinutes={autoLockMinutes} />
      <main className="pt-20 px-6 sm:px-8">
        <div className="max-w-6xl mx-auto pb-16">
          {children}
        </div>
      </main>
    </>
  )
}
