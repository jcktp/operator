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
        <Loader2 size={18} className="animate-spin text-gray-400 dark:text-zinc-500" />
      </div>
    )
  }

  if (!identity) {
    return <p className="text-sm text-gray-400 dark:text-zinc-500">Could not load identity.</p>
  }

  return (
    <div className="space-y-5">
      {/* Identity info */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">This instance</p>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
          <span className="font-mono bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{identity.id}</span>
          <span>{identity.displayName}</span>
        </div>
        {identity.tunnelUrl ? (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Link size={11} />
            <span>Remote access active — {identity.tunnelUrl}</span>
          </div>
        ) : (
          <p className="text-xs text-amber-500 dark:text-amber-400">
            No tunnel active — remote peers cannot reach this instance. Start the Cloudflare tunnel from Settings to enable remote collaboration.
          </p>
        )}
      </div>

      {/* Invite string */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700 dark:text-zinc-200">Your invite string</p>
        <p className="text-[10px] text-gray-400 dark:text-zinc-500">
          Share this with peers so they can add you. It contains your instance ID, public key, and tunnel URL.
        </p>
        <div className="relative">
          <textarea
            readOnly
            value={identity.inviteString}
            rows={4}
            className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-[10px] font-mono text-gray-600 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 resize-none focus:outline-none"
          />
        </div>
        <button
          onClick={copyInvite}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors"
        >
          {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy invite string'}
        </button>
      </div>

      {/* Note on tunnel URL rotation */}
      <div className="text-[10px] text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/60 rounded-lg px-3 py-2">
        The tunnel URL changes each session. Share a fresh invite string whenever you restart Operator so peers can reconnect automatically.
      </div>
    </div>
  )
}
