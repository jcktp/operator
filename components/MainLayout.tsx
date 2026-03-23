'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useDispatch } from './DispatchContext'
import DispatchPanel from '@/app/dispatch/DispatchPanel'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { open, setOpen, aiContext, pendingMessage, setPendingMessage } = useDispatch()
  const pathname = usePathname()

  if (pathname.startsWith('/request/') || pathname === '/login' || pathname === '/starting') {
    return <>{children}</>
  }

  // Close the side dispatch panel when navigating away from overview/report pages
  useEffect(() => {
    if (open && pathname !== '/' && !pathname.startsWith('/reports/')) {
      setOpen(false)
      setPendingMessage('')
    }
  }, [pathname, open, setOpen, setPendingMessage])

  if (open) {
    return (
      <div className="flex pt-14 min-h-screen">
        <main className="flex-1 min-w-0 py-8 px-4 sm:px-6">
          {children}
        </main>
        <aside className="w-1/4 shrink-0 sticky top-14 h-[calc(100vh-56px)] py-4 pr-4 border-l border-gray-200">
          <DispatchPanel
            context={aiContext}
            onClose={() => { setOpen(false); setPendingMessage('') }}
            initialMessage={pendingMessage || undefined}
          />
        </aside>
      </div>
    )
  }

  return (
    <>
      <main className="pt-20 pb-12 max-w-5xl mx-auto px-4 sm:px-6">
        {children}
      </main>
      <a
        href="https://github.com/jcktp"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 flex items-center gap-1.5 text-[10px] text-gray-300 hover:text-gray-500 transition-colors select-none"
      >
        <svg width="10" height="14" viewBox="0 0 16 22" fill="none" aria-hidden="true">
          {/* Antenna */}
          <rect x="6" y="0" width="3" height="5" rx="1.5" fill="currentColor" opacity="0.7" />
          {/* Body */}
          <rect x="1" y="4" width="14" height="17" rx="2.5" fill="currentColor" opacity="0.5" />
          {/* Speaker grille lines */}
          <rect x="4" y="7"   width="8" height="1" rx="0.5" fill="currentColor" opacity="0.9" />
          <rect x="4" y="9.5" width="8" height="1" rx="0.5" fill="currentColor" opacity="0.9" />
          <rect x="4" y="12" width="8" height="1" rx="0.5" fill="currentColor" opacity="0.9" />
          {/* PTT button */}
          <rect x="3" y="15" width="10" height="4" rx="1.5" fill="currentColor" opacity="0.8" />
        </svg>
        built for purpose
      </a>
    </>
  )
}
