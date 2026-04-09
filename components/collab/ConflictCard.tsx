'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, GitMerge, Loader2 } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'

interface Conflict {
  id: string
  tableName: string
  recordId: string
  fieldName: string
  localValue: string | null
  remoteValue: string | null
  localPeerId: string | null
  remotePeerId: string | null
  localTimestamp: string | null
  remoteTimestamp: string | null
  resolved: boolean
  resolution: string | null
  resolvedAt: string | null
}

interface Props {
  conflict: Conflict
  onResolved: (id: string, resolution: string) => void
}

const RESOLUTION_LABELS: Record<string, string> = {
  kept_local: 'Kept mine',
  kept_remote: 'Kept theirs',
  kept_both: 'Kept both',
}

export default function ConflictCard({ conflict, onResolved }: Props) {
  const [resolving, setResolving] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const resolve = async (resolution: 'kept_local' | 'kept_remote' | 'kept_both') => {
    setResolving(resolution)
    try {
      const res = await fetch(`/api/collab/conflicts/${conflict.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      })
      if (res.ok) onResolved(conflict.id, resolution)
    } finally {
      setResolving(null)
    }
  }

  const copyId = () => {
    navigator.clipboard.writeText(conflict.recordId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const tableLabel = conflict.tableName.replace(/([A-Z])/g, ' $1').trim()

  if (conflict.resolved) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-zinc-800/60 rounded-lg border border-gray-100 dark:border-zinc-700 text-xs text-gray-400 dark:text-zinc-500">
        <CheckCircle2 size={13} className="text-green-500 shrink-0" />
        <span className="font-medium text-gray-600 dark:text-zinc-300">{tableLabel} · {conflict.fieldName}</span>
        <span>—</span>
        <span>{RESOLUTION_LABELS[conflict.resolution ?? ''] ?? conflict.resolution}</span>
        {conflict.resolvedAt && (
          <span className="ml-auto">{formatRelativeDate(new Date(conflict.resolvedAt))}</span>
        )}
      </div>
    )
  }

  return (
    <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800">
        <AlertTriangle size={13} className="text-amber-500 shrink-0" />
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
          {tableLabel} — {conflict.fieldName}
        </span>
        <button
          onClick={copyId}
          title="Copy record ID"
          className="ml-auto flex items-center gap-1 text-[10px] text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 transition-colors"
        >
          <Copy size={10} />
          {copied ? 'Copied!' : conflict.recordId.slice(0, 8) + '…'}
        </button>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-zinc-700">
        <div className="p-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
            Your version
          </p>
          <p className="text-sm text-gray-900 dark:text-zinc-100 break-words whitespace-pre-wrap min-h-[40px]">
            {conflict.localValue ?? <span className="italic text-gray-400 dark:text-zinc-500">empty</span>}
          </p>
          {conflict.localTimestamp && (
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">
              {formatRelativeDate(new Date(conflict.localTimestamp))}
            </p>
          )}
        </div>
        <div className="p-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
            {conflict.remotePeerId
              ? `${conflict.remotePeerId.slice(0, 8)} version`
              : 'Their version'}
          </p>
          <p className="text-sm text-gray-900 dark:text-zinc-100 break-words whitespace-pre-wrap min-h-[40px]">
            {conflict.remoteValue ?? <span className="italic text-gray-400 dark:text-zinc-500">empty</span>}
          </p>
          {conflict.remoteTimestamp && (
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">
              {formatRelativeDate(new Date(conflict.remoteTimestamp))}
            </p>
          )}
        </div>
      </div>

      {/* Resolution actions */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-zinc-800/60 border-t border-gray-100 dark:border-zinc-700">
        <button
          onClick={() => resolve('kept_local')}
          disabled={resolving !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg hover:border-gray-400 dark:hover:border-zinc-400 transition-colors disabled:opacity-40"
        >
          {resolving === 'kept_local' ? <Loader2 size={11} className="animate-spin" /> : null}
          Keep mine
        </button>
        <button
          onClick={() => resolve('kept_remote')}
          disabled={resolving !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg hover:border-gray-400 dark:hover:border-zinc-400 transition-colors disabled:opacity-40"
        >
          {resolving === 'kept_remote' ? <Loader2 size={11} className="animate-spin" /> : null}
          Keep theirs
        </button>
        <button
          onClick={() => resolve('kept_both')}
          disabled={resolving !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg hover:border-gray-400 dark:hover:border-zinc-400 transition-colors disabled:opacity-40"
        >
          {resolving === 'kept_both' ? <Loader2 size={11} className="animate-spin" /> : null}
          <GitMerge size={11} />
          Keep both
        </button>
      </div>
    </div>
  )
}
