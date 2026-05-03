'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export type ResearchTab = 'wayback' | 'diff' | 'username' | 'osint' | 'monitor'

interface Props {
  active: ResearchTab
}

const TABS: { key: ResearchTab; href: string; label: string }[] = [
  { key: 'wayback',  href: '/research',              label: 'Wayback'         },
  { key: 'diff',     href: '/research?tab=diff',     label: 'Document diff'   },
  { key: 'username', href: '/research?tab=username', label: 'Username search' },
  { key: 'osint',    href: '/research?tab=osint',    label: 'OSINT directory' },
  { key: 'monitor',  href: '/research?tab=monitor',  label: 'Web monitor'     },
]

export default function ResearchTabs({ active }: Props) {
  return (
    <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto">
      {TABS.map(t => {
        const isActive = active === t.key
        return (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              'inline-flex items-center px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
              isActive
                ? 'border-[var(--ink)] text-[var(--text-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]'
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
