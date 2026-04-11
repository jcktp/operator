'use client'

import { useState, useEffect } from 'react'
import { Loader2, Users, Copy, Check, RefreshCw } from 'lucide-react'

interface IdentityData {
 instanceId: string
 displayName: string
 tunnelUrl: string | null
 inviteString: string
}

export default function SettingsCollabTab() {
 const [enabled, setEnabled] = useState(false)
 const [displayName, setDisplayName] = useState('')
 const [saving, setSaving] = useState(false)
 const [saved, setSaved] = useState(false)
 const [identity, setIdentity] = useState<IdentityData | null>(null)
 const [identityLoading, setIdentityLoading] = useState(false)
 const [copied, setCopied] = useState(false)

 useEffect(() => {
 fetch('/api/settings')
 .then(r => r.json())
 .then((d: { settings: Record<string, string> }) => {
 const s = d.settings ?? {}
 setEnabled(s.collab_enabled === 'true')
 setDisplayName(s.collab_display_name ?? '')
 })
 .catch(() => {})
 }, [])

 useEffect(() => {
 if (!enabled) { setIdentity(null); return }
 setIdentityLoading(true)
 fetch('/api/collab/identity')
 .then(r => r.ok ? r.json() as Promise<IdentityData> : null)
 .then(d => setIdentity(d))
 .catch(() => {})
 .finally(() => setIdentityLoading(false))
 }, [enabled])

 async function save() {
 setSaving(true)
 try {
 // Settings API accepts one key/value pair per POST call
 await Promise.all([
 fetch('/api/settings', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ key: 'collab_enabled', value: String(enabled) }),
 }),
 fetch('/api/settings', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ key: 'collab_display_name', value: displayName }),
 }),
 ])
 setSaved(true)
 setTimeout(() => setSaved(false), 2000)
 } finally {
 setSaving(false)
 }
 }

 async function copyInvite() {
 if (!identity?.inviteString) return
 try { await navigator.clipboard.writeText(identity.inviteString) } catch {
 const el = document.createElement('textarea')
 el.value = identity.inviteString
 el.style.position = 'fixed'; el.style.opacity = '0'
 document.body.appendChild(el); el.select()
 document.execCommand('copy'); document.body.removeChild(el)
 }
 setCopied(true); setTimeout(() => setCopied(false), 2000)
 }

 return (
 <div className="space-y-4">
 {/* Enable toggle */}
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
 <div>
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">Peer Collaboration</h2>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 Sync projects with other Operator instances on your local network or over a tunnel. Fully peer-to-peer — no cloud required.
 </p>
 </div>

 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-[var(--text-body)] font-medium">Enable collaboration</p>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">Restart the app after changing this to activate background sync.</p>
 </div>
 <button
 type="button"
 role="switch"
 aria-checked={enabled}
 onClick={() => setEnabled(v => !v)}
 className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-[var(--ink)]' : 'bg-[var(--surface-3)]'}`}
 >
 <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[var(--surface)] transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
 </button>
 </div>

 {enabled && (
 <div>
 <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1.5">Display name</label>
 <input
 type="text"
 value={displayName}
 onChange={e => setDisplayName(e.target.value)}
 placeholder="My Operator instance"
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2"
 />
 <p className="text-[11px] text-[var(--text-muted)] mt-1">Shown to peers when they discover this instance.</p>
 </div>
 )}

 <div className="flex justify-end">
 <button
 type="button"
 onClick={save}
 disabled={saving}
 className="flex items-center gap-2 h-7 px-3 rounded-[4px] bg-[var(--ink)] text-white text-xs font-medium hover:opacity-90 transition-colors disabled:opacity-50"
 >
 {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
 {saved ? 'Saved' : 'Save'}
 </button>
 </div>
 </div>

 {/* Identity card — only when enabled */}
 {enabled && (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
 <div className="flex items-center gap-2">
 <Users size={14} className="text-[var(--text-muted)]" />
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">This Instance</h2>
 </div>

 {identityLoading ? (
 <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
 <Loader2 size={13} className="animate-spin" /> Loading identity…
 </div>
 ) : identity ? (
 <div className="space-y-3">
 <div>
 <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Instance ID</p>
 <code className="text-xs font-mono text-[var(--text-body)] bg-[var(--surface-2)] px-2 py-1 rounded">{identity.instanceId}</code>
 </div>

 <div>
 <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Tunnel</p>
 {identity.tunnelUrl ? (
 <div className="flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
 <code className="text-xs font-mono text-[var(--text-body)] truncate">{identity.tunnelUrl}</code>
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-[var(--surface-3)] shrink-0" />
 <span className="text-xs text-[var(--text-muted)]">No tunnel active — peers must be on the same network</span>
 </div>
 )}
 </div>

 <div>
 <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Invite string</p>
 <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] px-3 py-2 flex items-start gap-2">
 <code className="text-[11px] font-mono text-[var(--text-subtle)] flex-1 break-all leading-relaxed">{identity.inviteString}</code>
 <button
 type="button"
 onClick={copyInvite}
 className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-subtle)] mt-0.5"
 title="Copy invite string"
 >
 {copied ? <Check size={12} className="text-[var(--green)]" /> : <Copy size={12} />}
 </button>
 </div>
 <p className="text-[11px] text-[var(--text-muted)] mt-1">Share this with peers so they can add this instance. Manage peers and sync from any project card.</p>
 </div>

 <button
 type="button"
 onClick={() => {
 setIdentityLoading(true)
 fetch('/api/collab/identity')
 .then(r => r.ok ? r.json() as Promise<IdentityData> : null)
 .then(d => setIdentity(d))
 .catch(() => {})
 .finally(() => setIdentityLoading(false))
 }}
 className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-subtle)]"
 >
 <RefreshCw size={11} /> Refresh
 </button>
 </div>
 ) : (
 <p className="text-xs text-[var(--text-muted)]">Could not load identity. Save and restart the app, then return here.</p>
 )}
 </div>
 )}
 </div>
 )
}
