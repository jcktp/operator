'use client'

import { useState } from 'react'
import { Plus, Shield, ShieldOff, Trash2, Loader2, Wifi, WifiOff, Clock } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'

interface Peer {
  id: string
  displayName: string | null
  publicKey: string
  lastSeen: string | null
  tunnelUrl: string | null
  localUrl: string | null
  discoveryMethod: string | null
  trusted: boolean
}

interface NearbyPeer {
  instanceId: string
  displayName: string
  version: string
  localUrl: string
  sharedProjectIds: string[]
  seenAt: string
}

interface Props {
  projectId: string
  initialPeers: Peer[]
  initialNearby: NearbyPeer[]
}

export default function PeersTab({ projectId, initialPeers, initialNearby }: Props) {
  const [peers, setPeers] = useState<Peer[]>(initialPeers)
  const [nearby, setNearby] = useState<NearbyPeer[]>(initialNearby)
  const [showAddForm, setShowAddForm] = useState(false)
  const [inviteInput, setInviteInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const refreshNearby = async () => {
    const res = await fetch('/api/collab/nearby')
    const data = await res.json() as { peers: NearbyPeer[] }
    setNearby(data.peers)
  }

  const addFromInvite = async () => {
    if (!inviteInput.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/collab/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteString: inviteInput.trim() }),
      })
      if (!res.ok) { const d = await res.json() as { error: string }; alert(d.error); return }
      const { peer } = await res.json() as { peer: Peer }
      // Then share the project with them
      await fetch(`/api/collab/projects/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: peer.id }),
      })
      setPeers(ps => ps.some(p => p.id === peer.id) ? ps.map(p => p.id === peer.id ? peer : p) : [peer, ...ps])
      setInviteInput('')
      setShowAddForm(false)
    } finally {
      setAdding(false)
    }
  }

  const addNearbyPeer = async (np: NearbyPeer) => {
    setAdding(true)
    try {
      const res = await fetch('/api/collab/peers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: np.instanceId,
          displayName: np.displayName,
          publicKey: '',  // will be populated when they send their first sync
          localUrl: np.localUrl,
          discoveryMethod: 'mdns',
          trusted: false,
        }),
      })
      const { peer } = await res.json() as { peer: Peer }
      await fetch(`/api/collab/projects/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: peer.id }),
      })
      setPeers(ps => ps.some(p => p.id === peer.id) ? ps : [peer, ...ps])
    } finally {
      setAdding(false)
    }
  }

  const toggleTrust = async (peer: Peer) => {
    setTogglingId(peer.id)
    try {
      const res = await fetch(`/api/collab/peers/${peer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trusted: !peer.trusted }),
      })
      const { peer: updated } = await res.json() as { peer: Peer }
      setPeers(ps => ps.map(p => p.id === peer.id ? updated : p))
    } finally {
      setTogglingId(null)
    }
  }

  const removePeer = async (id: string) => {
    setDeletingId(id)
    try {
      await fetch(`/api/collab/projects/${projectId}/share?peerId=${id}`, { method: 'DELETE' })
      setPeers(ps => ps.filter(p => p.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const isOnline = (peer: Peer) => {
    if (!peer.lastSeen) return false
    return Date.now() - new Date(peer.lastSeen).getTime() < 5 * 60 * 1000
  }

  return (
    <div className="space-y-5">
      {/* Peer list */}
      <div className="space-y-2">
        {peers.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-6">
            No peers connected to this project yet.
          </p>
        )}
        {peers.map(peer => (
          <div key={peer.id} className="flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            {/* Online indicator */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline(peer) ? 'bg-green-400' : 'bg-gray-300 dark:bg-zinc-600'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-900 dark:text-zinc-50 truncate">
                  {peer.displayName ?? 'Unknown'}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono">{peer.id}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400 dark:text-zinc-500">
                <span>{peer.discoveryMethod === 'mdns' ? <Wifi size={9} /> : <WifiOff size={9} />}</span>
                <span>{peer.discoveryMethod ?? 'remote'}</span>
                {peer.lastSeen && (
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} />
                    {formatRelativeDate(new Date(peer.lastSeen))}
                  </span>
                )}
              </div>
            </div>
            {/* Trust toggle */}
            <button
              onClick={() => toggleTrust(peer)}
              disabled={togglingId === peer.id}
              title={peer.trusted ? 'Revoke trust' : 'Trust peer'}
              className={`p-1.5 rounded transition-colors ${peer.trusted
                ? 'text-green-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950'
                : 'text-gray-400 dark:text-zinc-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950'}`}
            >
              {togglingId === peer.id
                ? <Loader2 size={13} className="animate-spin" />
                : peer.trusted ? <Shield size={13} /> : <ShieldOff size={13} />}
            </button>
            <button
              onClick={() => removePeer(peer.id)}
              disabled={deletingId === peer.id}
              className="p-1.5 rounded text-gray-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              {deletingId === peer.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        ))}
      </div>

      {/* Add peer */}
      {showAddForm ? (
        <div className="space-y-3 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-700 dark:text-zinc-200">Paste invite string</p>
          <textarea
            value={inviteInput}
            onChange={e => setInviteInput(e.target.value)}
            placeholder="Paste the peer's invite string here…"
            rows={3}
            className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={addFromInvite}
              disabled={adding || !inviteInput.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors"
            >
              {adding && <Loader2 size={11} className="animate-spin" />}
              Add peer
            </button>
            <button onClick={() => setShowAddForm(false)} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
              Cancel
            </button>
          </div>

          {/* Nearby peers on local network */}
          {nearby.length > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Nearby (local network)</p>
                <button onClick={refreshNearby} className="text-[10px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">Refresh</button>
              </div>
              <div className="space-y-1.5">
                {nearby.map(np => (
                  <div key={np.instanceId} className="flex items-center gap-2 text-xs">
                    <Wifi size={11} className="text-green-400 shrink-0" />
                    <span className="text-gray-700 dark:text-zinc-200 font-medium">{np.displayName}</span>
                    <span className="text-gray-400 dark:text-zinc-500 font-mono text-[10px]">{np.instanceId}</span>
                    <button
                      onClick={() => addNearbyPeer(np)}
                      disabled={adding || peers.some(p => p.id === np.instanceId)}
                      className="ml-auto text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
                    >
                      {peers.some(p => p.id === np.instanceId) ? 'Added' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors"
        >
          <Plus size={13} />
          Add peer
        </button>
      )}
    </div>
  )
}
