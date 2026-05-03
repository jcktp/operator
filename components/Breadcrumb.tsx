'use client'

/**
 * Mini breadcrumb row — sits below the top nav, above the page body.
 * Shows the current page name + today's date.
 * For story workspace pages (/stories/[id]), shows the actual story name.
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useMode } from './ModeContext'

function pageLabel(pathname: string, modeJournalLabel: string): string {
  if (pathname === '/') return 'Overview'
  if (pathname === '/stories') return 'Stories'
  if (pathname.startsWith('/stories/')) return 'Story'  // overridden by story:active event
  if (pathname === '/dashboard') return 'Intelligence Brief'
  if (pathname === '/sources' || pathname === '/library') return 'Sources · Library'
  if (pathname === '/files') return 'Sources · Filesystem'
  if (pathname === '/upload') return 'Sources · Add'
  if (pathname === '/research') return 'Research'
  if (pathname === '/entities') return 'Entities'
  if (pathname === '/journal') return modeJournalLabel
  if (pathname === '/dispatch') return 'Dispatch'
  if (pathname === '/settings') return 'Settings'
  if (pathname === '/projects') return 'Stories'
  if (pathname === '/tracker') return 'Tracker'
  if (pathname === '/foia') return 'FOIA'
  if (pathname === '/pulse') return 'Pulse'
  if (pathname === '/network') return 'Connections'
  if (pathname === '/knowledge') return 'Knowledge'
  if (pathname === '/map') return 'Map'
  if (pathname === '/monitors') return 'Web Monitor'
  if (pathname === '/speakers') return 'Speakers'
  if (pathname === '/analysis') return 'Analysis'
  if (pathname === '/directs') return 'Contacts'
  if (pathname === '/collab') return 'Collab'
  if (pathname.startsWith('/reports/')) return 'Document'
  return pathname.slice(1).split('/')[0].replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function Breadcrumb() {
  const pathname = usePathname() ?? '/'
  const mode = useMode()
  const [today, setToday] = useState<string>('')
  const [storyName, setStoryName] = useState<string | null>(null)

  useEffect(() => { setToday(formatDate(new Date())) }, [])

  // Listen for story workspace activations to show the actual story name
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; name: string }>).detail
      if (detail?.name) setStoryName(detail.name)
    }
    window.addEventListener('story:active', handler)
    return () => window.removeEventListener('story:active', handler)
  }, [])

  // Clear story name when navigating away from a story workspace
  useEffect(() => {
    if (!pathname.startsWith('/stories/')) setStoryName(null)
  }, [pathname])

  const baseLabel = pageLabel(pathname, mode.navJournal)
  const label = (pathname.startsWith('/stories/') && storyName) ? storyName : baseLabel

  return (
    <div className="fixed top-14 inset-x-0 h-8 border-b border-[var(--border)] bg-[var(--surface)] z-40 flex items-center px-6 sm:px-8">
      <div className="w-full max-w-[1600px] mx-auto flex items-center">
        <span className="text-[10px] font-mono tracking-[0.04em] text-[var(--text-muted)] truncate">
          {label}
        </span>
        <span className="ml-auto text-[10px] font-mono tracking-[0.04em] text-[var(--text-muted)]">
          {today}
        </span>
      </div>
    </div>
  )
}
