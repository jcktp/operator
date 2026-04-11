'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Users, Settings, Library, Power, BarChart2, BookOpen, MessageSquare, Search, ChevronDown, LogOut, Radio } from '@/components/icons'
import { Network, Users as UsersIcon, BarChart2 as BarChart2Icon, Clock, Inbox, FolderOpen, ShieldCheck, GitFork, CheckSquare, FileSearch, ShieldAlert, Lightbulb, Ban, ListChecks, ScrollText, CalendarClock, Quote, Layers, Users2 } from 'lucide-react'
import type React from 'react'

type AnyIcon = React.ComponentType<{ size?: number; className?: string }>
const EXTRA_NAV_ICONS: Record<string, AnyIcon> = {
  Network,
  Users: UsersIcon,
  BarChart2: BarChart2Icon,
  Clock,
  ShieldCheck,
  GitFork,
  CheckSquare,
  FileSearch,
  ShieldAlert,
  Lightbulb,
  Ban,
  ListChecks,
  ScrollText,
  CalendarClock,
  Quote,
  Layers,
  Users2,
}
import { useShutdown } from '@/components/ShutdownProvider'
import { useState, useEffect, useRef, Suspense } from 'react'
import WalkieTalkie from '@/components/WalkieTalkie'
import { playShutdownBeep } from '@/lib/beep'
import { useMode } from '@/components/ModeContext'
import { useTheme } from '@/components/ThemeProvider'
import StatusIndicator from '@/components/StatusIndicator'
import UploadNotification from '@/components/UploadNotification'
import dynamic from 'next/dynamic'
const CollabNotificationBell = dynamic(() => import('@/components/collab/CollabNotificationBell'), { ssr: false })
import SearchModal from '@/components/SearchModal'
import NavDropdown, { type NavGroupItem } from '@/components/NavDropdown'
import ActiveAreaBadge from '@/components/ActiveAreaBadge'
import ProjectSwitcher from '@/components/ProjectSwitcher'
import { Moon, Sun, ShieldOff } from 'lucide-react'

// Kept for any imports that reference it; top nav has no sidebar
export const SIDEBAR_W = 0

const NAV_LINK_CLASS =
  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors shrink-0 text-white/55 hover:text-white font-normal'
const NAV_ACTIVE_CLASS =
  'font-bold text-white'

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

  const { extraNavItems, pulseInNotebook, peopleInNotebook } = config.features

  // GROUP A: Intake — upload + (pulse if not in notebook) + files + intake-group extras
  const intakeItems: NavGroupItem[] = [
    { href: '/upload', label: config.navDocuments, icon: Upload },
    ...(!pulseInNotebook ? [{ href: '/pulse', label: 'Pulse', icon: Radio }] : []),
    { href: '/files', label: 'Files', icon: FolderOpen },
    ...extraNavItems
      .filter(i => i.group === 'intake')
      .map(i => ({ href: i.href, label: i.label, icon: EXTRA_NAV_ICONS[i.icon] ?? Network })),
  ]

  // GROUP B: Analysis — library + analysis-group extras + (people if not in notebook)
  const analysisItems: NavGroupItem[] = [
    { href: '/library', label: config.navLibrary, icon: Library },
    ...extraNavItems
      .filter(i => !i.group || i.group === 'analysis')
      .map(i => ({ href: i.href, label: i.label, icon: EXTRA_NAV_ICONS[i.icon] ?? Network })),
    ...(!peopleInNotebook ? [{ href: '/directs', label: config.navPeople, icon: Users }] : []),
  ]

  // GROUP C: Notebook — journal + (pulse if pulseInNotebook) + (people if peopleInNotebook) + notebook-group extras
  const notebookItems: NavGroupItem[] = [
    { href: '/journal', label: config.navJournal, icon: BookOpen },
    ...(pulseInNotebook  ? [{ href: '/pulse',   label: 'Pulse',          icon: Radio }] : []),
    ...(peopleInNotebook ? [{ href: '/directs', label: config.navPeople, icon: Users }] : []),
    ...extraNavItems
      .filter(i => i.group === 'notebook')
      .map(i => ({ href: i.href, label: i.label, icon: EXTRA_NAV_ICONS[i.icon] ?? Network })),
  ]
  const notebookIsDropdown = notebookItems.length > 1


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
      {/* ── TOP NAV BAR ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 h-14 z-50 bg-black flex items-center px-4 gap-3">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <WalkieTalkie />
          <span
            className="text-xl text-white"
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

          {/* Notebook — dropdown when mode adds extra items (journalism), standalone otherwise */}
          {notebookIsDropdown ? (
            <NavDropdown
              id="notebook"
              label={config.navJournal}
              icon={BookOpen}
              items={notebookItems}
              isOpen={openGroup === 'notebook'}
              onToggle={toggleGroup}
              onClose={closeGroups}
              activeArea={activeArea}
            />
          ) : (
            <Link
              href="/journal"
              className={cn(NAV_LINK_CLASS, pathname.startsWith('/journal') && NAV_ACTIVE_CLASS)}
            >
              <BookOpen size={13} className="shrink-0" />
              {config.navJournal}
            </Link>
          )}

          {/* Standalone: Dispatch */}
          <Link
            href="/dispatch"
            className={cn(NAV_LINK_CLASS, pathname.startsWith('/dispatch') && NAV_ACTIVE_CLASS)}
          >
            <MessageSquare size={13} className="shrink-0" />
            Dispatch
          </Link>

          {/* Standalone: Projects */}
          <Link
            href="/projects"
            className={cn(NAV_LINK_CLASS, pathname.startsWith('/projects') && NAV_ACTIVE_CLASS)}
          >
            <FolderOpen size={13} className="shrink-0" />
            {config.projectLabelPlural}
          </Link>

          {/* Collab — only renders when collab is enabled */}
          <CollabNotificationBell />

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
            <span className="text-[10px] font-medium text-sky-400 leading-none">Air-gap</span>
          )}

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            title="Search (⌘K)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-white/50 bg-white/8 border border-white/15 hover:border-white/30 hover:text-white/70 transition-colors"
          >
            <Search size={13} />
            <span className="text-[10px] text-white/30 font-mono">⌘K</span>
          </button>

          <ProjectSwitcher />
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
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              )}
            >
              <Power size={13} />
              <ChevronDown size={10} />
            </button>
            {powerMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-[4px] shadow-lg py-1 min-w-[160px] z-50 dark:bg-zinc-900 dark:border-zinc-700">
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
