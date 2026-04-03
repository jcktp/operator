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
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Remote Submissions</h2>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
          Allow direct reports to submit reports via a secure public link, without installing Operator.
        </p>
      </div>

      {!tunnelInstalled ? (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
          <p className="font-medium">cloudflared not installed</p>
          <p>Run <code className="bg-amber-100 dark:bg-amber-900 rounded px-1 font-mono">./start.sh</code> — it installs cloudflared automatically.</p>
        </div>
      ) : tunnelRunning && tunnelUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs text-green-700 dark:text-green-300 font-medium">Tunnel active</span>
          </div>
          <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 flex items-center gap-2">
            <Globe size={12} className="text-gray-400 dark:text-zinc-500 shrink-0" />
            <span className="text-xs text-gray-700 dark:text-zinc-200 font-mono truncate flex-1">{tunnelUrl}</span>
            <button
              type="button"
              onClick={async () => {
                try { await navigator.clipboard.writeText(tunnelUrl!) } catch {
                  const el = document.createElement('textarea'); el.value = tunnelUrl!; el.style.position = 'fixed'; el.style.opacity = '0'; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
                }
                setTunnelCopied(true); setTimeout(() => setTunnelCopied(false), 2000)
              }}
              className="shrink-0 text-gray-400 hover:text-gray-600"
            >
              {tunnelCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-zinc-500">Report request links will use this URL while the tunnel is active. The URL changes each session.</p>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) })
              setTunnelRunning(false); setTunnelUrl(null)
            }}
            className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 underline"
          >
            Disable tunnel
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
            <span className="text-xs text-gray-500 dark:text-zinc-400">Inactive — links only work on this machine</span>
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
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {tunnelStarting ? <><Loader2 size={13} className="animate-spin" /> Starting tunnel…</> : <><Globe size={13} /> Enable remote access</>}
          </button>
        </div>
      )}
    </div>
  )
}
