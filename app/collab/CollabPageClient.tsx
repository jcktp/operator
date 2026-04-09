'use client'

import { useState, useEffect } from 'react'
import { Users, RefreshCw, AlertTriangle, Share2, MessageSquare, Plus, Shield, ShieldOff, Loader2, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/utils'
import dynamic from 'next/dynamic'
import UnreadBadge from '@/components/collab/UnreadBadge'
import ShareTab from '@/components/collab/ShareTab'

const ChatTab = dynamic(() => import('@/components/collab/ChatTab'), { ssr: false })
const SyncTab = dynamic(() => import('@/components/collab/SyncTab'), { ssr: false })
const ConflictsTab = dynamic(() => import('@/components/collab/ConflictsTab'), { ssr: false })
const PeersTab = dynamic(() => import('@/components/collab/PeersTab'), { ssr: false })

interface Project {
  id: string
  name: string
  area: string
  status: string
}

interface Peer {
  id: string
  displayName: string | null
  trusted: boolean
  lastSeen: string | null
  tunnelUrl: string | null
  localUrl: string | null
  discoveryMethod: string | null
  publicKey: string
}

interface Props {
  initialProjects: Project[]
  initialPeers: Peer[]
  initialLanOnly: boolean
}

type ContentTab = 'chat' | 'sync' | 'conflicts' | 'share' | 'peers'

const CONTENT_TABS: { id: ContentTab; label: string; icon: React.ReactNode }[] = [
  { id: 'chat',      label: 'Chat',      icon: <MessageSquare size={13} /> },
  { id: 'sync',      label: 'Sync',      icon: <RefreshCw size={13} /> },
  { id: 'conflicts', label: 'Conflicts', icon: <AlertTriangle size={13} /> },
  { id: 'share',     label: 'Share',     icon: <Share2 size={13} /> },
]

export default function CollabPageClient({ initialProjects, initialPeers, initialLanOnly }: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [peers, setPeers] = useState<Peer[]>(initialPeers)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjects[0]?.id ?? null)
  const [activeTab, setActiveTab] = useState<ContentTab>('chat')
  const [unreadPerProject, setUnreadPerProject] = useState<Record<string, number>>({})
  const [tunnelRunning, setTunnelRunning] = useState(false)
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null)
  const [tunnelStarting, setTunnelStarting] = useState(false)
  const [lanOnly, setLanOnly] = useState(initialLanOnly)

  // Per-project data loaded on project switch
  const [projectData, setProjectData] = useState<{
    shares: unknown[]
    conflicts: unknown[]
    nearby: unknown[]
    unresolvedCount: number
  } | null>(null)
  const [projectDataLoading, setProjectDataLoading] = useState(false)

  // Fetch tunnel status
  useEffect(() => {
    fetch('/api/tunnel')
      .then(r => r.json())
      .then((d: { running: boolean; url: string | null }) => {
        setTunnelRunning(d.running)
        setTunnelUrl(d.url)
      })
      .catch(() => {})
  }, [])

  const toggleTunnel = async () => {
    if (tunnelRunning) {
      await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) })
      setTunnelRunning(false); setTunnelUrl(null)
    } else {
      setTunnelStarting(true)
      try {
        const r = await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) })
        const d = await r.json() as { running: boolean; url: string | null }
        if (d.running && d.url) { setTunnelRunning(true); setTunnelUrl(d.url) }
      } finally { setTunnelStarting(false) }
    }
  }

  const toggleLanOnly = async () => {
    const next = !lanOnly
    setLanOnly(next)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'collab_lan_only', value: String(next) }),
    }).catch(() => {})
  }

  // Fetch unread counts
  useEffect(() => {
    const fetchUnread = () => {
      fetch('/api/collab/notifications/unread')
        .then(r => r.ok ? r.json() : null)
        .then((d: { perProject: Record<string, number> } | null) => {
          if (d) setUnreadPerProject(d.perProject ?? {})
        })
        .catch(() => {})
    }
    fetchUnread()
    const t = setInterval(fetchUnread, 60_000)
    return () => clearInterval(t)
  }, [])

  // Load project-specific data when selection changes
  useEffect(() => {
    if (!selectedProjectId) { setProjectData(null); return }
    setProjectDataLoading(true)
    Promise.all([
      fetch(`/api/collab/projects/${selectedProjectId}/share`).then(r => r.json()),
      fetch(`/api/collab/conflicts?projectId=${selectedProjectId}&resolved=false`).then(r => r.json()),
      fetch('/api/collab/nearby').then(r => r.json()),
    ]).then(([sharesRes, conflictsRes, nearbyRes]: [
      { shares: unknown[] },
      { conflicts: unknown[]; unresolvedCount: number },
      { peers: unknown[] }
    ]) => {
      setProjectData({
        shares: sharesRes.shares ?? [],
        conflicts: conflictsRes.conflicts ?? [],
        nearby: nearbyRes.peers ?? [],
        unresolvedCount: conflictsRes.unresolvedCount ?? 0,
      })
    }).catch(() => {}).finally(() => setProjectDataLoading(false))
  }, [selectedProjectId])

  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const conflictBadge = projectData?.unresolvedCount ?? 0

  const isOnline = (peer: Peer) =>
    peer.lastSeen && Date.now() - new Date(peer.lastSeen).getTime() < 5 * 60 * 1000

  return (
    <div className="flex h-full">
      {/* ── Left sidebar ───────────────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-gray-200 dark:border-zinc-800 flex flex-col bg-gray-50 dark:bg-zinc-950">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-zinc-800">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Collaboration</h1>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-5">
          {/* Shared projects */}
          <div>
            <p className="px-4 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1">
              Shared projects
            </p>
            {projects.length === 0 ? (
              <p className="px-4 text-xs text-gray-400 dark:text-zinc-500">No shared projects yet.</p>
            ) : (
              projects.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setSelectedProjectId(p.id); setActiveTab('chat') }}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium transition-colors text-left',
                    selectedProjectId === p.id
                      ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 border-r-2 border-gray-900 dark:border-zinc-300'
                      : 'text-gray-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-zinc-200'
                  )}
                >
                  <span className="truncate">{p.name}</span>
                  {(unreadPerProject[p.id] ?? 0) > 0 && (
                    <UnreadBadge count={unreadPerProject[p.id]} />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Peers */}
          <div>
            <div className="flex items-center justify-between px-4 mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                Peers
              </p>
              <button
                type="button"
                onClick={() => { setSelectedProjectId(null); setActiveTab('peers') }}
                title="Manage peers"
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200"
              >
                <Plus size={12} />
              </button>
            </div>
            {peers.length === 0 ? (
              <p className="px-4 text-xs text-gray-400 dark:text-zinc-500">No peers connected.</p>
            ) : (
              peers.map(peer => (
                <div
                  key={peer.id}
                  className="flex items-center gap-2 px-4 py-1.5"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline(peer) ? 'bg-green-400' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                  <span className="text-xs text-gray-700 dark:text-zinc-300 truncate flex-1">
                    {peer.displayName ?? peer.id}
                  </span>
                  {peer.trusted
                    ? <Shield size={10} className="text-green-500 shrink-0" />
                    : <ShieldOff size={10} className="text-gray-300 dark:text-zinc-600 shrink-0" />
                  }
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() => { setSelectedProjectId(null); setActiveTab('peers') }}
              className="mx-4 mt-2 text-[11px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 underline"
            >
              Manage peers
            </button>
          </div>
        </div>

        {/* LAN-only toggle */}
        <div className="shrink-0 border-t border-gray-200 dark:border-zinc-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">LAN only</p>
            <button
              type="button"
              onClick={toggleLanOnly}
              className={cn(
                'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
                lanOnly ? 'bg-gray-700 dark:bg-zinc-400' : 'bg-gray-200 dark:bg-zinc-700'
              )}
              title={lanOnly ? 'LAN-only mode on — sync never uses tunnel' : 'Enable LAN-only mode'}
            >
              <span className={cn(
                'inline-block h-3 w-3 rounded-full bg-white transition-transform',
                lanOnly ? 'translate-x-3.5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
          {lanOnly && (
            <p className="mt-1 text-[10px] text-gray-400 dark:text-zinc-500">Sync uses local network only</p>
          )}
        </div>

        {/* Tunnel toggle */}
        <div className="shrink-0 border-t border-gray-200 dark:border-zinc-800 px-4 py-3">
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider mb-2', lanOnly ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500')}>Tunnel</p>
          {lanOnly ? (
            <p className="text-[11px] text-gray-300 dark:text-zinc-600">Disabled in LAN-only mode</p>
          ) : tunnelRunning && tunnelUrl ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-[11px] text-green-600 dark:text-green-400 font-medium truncate">{tunnelUrl.replace('https://', '')}</span>
              </div>
              <button type="button" onClick={toggleTunnel} className="text-[11px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 underline">
                Stop tunnel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleTunnel}
              disabled={tunnelStarting}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              {tunnelStarting ? <Loader2 size={11} className="animate-spin" /> : <Globe size={11} />}
              {tunnelStarting ? 'Starting…' : 'Start tunnel'}
            </button>
          )}
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {selectedProjectId && selectedProject ? (
          <>
            {/* Project header + tabs */}
            <div className="shrink-0 px-6 pt-5 pb-0 border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-50">{selectedProject.name}</h2>
                {selectedProject.area && (
                  <span className="text-xs text-gray-400 dark:text-zinc-500">{selectedProject.area}</span>
                )}
              </div>
              <div className="flex gap-1">
                {CONTENT_TABS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                      activeTab === t.id
                        ? 'border-gray-900 dark:border-zinc-300 text-gray-900 dark:text-zinc-50'
                        : 'border-transparent text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
                    )}
                  >
                    {t.icon}
                    {t.label}
                    {t.id === 'conflicts' && conflictBadge > 0 && (
                      <UnreadBadge count={conflictBadge} className="absolute -top-0.5 -right-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className={cn(
              'flex-1 min-h-0',
              activeTab === 'chat' ? 'flex flex-col px-6 py-4' : 'overflow-y-auto px-6 py-5'
            )}>
              {projectDataLoading && activeTab !== 'chat' ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={20} className="animate-spin text-gray-300 dark:text-zinc-600" />
                </div>
              ) : (
                <>
                  {activeTab === 'chat' && (
                    <ChatTab projectId={selectedProjectId} projectName={selectedProject.name} />
                  )}
                  {activeTab === 'sync' && projectData && (
                    <div className="max-w-2xl">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <SyncTab projectId={selectedProjectId} initialShares={projectData.shares as any} />
                    </div>
                  )}
                  {activeTab === 'conflicts' && projectData && (
                    <div className="max-w-2xl">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <ConflictsTab projectId={selectedProjectId} initialConflicts={projectData.conflicts as any} />
                    </div>
                  )}
                  {activeTab === 'share' && (
                    <div className="max-w-2xl">
                      <ShareTab />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          /* Peers management (global — no project selected) */
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 px-6 pt-5 pb-0 border-b border-gray-200 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-50 mb-3">Peers</h2>
              <div className="flex gap-1 pb-0">
                <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 border-gray-900 dark:border-zinc-300 text-gray-900 dark:text-zinc-50">
                  <Users size={13} /> All peers
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 max-w-2xl">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <PeersTab projectId="" initialPeers={peers as any} initialNearby={(projectData?.nearby ?? []) as any} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
