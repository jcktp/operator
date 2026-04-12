'use client'

import { useState, useEffect } from 'react'
import { Copy, CheckCircle2, Link, Loader2 } from 'lucide-react'

interface Identity {
  id: string
  displayName: string
  publicKey: string
  tunnelUrl: string | null
  inviteString: string
}

export default function ShareTab() {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/collab/identity')
      .then(r => r.json())
      .then((d: Identity) => setIdentity(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const copyInvite = () => {
    if (!identity?.inviteString) return
    navigator.clipboard.writeText(identity.inviteString).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
      </div>
    )
  }

  if (!identity) {
    return <p className="text-sm text-[var(--text-muted)]">Could not load identity.</p>
  }

  return (
    <div className="space-y-5">
      {/* Identity info */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--text-bright)]">This instance</p>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="font-mono bg-[var(--surface-2)] px-2 py-0.5 rounded">{identity.id}</span>
          <span>{identity.displayName}</span>
        </div>
        {identity.tunnelUrl ? (
          <div className="flex items-center gap-1.5 text-xs text-[var(--green)]">
            <Link size={11} />
            <span>Remote access active — {identity.tunnelUrl}</span>
          </div>
        ) : (
          <p className="text-xs text-[var(--amber)]">
            No tunnel active — remote peers cannot reach this instance. Start the Cloudflare tunnel from Settings to enable remote collaboration.
          </p>
        )}
      </div>

      {/* Invite string */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--text-subtle)]">Your invite string</p>
        <p className="text-[10px] text-[var(--text-muted)]">
          Share this with peers so they can add you. It contains your instance ID, public key, and tunnel URL.
        </p>
        <div className="relative">
          <textarea
            readOnly
            value={identity.inviteString}
            rows={4}
            className="w-full border border-[var(--border)] rounded-[4px] px-3 py-2 text-[10px] font-mono text-[var(--text-body)] bg-[var(--surface-2)] resize-none focus:outline-none"
          />
        </div>
        <button
          onClick={copyInvite}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] rounded-[4px] hover:opacity-90 transition-colors"
        >
          {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy invite string'}
        </button>
      </div>

      {/* Note on tunnel URL rotation */}
      <div className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-2)] rounded-[4px] px-3 py-2">
        The tunnel URL changes each session. Share a fresh invite string whenever you restart Operator so peers can reconnect automatically.
      </div>
    </div>
  )
}
