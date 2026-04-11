'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, ShieldAlert, RefreshCw, Copy, Check, Loader2 } from 'lucide-react'

export default function RecoveryCodesPanel() {
 const [status, setStatus] = useState<{ total: number; remaining: number } | null>(null)
 const [codes, setCodes] = useState<string[]>([])
 const [generating, setGenerating] = useState(false)
 const [copied, setCopied] = useState(false)

 useEffect(() => {
 fetch('/api/auth/recovery-codes')
 .then(r => r.json())
 .then((d: { total: number; remaining: number }) => setStatus(d))
 .catch(() => {})
 }, [])

 const generate = async () => {
 setGenerating(true)
 try {
 const res = await fetch('/api/auth/recovery-codes', { method: 'POST' })
 const data = await res.json() as { codes?: string[] }
 if (data.codes) {
 setCodes(data.codes)
 setStatus({ total: data.codes.length, remaining: data.codes.length })
 }
 } finally {
 setGenerating(false)
 }
 }

 const copyAll = () => {
 navigator.clipboard.writeText(codes.join('\n'))
 setCopied(true)
 setTimeout(() => setCopied(false), 2000)
 }

 const hasActive = status && status.remaining > 0

 return (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-start gap-2.5">
 {hasActive
 ? <ShieldCheck size={16} className="text-[var(--green)] mt-0.5 shrink-0" />
 : <ShieldAlert size={16} className="text-amber-500 mt-0.5 shrink-0" />}
 <div>
 <p className="text-sm font-semibold text-[var(--text-bright)]">Recovery codes</p>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 {status === null
 ? 'Loading…'
 : hasActive
 ? `${status.remaining} of ${status.total} codes remaining`
 : 'No recovery codes set up. Generate codes to recover your account if you forget your password.'}
 </p>
 </div>
 </div>
 <button
 type="button"
 onClick={generate}
 disabled={generating}
 className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-[var(--text-subtle)] hover:text-[var(--text-bright)] border border-[var(--border)] rounded-[4px] px-3 py-1.5 hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
 >
 {generating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
 {hasActive ? 'Regenerate' : 'Generate codes'}
 </button>
 </div>

 {codes.length > 0 && (
 <div className="space-y-3">
 <div className="bg-[var(--amber-dim)]/30 border border-[var(--amber)] rounded-[4px] px-3 py-2 text-xs text-[var(--amber)]">
 Save these codes somewhere safe. Each code can only be used once. They will not be shown again.
 </div>
 <div className="grid grid-cols-2 gap-1.5">
 {codes.map(code => (
 <code
 key={code}
 className="text-xs font-mono bg-[var(--surface-2)] text-[var(--text-body)] px-3 py-1.5 rounded-[4px] text-center tracking-widest"
 >
 {code}
 </code>
 ))}
 </div>
 <button
 type="button"
 onClick={copyAll}
 className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors"
 >
 {copied ? <Check size={12} className="text-[var(--green)]" /> : <Copy size={12} />}
 {copied ? 'Copied' : 'Copy all codes'}
 </button>
 </div>
 )}
 </div>
 )
}
