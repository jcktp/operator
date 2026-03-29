'use client'

import { useState, useEffect } from 'react'
import { Loader2, Globe, Copy, Check } from 'lucide-react'

export default function SettingsRemoteTab() {
  const [tunnelInstalled, setTunnelInstalled] = useState(true)
  const [tunnelRunning, setTunnelRunning] = useState(false)
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null)
  const [tunnelStarting, setTunnelStarting] = useState(false)
  const [tunnelCopied, setTunnelCopied] = useState(false)

  useEffect(() => {
    fetch('/api/tunnel').then(r => r.json()).then((d: { running: boolean; url: string | null; installed: boolean }) => {
      setTunnelRunning(d.running)
      setTunnelUrl(d.url)
      setTunnelInstalled(d.installed)
    }).catch(() => {})
  }, [])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Remote Submissions</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Allow direct reports to submit reports via a secure public link, without installing Operator.
        </p>
      </div>

      {!tunnelInstalled ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1.5">
          <p className="font-medium">cloudflared not installed</p>
          <p>Run <code className="bg-amber-100 rounded px-1 font-mono">./start.sh</code> — it installs cloudflared automatically.</p>
        </div>
      ) : tunnelRunning && tunnelUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs text-green-700 font-medium">Tunnel active</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <Globe size={12} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-700 font-mono truncate flex-1">{tunnelUrl}</span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(tunnelUrl!); setTunnelCopied(true); setTimeout(() => setTunnelCopied(false), 2000) }}
              className="shrink-0 text-gray-400 hover:text-gray-600"
            >
              {tunnelCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">Report request links will use this URL while the tunnel is active. The URL changes each session.</p>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) })
              setTunnelRunning(false); setTunnelUrl(null)
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Disable tunnel
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
            <span className="text-xs text-gray-500">Inactive — links only work on this machine</span>
          </div>
          <button
            type="button"
            disabled={tunnelStarting}
            onClick={async () => {
              setTunnelStarting(true)
              try {
                const res = await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) })
                const d = await res.json() as { running: boolean; url: string | null; error?: string }
                if (d.running && d.url) { setTunnelRunning(true); setTunnelUrl(d.url) }
              } finally {
                setTunnelStarting(false)
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {tunnelStarting ? <><Loader2 size={13} className="animate-spin" /> Starting tunnel…</> : <><Globe size={13} /> Enable remote access</>}
          </button>
        </div>
      )}
    </div>
  )
}
