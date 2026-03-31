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
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors">
        <ArrowLeft size={14} />
        Overview
      </Link>
      <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Report failed to load</h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                An error occurred while loading this report. This can happen if the report data is incomplete or a background process is still running.
              </p>
            </div>
            {error.message && (
              <p className="text-xs font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-lg">
                {error.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="text-xs font-medium px-3 py-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors"
              >
                Try again
              </button>
              <Link
                href="/"
                className="text-xs font-medium px-3 py-1.5 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
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
