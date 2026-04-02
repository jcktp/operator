'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export default function DeleteReportButton({ id }: { id: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    setDeleting(true)
    await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    router.push('/library')
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
        confirming
          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 hover:bg-red-100'
          : 'border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:border-gray-400 dark:hover:border-zinc-500'
      }`}
    >
      {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      {confirming ? 'Confirm delete' : 'Delete'}
    </button>
  )
}
