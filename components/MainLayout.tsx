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
        <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        built for purpose
      </a>
    </>
  )
}
