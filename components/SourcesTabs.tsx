'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Folder, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Optional tab override when the route doesn't unambiguously identify the active tab */
  active?: 'library' | 'filesystem' | 'add'
}

const TABS = [
  { key: 'library' as const, href: '/library', label: 'Library', icon: BookOpen },
  { key: 'filesystem' as const, href: '/files', label: 'Filesystem', icon: Folder },
  { key: 'add' as const, href: '/upload', label: 'Add source', icon: Plus },
]

function detect(pathname: string): 'library' | 'filesystem' | 'add' | null {
  if (pathname === '/' || pathname.startsWith('/library')) return 'library'
  if (pathname.startsWith('/files')) return 'filesystem'
  if (pathname.startsWith('/upload')) return 'add'
  return null
}

export default function SourcesTabs({ active }: Props) {
  const pathname = usePathname()
  const current = active ?? detect(pathname ?? '') ?? 'library'

  return (
    <div className="flex gap-1 border-b border-[var(--border)] mb-3">
      {TABS.map(t => {
        const Icon = t.icon
        const isActive = current === t.key
        return (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
              isActive
                ? 'border-[var(--ink)] text-[var(--text-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]'
            )}
          >
            <Icon size={12} />
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
