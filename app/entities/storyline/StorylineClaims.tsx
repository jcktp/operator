'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown } from 'lucide-react'

export type ClaimStatus = 'unverified' | 'verified' | 'disputed' | 'awaiting'

export interface Claim {
 id: string
 text: string
 status: ClaimStatus
}

interface Props {
 claims: Claim[]
 onChange: (claims: Claim[]) => void
}

const STATUS_CONFIG: Record<ClaimStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
 unverified: {
 label: 'Unverified',
 icon: <AlertCircle size={12} />,
 color: 'text-[var(--amber)]',
 bg: 'bg-[var(--amber-dim)] border-[var(--amber)] border-opacity-30',
 },
 verified: {
 label: 'Verified',
 icon: <CheckCircle2 size={12} />,
 color: 'text-[var(--green)]',
 bg: 'bg-[var(--green-dim)] border-[var(--green)] border-opacity-30',
 },
 disputed: {
 label: 'Disputed',
 icon: <XCircle size={12} />,
 color: 'text-[var(--red)]',
 bg: 'bg-[var(--red-dim)] border-[var(--red)] border-opacity-30',
 },
 awaiting: {
 label: 'Awaiting reply',
 icon: <Clock size={12} />,
 color: 'text-[var(--blue)]',
 bg: 'bg-[var(--blue-dim)] border-[var(--blue)] border-opacity-30',
 },
}

const STATUSES: ClaimStatus[] = ['unverified', 'verified', 'disputed', 'awaiting']

function ClaimRow({ claim, onUpdate }: { claim: Claim; onUpdate: (status: ClaimStatus) => void }) {
 const [open, setOpen] = useState(false)
 const cfg = STATUS_CONFIG[claim.status]

 return (
 <div className={`border rounded-[4px] px-3 py-2.5 ${cfg.bg}`}>
 <div className="flex items-start gap-2">
 <div className="relative shrink-0 mt-0.5">
 <button
 onClick={() => setOpen(o => !o)}
 className={`flex items-center gap-1 text-xs font-medium rounded px-1.5 py-0.5 transition-colors ${cfg.color} hover:opacity-80`}
 >
 {cfg.icon}
 {cfg.label}
 <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
 </button>
 {open && (
 <div className="absolute top-full left-0 mt-1 z-10 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-lg overflow-hidden min-w-[140px]">
 {STATUSES.filter(s => s !== claim.status).map(s => {
 const c = STATUS_CONFIG[s]
 return (
 <button
 key={s}
 onClick={() => { onUpdate(s); setOpen(false) }}
 className={`w-full flex items-center gap-1.5 px-3 py-2 text-xs hover:bg-[var(--surface-2)] transition-colors ${c.color}`}
 >
 {c.icon}
 {c.label}
 </button>
 )
 })}
 </div>
 )}
 </div>
 <p className="flex-1 text-xs text-[var(--text-body)] leading-relaxed">{claim.text}</p>
 </div>
 </div>
 )
}

export default function StorylineClaims({ claims, onChange }: Props) {
 const updateStatus = (id: string, status: ClaimStatus) => {
 onChange(claims.map(c => c.id === id ? { ...c, status } : c))
 }

 const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: claims.filter(c => c.status === s).length }), {} as Record<ClaimStatus, number>)
 const verified = counts.verified
 const readiness = claims.length > 0 ? Math.round((verified / claims.length) * 100) : 0

 return (
 <div className="space-y-3">
 {/* Readiness bar */}
 <div>
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs font-semibold text-[var(--text-subtle)] uppercase tracking-wide">Claim readiness</span>
 <span className="text-xs font-semibold text-[var(--text-body)]">{readiness}%</span>
 </div>
 <div className="w-full h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
 <div
 className="h-full bg-[var(--green)] rounded-full transition-all"
 style={{ width: `${readiness}%` }}
 />
 </div>
 <div className="flex gap-3 mt-1.5">
 {STATUSES.map(s => counts[s] > 0 && (
 <span key={s} className={`text-[10px] font-medium ${STATUS_CONFIG[s].color}`}>
 {counts[s]} {STATUS_CONFIG[s].label.toLowerCase()}
 </span>
 ))}
 </div>
 </div>

 {/* Claims list */}
 <div className="space-y-2">
 {claims.map(claim => (
 <ClaimRow key={claim.id} claim={claim} onUpdate={status => updateStatus(claim.id, status)} />
 ))}
 </div>
 </div>
 )
}
