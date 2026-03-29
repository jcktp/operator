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
    <div className="border-b border-gray-100 dark:border-zinc-800 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-left"
      >
        <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border mt-0.5 ${TYPE_COLORS[item.claimType]}`}>
          {TYPE_LABELS[item.claimType]}
        </span>
        <span className="flex-1 text-sm text-gray-700 dark:text-zinc-200 leading-snug">{item.claim}</span>
        <span className="shrink-0 text-gray-300 dark:text-zinc-600 mt-0.5">
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 ml-3 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Evidence needed</p>
            <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">{item.evidenceNeeded}</p>
          </div>
          {item.suggestedSources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Suggested sources</p>
              <ul className="space-y-1">
                {item.suggestedSources.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300">
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-zinc-600 shrink-0" />
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
      <h2 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <CheckSquare size={11} />
        Verification
        <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 text-xs font-medium normal-case tracking-normal">
          {checklist.length} claims to check
        </span>
      </h2>
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800">
        {checklist.map((item, i) => (
          <VerificationRow key={i} item={item} />
        ))}
      </div>
    </section>
  )
}
