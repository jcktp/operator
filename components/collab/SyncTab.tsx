'use client'

import { useState } from 'react'
import { RefreshCw, Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'

interface SyncState {
  projectId: string
  peerId: string
  lastSync: string | null
  status: string
}

interface ShareEntry {
  projectId: string
  peerId: string
  permission: string
  peer: {
    id: string
    displayName: string | null
    tunnelUrl: string | null
    localUrl: string | null
  } | null
  syncState: SyncState | null
}

interface Props {
  projectId: string
  initialShares: ShareEntry[]
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  idle:     <CheckCircle2 size={12} className="text-green-400" />,
  syncing:  <Loader2 size={12} className="animate-spin text-blue-400" />,
  error:    <XCircle size={12} className="text-red-400" />,
  conflict: <AlertCircle size={12} className="text-amber-400" />,
}

export default function SyncTab({ projectId, initialShares }: Props) {
  const [shares, setShares] = useState<ShareEntry[]>(initialShares)
  const [syncing, setSyncing] = useState(false)

  const syncNow = async () => {
    setSyncing(true)
    try {
      await fetch(`/api/collab/sync/${projectId}`, { method: 'PUT' })
      // Refresh share data
      const res = await fetch(`/api/collab/projects/${projectId}/share`)
      const data = await res.json() as { shares: ShareEntry[] }
      setShares(data.shares)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-bright)]">Sync</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Syncs automatically every 60 seconds when peers are reachable.
          </p>
        </div>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--surface-2)] rounded-[4px] hover:bg-[var(--surface-3)] disabled:opacity-40 transition-colors"
        >
          {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Sync now
        </button>
      </div>

      {shares.length === 0 && (
        <p className="text-xs text-[var(--text-muted)] text-center py-6">
          No peers connected to this project.
        </p>
      )}

      <div className="space-y-2">
        {shares.map(s => (
          <div key={s.peerId} className="flex items-center gap-3 px-3 py-3 rounded-[4px] border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-[var(--text-bright)] truncate">
                  {s.peer?.displayName ?? s.peerId}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{s.peerId.slice(0, 8)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-muted)]">
                <span className="capitalize">{s.permission.replace('_', '-')}</span>
                {s.syncState?.lastSync && (
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} />
                    Last sync {formatRelativeDate(new Date(s.syncState.lastSync))}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              {STATUS_ICON[s.syncState?.status ?? 'idle']}
              <span className="capitalize">{s.syncState?.status ?? 'idle'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
