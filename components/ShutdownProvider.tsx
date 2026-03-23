'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ShutdownContextType {
  shutdown: () => void
  forceShutdown: () => void
}

const ShutdownContext = createContext<ShutdownContextType>({ shutdown: () => {}, forceShutdown: () => {} })

export function useShutdown() {
  return useContext(ShutdownContext)
}

export function ShutdownProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'shutting-down' | 'done'>('idle')

  const shutdown = useCallback(async () => {
    if (phase === 'confirming') {
      setPhase('shutting-down')
      try {
        await fetch('/api/shutdown', { method: 'POST' })
      } catch {}
      setTimeout(() => setPhase('done'), 800)
      setTimeout(() => {
        try { window.close() } catch {}
      }, 3200)
    } else {
      setPhase('confirming')
      setTimeout(() => setPhase(p => p === 'confirming' ? 'idle' : p), 3000)
    }
  }, [phase])

  const forceShutdown = useCallback(async () => {
    setPhase('shutting-down')
    try {
      await fetch('/api/shutdown', { method: 'POST' })
    } catch {}
    setTimeout(() => setPhase('done'), 800)
    setTimeout(() => {
      try { window.close() } catch {}
    }, 3200)
  }, [])

  return (
    <ShutdownContext.Provider value={{ shutdown, forceShutdown }}>
      {children}
      {(phase === 'shutting-down' || phase === 'done') && (
        <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col items-center justify-center">
          <div className="text-center space-y-6 max-w-sm w-full px-8">
            {phase === 'shutting-down' ? (
              <>
                <div className="w-10 h-10 mx-auto rounded-full border-2 border-gray-700 border-t-gray-300 animate-spin" />
                <p className="text-gray-200 text-sm font-medium">Shutting down Operator…</p>
                <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-gray-400 rounded-full animate-[grow_2s_ease-in-out_forwards]" />
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-gray-200 text-sm font-medium">Operator stopped</p>
                <p className="text-gray-500 text-xs">You can close this tab.</p>
                <div className="w-full bg-gray-800 rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-gray-600 rounded-full animate-[grow_3s_linear_forwards]" />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ShutdownContext.Provider>
  )
}
