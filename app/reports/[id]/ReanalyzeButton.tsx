'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ReanalyzeButton({ reportId }: { reportId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/${reportId}/reanalyze`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Re-analysis failed')
        return
      }
      router.refresh()
    } catch {
      setError('Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={loading}
        title="Re-run AI analysis"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-100 hover:border-gray-400 dark:hover:border-zinc-500 disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        Re-analyse
      </button>
      {error && (
        <p className="absolute top-full right-0 mt-1 text-xs text-red-500 dark:text-red-400 whitespace-nowrap bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-800 rounded px-2 py-1 z-10">
          {error}
        </p>
      )}
    </div>
  )
}
