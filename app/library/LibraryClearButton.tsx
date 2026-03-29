'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function LibraryClearButton() {
  const [confirm, setConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    if (!confirm) {
      setConfirm(true)
      setTimeout(() => setConfirm(false), 3500)
      return
    }
    setClearing(true)
    await fetch('/api/reports/clear', { method: 'DELETE' })
    setClearing(false)
    setConfirm(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={clearing}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
        confirm
          ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100'
          : 'text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:text-gray-700 dark:hover:text-zinc-200 hover:border-gray-300'
      }`}
    >
      <Trash2 size={12} />
      {clearing ? 'Clearing…' : confirm ? 'Delete all reports?' : 'Clear all'}
    </button>
  )
}
