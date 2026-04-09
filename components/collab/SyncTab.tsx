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
          <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">Sync</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            Syncs automatically every 60 seconds when peers are reachable.
          </p>
        </div>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Sync now
        </button>
      </div>

      {shares.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-6">
          No peers connected to this project.
        </p>
      )}

      <div className="space-y-2">
        {shares.map(s => (
          <div key={s.peerId} className="flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-900 dark:text-zinc-50 truncate">
                  {s.peer?.displayName ?? s.peerId}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono">{s.peerId.slice(0, 8)}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 dark:text-zinc-500">
                <span className="capitalize">{s.permission.replace('_', '-')}</span>
                {s.syncState?.lastSync && (
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} />
                    Last sync {formatRelativeDate(new Date(s.syncState.lastSync))}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-zinc-500">
              {STATUS_ICON[s.syncState?.status ?? 'idle']}
              <span className="capitalize">{s.syncState?.status ?? 'idle'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
