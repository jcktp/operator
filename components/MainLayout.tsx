'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useDispatch } from './DispatchContext'
import IdleGuard from './IdleGuard'
import Breadcrumb from './Breadcrumb'
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
  // Fixed-height pages: full viewport height, no outer scroll, panes scroll internally.
  // /files moved out so the Sources family (/library, /files, /upload) all use the scrolling-page
  // wrapper at the same max-width — fixes the Sources tab width-jump.
  // /stories and /stories/[id] use the fixed-page wrapper to host LayoutA's three-column workspace.
  const isFixedPage =
    isReportPage ||
    pathname === '/' ||
    pathname === '/dashboard' ||
    pathname === '/entities' ||
    pathname === '/journal' ||
    pathname === '/sources' ||
    pathname === '/stories' ||
    pathname.startsWith('/stories/') ||
    pathname === '/tracker' ||
    pathname === '/foia' ||
    pathname === '/projects' ||
    pathname === '/pulse' ||
    pathname === '/settings' ||
    pathname === '/dispatch' ||
    pathname === '/network' ||
    pathname === '/collab' ||
    pathname.startsWith('/collab')

  // Breadcrumb is a fixed-positioned bar (sibling to <main>) so its border spans the full viewport
  // width regardless of <main>'s max-width constraint.
  // Combined offset: nav 56px + breadcrumb 32px = 88px → use pt-22 on main.
  // Fixed-layout pages: full-height, no page scroll — panes scroll internally
  // pt-28 = 56 (nav) + 32 (breadcrumb) + 12 buffer so content isn't glued to the separator
  if (isFixedPage) {
    return (
      <>
        <IdleGuard autoLockMinutes={autoLockMinutes} />
        <Breadcrumb />
        <main className="pt-28 h-screen overflow-hidden px-6 sm:px-8 max-w-[1600px] mx-auto flex flex-col pb-4">
          <div className="flex-1 min-h-0 flex flex-col">
            {children}
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <IdleGuard autoLockMinutes={autoLockMinutes} />
      <Breadcrumb />
      <main className="pt-28 px-6 sm:px-8 max-w-[1600px] mx-auto">
        <div className="max-w-6xl mx-auto pb-16">
          {children}
        </div>
      </main>
    </>
  )
}
