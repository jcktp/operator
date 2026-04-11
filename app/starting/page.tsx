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
 <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-6">
 <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center">

 {/* Logo */}
 <div className="relative">
 <div className="w-20 h-20 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex items-center justify-center">
 <WalkieTalkie />
 </div>
 {/* Pulse ring */}
 <div className="absolute inset-0 rounded-2xl border-2 border-yellow-400 animate-ping opacity-20" />
 </div>

 {/* Title */}
 <div>
 <h1
 className="text-3xl text-[var(--text-bright)]"
 style={{ fontFamily: 'var(--font-caveat)', fontWeight: 700 }}
 >
 operator
 </h1>
 <p className="text-sm text-[var(--text-muted)] mt-1">Getting everything ready</p>
 </div>

 {/* Current step */}
 <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-5 py-4 shadow-sm">
 <p className="text-sm font-medium text-[var(--text-body)]">
 {status.step}{!status.ready && dots}
 </p>
 {status.detail && (
 <p className="text-xs text-[var(--text-muted)] mt-1">{status.detail}</p>
 )}
 </div>

 {/* Progress bar — indeterminate */}
 {!status.ready && (
 <div className="w-full h-1 bg-[var(--surface-3)] rounded-full overflow-hidden">
 <div className="h-full bg-[var(--ink)] rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
 </div>
 )}

 <p className="text-xs text-[var(--text-muted)]">
 This only takes a moment on repeat runs.
 <br />
 The first run may take a few minutes while the AI model downloads.
 </p>
 </div>
 </div>
 )
}
