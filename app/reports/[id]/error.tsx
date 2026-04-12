'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export default function ReportError({
 error,
 reset,
}: {
 error: Error & { digest?: string }
 reset: () => void
}) {
 useEffect(() => {
 console.error('Report page error:', error)
 }, [error])

 return (
 <div className="max-w-3xl space-y-6">
 <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors">
 <ArrowLeft size={14} />
 Overview
 </Link>
 <div className="bg-[var(--surface)] border border-[var(--red)] rounded-[10px] p-6">
 <div className="flex items-start gap-3">
 <AlertTriangle size={18} className="text-[var(--red)] shrink-0 mt-0.5" />
 <div className="space-y-3">
 <div>
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Report failed to load</h2>
 <p className="text-xs text-[var(--text-muted)] mt-1">
 An error occurred while loading this report. This can happen if the report data is incomplete or a background process is still running.
 </p>
 </div>
 {error.message && (
 <p className="text-xs font-mono text-[var(--red)] bg-[var(--red-dim)] px-3 py-2 rounded-[4px]">
 {error.message}
 </p>
 )}
 <div className="flex gap-2">
 <button
 onClick={reset}
 className="text-xs font-medium px-3 py-1.5 bg-[var(--ink)] text-[var(--ink-contrast)] rounded-[4px] hover:opacity-90 transition-colors"
 >
 Try again
 </button>
 <Link
 href="/"
 className="text-xs font-medium px-3 py-1.5 border border-[var(--border)] text-[var(--text-subtle)] rounded-[4px] hover:bg-[var(--surface-2)] transition-colors"
 >
 Back to overview
 </Link>
 </div>
 </div>
 </div>
 </div>
 </div>
 )
}
