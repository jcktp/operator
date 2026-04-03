'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import WalkieTalkie from '@/components/WalkieTalkie'
import { playStartupBeep } from '@/lib/beep'

interface Status {
  step: string
  detail?: string
  ready: boolean
}

export default function StartingPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>({ step: 'Starting up…', ready: false })
  const [dots, setDots] = useState('.')

  // Animate the ellipsis
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => clearInterval(id)
  }, [])

  // Poll startup status
  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch('/api/startup-status')
        const data = await res.json() as Status
        if (cancelled) return
        setStatus(data)
        if (data.ready) {
          await playStartupBeep()
          router.replace('/')
          return
        }
      } catch {
        // server not ready yet — keep polling
      }
      if (!cancelled) setTimeout(poll, 800)
    }

    poll()
    return () => { cancelled = true }
  }, [router])

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center">

        {/* Logo */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-center">
            <WalkieTalkie />
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-yellow-400 animate-ping opacity-20" />
        </div>

        {/* Title */}
        <div>
          <h1
            className="text-3xl text-gray-900 dark:text-zinc-50"
            style={{ fontFamily: 'var(--font-caveat)', fontWeight: 700 }}
          >
            operator
          </h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-1">Getting everything ready</p>
        </div>

        {/* Current step */}
        <div className="w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl px-5 py-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">
            {status.step}{!status.ready && dots}
          </p>
          {status.detail && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{status.detail}</p>
          )}
        </div>

        {/* Progress bar — indeterminate */}
        {!status.ready && (
          <div className="w-full h-1 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gray-800 dark:bg-zinc-400 rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
          </div>
        )}

        <p className="text-xs text-gray-400 dark:text-zinc-500">
          This only takes a moment on repeat runs.
          <br />
          The first run may take a few minutes while the AI model downloads.
        </p>
      </div>
    </div>
  )
}
