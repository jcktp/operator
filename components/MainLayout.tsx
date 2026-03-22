'use client'

import { useDispatch } from './DispatchContext'
import DispatchPanel from '@/app/dispatch/DispatchPanel'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { open, setOpen, aiContext, pendingMessage, setPendingMessage } = useDispatch()

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
    <main className="pt-20 pb-12 max-w-5xl mx-auto px-4 sm:px-6">
      {children}
    </main>
  )
}
