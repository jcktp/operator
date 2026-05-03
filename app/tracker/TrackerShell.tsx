'use client'

import { useState } from 'react'
import { CheckSquare, ShieldAlert, ListChecks, FileSearch } from 'lucide-react'
import { cn } from '@/lib/utils'
import LayoutD from '@/components/layouts/LayoutD'
import ClaimsClient from '@/app/claims/ClaimsClient'
import RisksClient from '@/app/risks/RisksClient'
import ActionsClient from '@/app/actions/ActionsClient'
import FoiaClient from '@/app/foia/FoiaClient'

type Tab = 'claims' | 'risks' | 'actions' | 'foia'

const TABS: { id: Tab; label: string; icon: typeof CheckSquare; description: string }[] = [
  { id: 'claims',  label: 'Claims',  icon: CheckSquare, description: 'Verifiable assertions extracted from your documents.' },
  { id: 'risks',   label: 'Risks',   icon: ShieldAlert, description: 'Auto-extracted risks, severity and mitigation status.' },
  { id: 'actions', label: 'Actions', icon: ListChecks,  description: 'Follow-ups with owners and due dates.' },
  { id: 'foia',    label: 'FOIA',    icon: FileSearch,  description: 'Track public records requests from filing to receipt.' },
]

export default function TrackerShell({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const active = TABS.find(t => t.id === tab) ?? TABS[0]

  const select = (next: Tab) => {
    setTab(next)
    const url = next === 'claims' ? '/tracker' : `/tracker?tab=${next}`
    window.history.replaceState(null, '', url)
  }

  return (
    <LayoutD
      header={
        <div className="px-7 py-5">
          <div className="mb-3">
            <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Tracker</h1>
            <p className="text-[var(--text-muted)] text-sm mt-0.5">{active.description}</p>
          </div>
          <div className="flex gap-1 border-b border-[var(--border)] -mb-5">
            {TABS.map(t => {
              const Icon = t.icon
              const isActive = t.id === tab
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => select(t.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
                    isActive
                      ? 'border-[var(--ink)] text-[var(--text-bright)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]'
                  )}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      }
    >
      {tab === 'claims' && <ClaimsClient />}
      {tab === 'risks' && <RisksClient />}
      {tab === 'actions' && <ActionsClient />}
      {tab === 'foia' && <FoiaClient />}
    </LayoutD>
  )
}
