'use client'

import { useState, useEffect } from 'react'
import { X, Users, RefreshCw, AlertTriangle, Share2, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import PeersTab from './PeersTab'
import SyncTab from './SyncTab'
import ConflictsTab from './ConflictsTab'
import ShareTab from './ShareTab'
import ChatTab from './ChatTab'
import UnreadBadge from './UnreadBadge'

type Tab = 'peers' | 'sync' | 'conflicts' | 'share' | 'chat'

interface Props {
  projectId: string
  projectName: string
  onClose: () => void
  initialTab?: Tab
  unreadCount?: number
}

export default function CollabPanel({ projectId, projectName, onClose, initialTab = 'peers', unreadCount = 0 }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    peers: unknown[]
    nearby: unknown[]
    shares: unknown[]
    conflicts: unknown[]
    unresolvedCount: number
  }>({ peers: [], nearby: [], shares: [], conflicts: [], unresolvedCount: 0 })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [peersRes, nearbyRes, sharesRes, conflictsRes] = await Promise.all([
          fetch('/api/collab/peers').then(r => r.json()),
          fetch('/api/collab/nearby').then(r => r.json()),
          fetch(`/api/collab/projects/${projectId}/share`).then(r => r.json()),
          fetch(`/api/collab/conflicts?projectId=${projectId}&resolved=false`).then(r => r.json()),
        ])
        setData({
          peers: (peersRes as { peers: unknown[] }).peers ?? [],
          nearby: (nearbyRes as { peers: unknown[] }).peers ?? [],
          shares: (sharesRes as { shares: unknown[] }).shares ?? [],
          conflicts: (conflictsRes as { conflicts: unknown[] }).conflicts ?? [],
          unresolvedCount: (conflictsRes as { unresolvedCount: number }).unresolvedCount ?? 0,
        })
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [projectId])

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'peers',     label: 'Peers',     icon: <Users size={13} /> },
    { id: 'sync',      label: 'Sync',      icon: <RefreshCw size={13} /> },
    { id: 'conflicts', label: 'Conflicts', icon: <AlertTriangle size={13} />, badge: data.unresolvedCount || undefined },
    { id: 'share',     label: 'Share',     icon: <Share2 size={13} /> },
    { id: 'chat',      label: 'Chat',      icon: <MessageSquare size={13} />, badge: tab !== 'chat' ? (unreadCount || undefined) : undefined },
  ]

  const isChat = tab === 'chat'

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-14 bottom-0 w-[420px] bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Collaboration</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 dark:border-zinc-800 shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              title={t.label}
              className={cn(
                'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                tab === t.id
                  ? 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-zinc-50'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
              )}
            >
              {t.icon}
              {tab === t.id && <span>{t.label}</span>}
              {t.badge ? (
                <UnreadBadge count={t.badge} className="absolute -top-1 -right-1" />
              ) : null}
            </button>
          ))}
        </div>

        {/* Body */}
        {isChat ? (
          <div className="flex-1 min-h-0 px-3 py-3 flex flex-col relative">
            <ChatTab projectId={projectId} projectName={projectName} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-gray-300 dark:text-zinc-600" />
              </div>
            ) : (
              <>
                {tab === 'peers' && (
                  <PeersTab
                    projectId={projectId}
                    initialPeers={data.peers as Parameters<typeof PeersTab>[0]['initialPeers']}
                    initialNearby={data.nearby as Parameters<typeof PeersTab>[0]['initialNearby']}
                  />
                )}
                {tab === 'sync' && (
                  <SyncTab
                    projectId={projectId}
                    initialShares={data.shares as Parameters<typeof SyncTab>[0]['initialShares']}
                  />
                )}
                {tab === 'conflicts' && (
                  <ConflictsTab
                    projectId={projectId}
                    initialConflicts={data.conflicts as Parameters<typeof ConflictsTab>[0]['initialConflicts']}
                  />
                )}
                {tab === 'share' && <ShareTab />}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
