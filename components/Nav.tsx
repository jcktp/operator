'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Users, Settings, Library, Power, BarChart2, BookOpen, MessageSquare, Search, ChevronDown, LogOut, Radio, Globe } from '@/components/icons'
import { Network, Users as UsersIcon, BarChart2 as BarChart2Icon, Clock, Inbox, Layers } from 'lucide-react'
import type React from 'react'

type AnyIcon = React.ComponentType<{ size?: number; className?: string }>
const EXTRA_NAV_ICONS: Record<string, AnyIcon> = {
  Network,
  Users: UsersIcon,
  BarChart2: BarChart2Icon,
  Clock,
}
import { useShutdown } from '@/components/ShutdownProvider'
import { useState, useEffect, useRef, Suspense } from 'react'
import WalkieTalkie from '@/components/WalkieTalkie'
import { playShutdownBeep } from '@/lib/beep'
import { useMode } from '@/components/ModeContext'
import { useTheme } from '@/components/ThemeProvider'
import StatusIndicator from '@/components/StatusIndicator'
import UploadNotification from '@/components/UploadNotification'
import SearchModal from '@/components/SearchModal'
import NavDropdown, { type NavGroupItem } from '@/components/NavDropdown'
import ActiveAreaBadge from '@/components/ActiveAreaBadge'
import { Moon, Sun, ShieldOff } from 'lucide-react'

// Kept for any imports that reference it; top nav has no sidebar
export const SIDEBAR_W = 0

const NAV_LINK_CLASS =
  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0 text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800'
const NAV_ACTIVE_CLASS =
  'bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-50'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { shutdown, forceShutdown } = useShutdown()

  const config = useMode()
  const { theme, toggle: toggleTheme } = useTheme()
  const [powerMenuOpen, setPowerMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [activeArea, setActiveArea] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const chirpRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => { chirpRef.current = new Audio('/sounds/chirp.mp3') }, [])
  const playChirp = () => { const a = chirpRef.current; if (!a) return; a.currentTime = 0; a.volume = 0.4; a.play().catch(() => {}) }
  const powerMenuRef = useRef<HTMLDivElement>(null)
  const [newReport, setNewReport] = useState<{ name: string } | null>(null)
  const [notifShowing, setNotifShowing] = useState(false)
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastReportIdRef = useRef<string | null>(null)
  const lastReportCreatedAtRef = useRef<string | null>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (powerMenuRef.current && !powerMenuRef.current.contains(e.target as Node)) {
        setPowerMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const hidden = pathname.startsWith('/request/') || pathname === '/login' || pathname === '/starting'
  const [airGapped, setAirGapped] = useState(false)
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((d: { settings?: Record<string, string> }) => {
        if (d.settings?.air_gap_mode === 'true') setAirGapped(true)
      })
      .catch(() => {})
  }, [])

  // ── NAV GROUP CONSTRUCTION ────────────────────────────────────────
  const toggleGroup = (id: string) => setOpenGroup(prev => prev === id ? null : id)
  const closeGroups = () => setOpenGroup(null)

  // GROUP A: Intake — ingest points
  const intakeItems: NavGroupItem[] = [
    { href: '/upload', label: config.navDocuments, icon: Upload },
    { href: '/pulse', label: 'Pulse', icon: Radio },
    ...(!airGapped ? [{ href: '/browser', label: 'Browser', icon: Globe }] : []),
  ]

  // GROUP B: Analysis — library + mode-specific extraNavItems + people
  const analysisItems: NavGroupItem[] = [
    {
      href: '/library',
      label: config.navLibrary,
      icon: Library,
      hasNotifDot: !!newReport,
      onClick: dismissNotif,
    },
    ...config.features.extraNavItems.map(item => ({
      href: item.href,
      label: item.label,
      icon: EXTRA_NAV_ICONS[item.icon] ?? Network,
    })),
    { href: '/directs', label: config.navPeople, icon: Users },
  ]

  // GROUP C: Synthesis — creation and output tools
  const synthesisItems: NavGroupItem[] = [
    { href: '/journal', label: config.navJournal, icon: BookOpen },
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(s => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/reports?limit=1')
        const data = await res.json()
        const latest = data.reports?.[0]
        if (!latest) return
        if (lastReportIdRef.current === null) {
          lastReportIdRef.current = latest.id
          lastReportCreatedAtRef.current = latest.createdAt
          return
        }
        const isNewer = lastReportCreatedAtRef.current
          ? new Date(latest.createdAt) > new Date(lastReportCreatedAtRef.current)
          : latest.id !== lastReportIdRef.current
        if (isNewer) {
          lastReportIdRef.current = latest.id
          lastReportCreatedAtRef.current = latest.createdAt
          if (!latest.directReport) return
          setNewReport({ name: latest.directReport.name })
          setNotifShowing(true)
          if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
          notifTimerRef.current = setTimeout(() => {
            setNotifShowing(false)
            setTimeout(() => setNewReport(null), 200)
          }, 6000)
        }
      } catch {}
    }
    check()
    const interval = setInterval(check, 30_000)
    return () => {
      clearInterval(interval)
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
    }
  }, [])

  function dismissNotif() {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
    setNotifShowing(false)
    setTimeout(() => setNewReport(null), 200)
  }

  const handleLogout = async () => {
    setPowerMenuOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const handleShutdown = async () => {
    setPowerMenuOpen(false)
    await playShutdownBeep()
    forceShutdown()
  }

  const toggleAirGap = async () => {
    const next = !airGapped
    setAirGapped(next)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'air_gap_mode', value: next ? 'true' : 'false' }),
    }).catch(() => {})
  }

  if (hidden) return null

  return (
    <>
      {/* New report toast */}
      {newReport && (
        <div
          className={cn(
            'fixed z-40 transition-all duration-200',
            notifShowing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
          )}
          style={{ top: 60, left: 8 }}
        >
          <Link
            href="/library"
            onClick={dismissNotif}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 whitespace-nowrap dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            Report received from <span className="font-medium ml-1">{newReport.name}</span>
          </Link>
        </div>
      )}

      {/* ── TOP NAV BAR ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 h-14 z-50 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 flex items-center px-4 gap-3">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <WalkieTalkie />
          <span
            className="text-xl text-gray-900 dark:text-white"
            style={{ fontFamily: 'var(--font-caveat)', fontWeight: 700 }}
          >
            operator
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 flex-1 min-w-0">
          {/* Standalone: Overview */}
          <Link
            href="/"
            className={cn(NAV_LINK_CLASS, pathname === '/' && NAV_ACTIVE_CLASS)}
          >
            <LayoutDashboard size={13} className="shrink-0" />
            Overview
          </Link>

          {/* Standalone: Situation Report */}
          <Link
            href="/dashboard"
            className={cn(NAV_LINK_CLASS, (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) && NAV_ACTIVE_CLASS)}
          >
            <BarChart2 size={13} className="shrink-0" />
            Situation Report
          </Link>

          {/* GROUP A: Intake */}
          <NavDropdown
            id="intake"
            label="Intake"
            icon={Inbox}
            items={intakeItems}
            isOpen={openGroup === 'intake'}
            onToggle={toggleGroup}
            onClose={closeGroups}
            activeArea={activeArea}
          />

          {/* GROUP B: Analysis */}
          <NavDropdown
            id="analysis"
            label="Analysis"
            icon={BarChart2Icon}
            items={analysisItems}
            isOpen={openGroup === 'analysis'}
            onToggle={toggleGroup}
            onClose={closeGroups}
            activeArea={activeArea}
          />

          {/* GROUP C: Synthesis */}
          <NavDropdown
            id="synthesis"
            label="Synthesis"
            icon={Layers}
            items={synthesisItems}
            isOpen={openGroup === 'synthesis'}
            onToggle={toggleGroup}
            onClose={closeGroups}
            activeArea={activeArea}
          />

          {/* Standalone: Dispatch */}
          <Link
            href="/dispatch"
            className={cn(NAV_LINK_CLASS, pathname.startsWith('/dispatch') && NAV_ACTIVE_CLASS)}
          >
            <MessageSquare size={13} className="shrink-0" />
            Dispatch
          </Link>

          {/* Standalone: Settings */}
          <Link
            href="/settings"
            className={cn(NAV_LINK_CLASS, pathname.startsWith('/settings') && NAV_ACTIVE_CLASS)}
          >
            <Settings size={13} className="shrink-0" />
            Settings
          </Link>
        </nav>

        {/* Active area badge — persists across pages when ?area= was set */}
        <Suspense fallback={null}>
          <ActiveAreaBadge onAreaChange={setActiveArea} />
        </Suspense>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {airGapped && (
            <span className="text-[10px] font-medium text-sky-500 dark:text-sky-400 leading-none">Air-gap</span>
          )}

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            title="Search (⌘K)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-gray-400 bg-gray-50 border border-gray-200 hover:border-gray-300 hover:text-gray-500 transition-colors dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-600"
          >
            <Search size={13} />
            <span className="text-[10px] text-gray-300 dark:text-zinc-600 font-mono">⌘K</span>
          </button>

          <UploadNotification />
          <StatusIndicator />

          {/* Power menu */}
          <div className="relative" ref={powerMenuRef}>
            <button
              onClick={() => setPowerMenuOpen(s => !s)}
              title="Power menu"
              className={cn(
                'flex items-center gap-0.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                powerMenuOpen
                  ? 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
              )}
            >
              <Power size={13} />
              <ChevronDown size={10} />
            </button>
            {powerMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px] z-50 dark:bg-zinc-900 dark:border-zinc-700">
                <button
                  onClick={() => { toggleTheme(); setPowerMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  onClick={() => { toggleAirGap(); setPowerMenuOpen(false) }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors',
                    airGapped
                      ? 'text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  )}
                >
                  <ShieldOff size={12} />
                  {airGapped ? 'Disable air-gap' : 'Enable air-gap'}
                </button>
                <div className="mx-2 my-1 h-px bg-gray-100 dark:bg-zinc-800" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <LogOut size={12} />
                  Log out
                </button>
                <div className="mx-2 my-1 h-px bg-gray-100 dark:bg-zinc-800" />
                <button
                  onClick={handleShutdown}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  <Power size={12} />
                  Shut down
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  )
}
