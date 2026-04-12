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
          <p className="text-sm text-[var(--text-muted)] text-center py-6">
            No peers connected to this project yet.
          </p>
        )}
        {peers.map(peer => (
          <div key={peer.id} className="flex items-center gap-3 px-3 py-3 rounded-[4px] border border-[var(--border)] bg-[var(--surface)]">
            {/* Online indicator */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline(peer) ? 'bg-green-400' : 'bg-[var(--border-mid)]'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-[var(--text-bright)] truncate">
                  {peer.displayName ?? 'Unknown'}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{peer.id}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-muted)]">
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
                ? 'text-green-500 hover:text-red-500 hover:bg-[var(--red-dim)]'
                : 'text-[var(--text-muted)] hover:text-[var(--green)] hover:bg-[var(--green-dim)]'}`}
            >
              {togglingId === peer.id
                ? <Loader2 size={13} className="animate-spin" />
                : peer.trusted ? <Shield size={13} /> : <ShieldOff size={13} />}
            </button>
            <button
              onClick={() => removePeer(peer.id)}
              disabled={deletingId === peer.id}
              className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--red-dim)] transition-colors"
            >
              {deletingId === peer.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        ))}
      </div>

      {/* Add peer */}
      {showAddForm ? (
        <div className="space-y-3 border border-[var(--border)] rounded-[4px] p-4">
          <p className="text-xs font-medium text-[var(--text-subtle)]">Paste invite string</p>
          <textarea
            value={inviteInput}
            onChange={e => setInviteInput(e.target.value)}
            placeholder="Paste the peer's invite string here…"
            rows={3}
            className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--ink)]"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={addFromInvite}
              disabled={adding || !inviteInput.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium rounded-[4px] hover:opacity-90 disabled:opacity-40 transition-colors"
            >
              {adding && <Loader2 size={11} className="animate-spin" />}
              Add peer
            </button>
            <button onClick={() => setShowAddForm(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors">
              Cancel
            </button>
          </div>

          {/* Nearby peers on local network */}
          {nearby.length > 0 && (
            <div className="pt-3 border-t border-[var(--border)]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Nearby (local network)</p>
                <button onClick={refreshNearby} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-body)]">Refresh</button>
              </div>
              <div className="space-y-1.5">
                {nearby.map(np => (
                  <div key={np.instanceId} className="flex items-center gap-2 text-xs">
                    <Wifi size={11} className="text-green-400 shrink-0" />
                    <span className="text-[var(--text-subtle)] font-medium">{np.displayName}</span>
                    <span className="text-[var(--text-muted)] font-mono text-[10px]">{np.instanceId}</span>
                    <button
                      onClick={() => addNearbyPeer(np)}
                      disabled={adding || peers.some(p => p.id === np.instanceId)}
                      className="ml-auto text-[10px] px-2 py-0.5 bg-[var(--surface-2)] rounded hover:bg-[var(--surface-3)] disabled:opacity-40 transition-colors"
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
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-bright)] transition-colors"
        >
          <Plus size={13} />
          Add peer
        </button>
      )}
    </div>
  )
}
