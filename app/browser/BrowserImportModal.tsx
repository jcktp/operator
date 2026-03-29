'use client'

import { useState } from 'react'
import { X, Loader2, Upload } from 'lucide-react'
import { AREAS } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  initialTitle: string
  initialDate: string
  text: string
  onClose: () => void
  onImported: () => void
}

export default function BrowserImportModal({ initialTitle, initialDate, text, onClose, onImported }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [date, setDate] = useState(initialDate)
  const [area, setArea] = useState('Other')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/browser/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), text, area, reportDate: date || undefined }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Import failed')
        return
      }
      onImported()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Import selection</p>
          <button onClick={onClose} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Preview */}
          <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2.5 max-h-24 overflow-y-auto">
            <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-4 leading-relaxed">{text}</p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500 text-gray-900 dark:text-zinc-50"
            />
          </div>

          {/* Date + Area */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500 text-gray-900 dark:text-zinc-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-zinc-300 mb-1.5">Area</label>
              <select
                value={area}
                onChange={e => setArea(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-zinc-500 text-gray-900 dark:text-zinc-50"
              >
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              loading
                ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed'
                : 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-700 dark:hover:bg-zinc-200'
            )}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
