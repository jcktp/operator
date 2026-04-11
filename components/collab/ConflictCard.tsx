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
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-2)] rounded-[4px] border border-[var(--border)] text-xs text-[var(--text-muted)]">
        <CheckCircle2 size={13} className="text-green-500 shrink-0" />
        <span className="font-medium text-[var(--text-body)]">{tableLabel} · {conflict.fieldName}</span>
        <span>—</span>
        <span>{RESOLUTION_LABELS[conflict.resolution ?? ''] ?? conflict.resolution}</span>
        {conflict.resolvedAt && (
          <span className="ml-auto">{formatRelativeDate(new Date(conflict.resolvedAt))}</span>
        )}
      </div>
    )
  }

  return (
    <div className="border border-[var(--amber)] rounded-[10px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--amber-dim)] border-b border-[var(--amber)]">
        <AlertTriangle size={13} className="text-amber-500 shrink-0" />
        <span className="text-xs font-semibold text-[var(--amber)]">
          {tableLabel} — {conflict.fieldName}
        </span>
        <button
          onClick={copyId}
          title="Copy record ID"
          className="ml-auto flex items-center gap-1 text-[10px] text-[var(--amber)] hover:text-[var(--amber)] transition-colors"
        >
          <Copy size={10} />
          {copied ? 'Copied!' : conflict.recordId.slice(0, 8) + '…'}
        </button>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
        <div className="p-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Your version
          </p>
          <p className="text-sm text-[var(--text-bright)] break-words whitespace-pre-wrap min-h-[40px]">
            {conflict.localValue ?? <span className="italic text-[var(--text-muted)]">empty</span>}
          </p>
          {conflict.localTimestamp && (
            <p className="text-[10px] text-[var(--text-muted)]">
              {formatRelativeDate(new Date(conflict.localTimestamp))}
            </p>
          )}
        </div>
        <div className="p-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {conflict.remotePeerId
              ? `${conflict.remotePeerId.slice(0, 8)} version`
              : 'Their version'}
          </p>
          <p className="text-sm text-[var(--text-bright)] break-words whitespace-pre-wrap min-h-[40px]">
            {conflict.remoteValue ?? <span className="italic text-[var(--text-muted)]">empty</span>}
          </p>
          {conflict.remoteTimestamp && (
            <p className="text-[10px] text-[var(--text-muted)]">
              {formatRelativeDate(new Date(conflict.remoteTimestamp))}
            </p>
          )}
        </div>
      </div>

      {/* Resolution actions */}
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-2)] border-t border-[var(--border)]">
        <button
          onClick={() => resolve('kept_local')}
          disabled={resolving !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--surface)] border border-[var(--border)] rounded-[4px] hover:border-[var(--border-mid)] transition-colors disabled:opacity-40"
        >
          {resolving === 'kept_local' ? <Loader2 size={11} className="animate-spin" /> : null}
          Keep mine
        </button>
        <button
          onClick={() => resolve('kept_remote')}
          disabled={resolving !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--surface)] border border-[var(--border)] rounded-[4px] hover:border-[var(--border-mid)] transition-colors disabled:opacity-40"
        >
          {resolving === 'kept_remote' ? <Loader2 size={11} className="animate-spin" /> : null}
          Keep theirs
        </button>
        <button
          onClick={() => resolve('kept_both')}
          disabled={resolving !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--surface)] border border-[var(--border)] rounded-[4px] hover:border-[var(--border-mid)] transition-colors disabled:opacity-40"
        >
          {resolving === 'kept_both' ? <Loader2 size={11} className="animate-spin" /> : null}
          <GitMerge size={11} />
          Keep both
        </button>
      </div>
    </div>
  )
}
