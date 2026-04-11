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
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
 <div>
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Remote Submissions</h2>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 Allow direct reports to submit reports via a secure public link, without installing Operator.
 </p>
 </div>

 {!tunnelInstalled ? (
 <div className="bg-[var(--amber-dim)] border border-amber-200 rounded-[4px] p-3 text-xs text-[var(--amber)] space-y-1.5">
 <p className="font-medium">cloudflared not installed</p>
 <p>Run <code className="bg-amber-100 rounded px-1 font-mono">./start.sh</code> — it installs cloudflared automatically.</p>
 </div>
 ) : tunnelRunning && tunnelUrl ? (
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
 <span className="text-xs text-[var(--green)] font-medium">Tunnel active</span>
 </div>
 <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] px-3 py-2 flex items-center gap-2">
 <Globe size={12} className="text-[var(--text-muted)] shrink-0" />
 <span className="text-xs text-[var(--text-body)] font-mono truncate flex-1">{tunnelUrl}</span>
 <button
 type="button"
 onClick={async () => {
 try { await navigator.clipboard.writeText(tunnelUrl!) } catch {
 const el = document.createElement('textarea'); el.value = tunnelUrl!; el.style.position = 'fixed'; el.style.opacity = '0'; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
 }
 setTunnelCopied(true); setTimeout(() => setTunnelCopied(false), 2000)
 }}
 className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-subtle)]"
 >
 {tunnelCopied ? <Check size={12} className="text-[var(--green)]" /> : <Copy size={12} />}
 </button>
 </div>
 <p className="text-[11px] text-[var(--text-muted)]">Report request links will use this URL while the tunnel is active. The URL changes each session.</p>
 <button
 type="button"
 onClick={async () => {
 await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) })
 setTunnelRunning(false); setTunnelUrl(null)
 }}
 className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] underline"
 >
 Disable tunnel
 </button>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-[var(--surface-3)] shrink-0" />
 <span className="text-xs text-[var(--text-muted)]">Inactive — links only work on this machine</span>
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
 className="flex items-center gap-2 h-7 px-2.5 rounded-[4px] border border-[var(--border)] text-xs font-medium text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
 >
 {tunnelStarting ? <><Loader2 size={13} className="animate-spin" /> Starting tunnel…</> : <><Globe size={13} /> Enable remote access</>}
 </button>
 </div>
 )}
 </div>
 )
}
