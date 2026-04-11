'use client'

import { useState } from 'react'
import { CheckSquare, ChevronDown, ChevronUp } from 'lucide-react'

export interface VerificationItem {
 claim: string
 claimType: 'statistical' | 'attribution' | 'event' | 'legal'
 evidenceNeeded: string
 suggestedSources: string[]
}

const TYPE_LABELS: Record<VerificationItem['claimType'], string> = {
 statistical: 'Statistical',
 attribution: 'Attribution',
 event: 'Event',
 legal: 'Legal',
}

const TYPE_COLORS: Record<VerificationItem['claimType'], string> = {
 statistical: 'bg-blue-50 text-blue-700 border-blue-200',
 attribution: 'bg-purple-50 text-purple-700 border-purple-200',
 event: 'bg-amber-50 text-amber-700 border-amber-200',
 legal: 'bg-red-50 text-red-700 border-red-200',
}

function VerificationRow({ item }: { item: VerificationItem }) {
 const [open, setOpen] = useState(false)

 return (
 <div className="border-b border-[var(--border)] last:border-0">
 <button
 onClick={() => setOpen(o => !o)}
 className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors text-left"
 >
 <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border mt-0.5 ${TYPE_COLORS[item.claimType]}`}>
 {TYPE_LABELS[item.claimType]}
 </span>
 <span className="flex-1 text-sm text-[var(--text-body)] leading-snug">{item.claim}</span>
 <span className="shrink-0 text-[var(--border)] mt-0.5">
 {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
 </span>
 </button>
 {open && (
 <div className="px-4 pb-4 ml-3 space-y-3">
 <div>
 <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">Evidence needed</p>
 <p className="text-sm text-[var(--text-subtle)] leading-relaxed">{item.evidenceNeeded}</p>
 </div>
 {item.suggestedSources.length > 0 && (
 <div>
 <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Suggested sources</p>
 <ul className="space-y-1">
 {item.suggestedSources.map((s, i) => (
 <li key={i} className="flex items-center gap-2 text-sm text-[var(--text-subtle)]">
 <span className="w-1 h-1 rounded-full bg-[var(--surface-3)] shrink-0" />
 {s}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </div>
 )
}

export default function VerificationSection({ checklist }: { checklist: VerificationItem[] }) {
 if (checklist.length === 0) return null

 return (
 <section>
 <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
 <CheckSquare size={11} />
 Verification
 <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--amber-dim)] text-[var(--amber)] text-xs font-medium normal-case tracking-normal">
 {checklist.length} claims to check
 </span>
 </h2>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] divide-y divide-[var(--border)]">
 {checklist.map((item, i) => (
 <VerificationRow key={i} item={item} />
 ))}
 </div>
 </section>
 )
}
