'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Users, Settings, Library, Power, BarChart2, BookOpen, MessageSquare, Search, ChevronDown, LogOut, Radio } from '@/components/icons'
import { Network, Users as UsersIcon, BarChart2 as BarChart2Icon, Clock, Inbox, FolderOpen, ShieldCheck, GitFork, CheckSquare, FileSearch, ShieldAlert, Lightbulb, Ban, ListChecks, ScrollText, CalendarClock, Quote, Layers, Users2, UserSearch, ScanSearch, MapPin, GitCompare, History, AudioLines, GraduationCap, Radar, Globe } from 'lucide-react'
import type React from 'react'

type AnyIcon = React.ComponentType<{ size?: number; className?: string }>
const EXTRA_NAV_ICONS: Record<string, AnyIcon> = {
  Network,
  Users: UsersIcon,
  BarChart2: BarChart2Icon,
  BookOpen,
  GraduationCap,
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
  UserSearch,
  ScanSearch,
  MapPin,
  GitCompare,
  History,
  AudioLines,
  Radar,
  Globe,
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
import { Moon, Sun, ShieldOff, FlaskConical, Bug } from 'lucide-react'

// Kept for any imports that reference it; top nav has no sidebar
export const SIDEBAR_W = 0

const NAV_LINK_CLASS =
  'flex items-center px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors shrink-0 text-white/55 hover:text-white font-normal border-b-2 border-transparent'
const NAV_ACTIVE_CLASS =
  'font-semibold text-white border-b-2 border-white/60'

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

  const byLabel = (a: NavGroupItem, b: NavGroupItem) => a.label.localeCompare(b.label)

  // GROUP A: Intake — Add source + Pulse (if not in notebook) + intake-group extras. Sorted alphabetically.
  const intakeItems: NavGroupItem[] = [
    { href: '/upload', label: 'Add source', icon: Upload },
    ...(!pulseInNotebook ? [{ href: '/pulse', label: 'Pulse', icon: Radio }] : []),
    ...extraNavItems
      .filter(i => i.group === 'intake')
      .map(i => ({ href: i.href, label: i.label, icon: EXTRA_NAV_ICONS[i.icon] ?? Network })),
  ].sort(byLabel)

  // Research dropdown — all tools live as flat tabs on /research
  const researchItems: NavGroupItem[] = [
    { href: '/research',                 label: 'Wayback Machine',  icon: History },
    { href: '/research?tab=diff',        label: 'Document diff',    icon: Globe   },
    { href: '/research?tab=username',    label: 'Username search',  icon: Globe   },
    { href: '/research?tab=osint',       label: 'OSINT directory',  icon: Globe   },
    { href: '/research?tab=monitor',     label: 'Web monitor',      icon: Radar   },
  ].sort(byLabel)

  // GROUP B: Analysis — analysis-group extras + (people if not in notebook). Sorted alphabetically.
  const analysisItems: NavGroupItem[] = [
    ...extraNavItems
      .filter(i => !i.group || i.group === 'analysis')
      .map(i => ({ href: i.href, label: i.label, icon: EXTRA_NAV_ICONS[i.icon] ?? Network })),
    ...(!peopleInNotebook ? [{ href: '/directs', label: config.navPeople, icon: Users }] : []),
  ].sort(byLabel)

  // GROUP B2: Investigate — investigate-group extras (only shown when non-empty). Sorted alphabetically.
  const investigateItems: NavGroupItem[] = extraNavItems
    .filter(i => i.group === 'investigate')
    .map(i => ({ href: i.href, label: i.label, icon: EXTRA_NAV_ICONS[i.icon] ?? Network }))
    .sort(byLabel)

  // GROUP C: Notebook — journal + (pulse if pulseInNotebook) + (people if peopleInNotebook) + notebook-group extras.
  // Journal stays first (anchor item), the rest sorted alphabetically.
  const notebookExtras: NavGroupItem[] = [
    ...(pulseInNotebook  ? [{ href: '/pulse',   label: 'Pulse',          icon: Radio }] : []),
    ...(peopleInNotebook ? [{ href: '/directs', label: config.navPeople, icon: Users }] : []),
    ...extraNavItems
      .filter(i => i.group === 'notebook')
      .map(i => ({ href: i.href, label: i.label, icon: EXTRA_NAV_ICONS[i.icon] ?? Network })),
  ].sort(byLabel)
  const notebookItems: NavGroupItem[] = [
    { href: '/journal', label: config.navJournal, icon: BookOpen },
    ...notebookExtras,
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
      <header className="fixed top-0 inset-x-0 h-14 z-50 bg-[var(--nav-bg)] flex items-center px-4 gap-3">

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
          <Link href="/" className={cn(NAV_LINK_CLASS, pathname === '/' && NAV_ACTIVE_CLASS)}>
            Overview
          </Link>

          {/* Standalone: Intelligence Brief (was Situation Report) */}
          <Link
            href="/dashboard"
            className={cn(NAV_LINK_CLASS, (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) && NAV_ACTIVE_CLASS)}
          >
            Intelligence Brief
          </Link>

          {/* Standalone: Sources */}
          <Link
            href="/sources"
            className={cn(
              NAV_LINK_CLASS,
              (pathname === '/sources' || pathname.startsWith('/library') || pathname.startsWith('/files') || pathname.startsWith('/upload')) && NAV_ACTIVE_CLASS
            )}
          >
            Sources
          </Link>

          {/* Research dropdown — Wayback/diff/username search, OSINT directory, Web Monitor */}
          <NavDropdown
            id="research"
            label="Research"
            icon={History}
            items={researchItems}
            isOpen={openGroup === 'research'}
            onToggle={toggleGroup}
            onClose={closeGroups}
            activeArea={activeArea}
          />

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

          {/* GROUP B2: Investigate (only shown in modes that have investigate items) */}
          {investigateItems.length > 0 && (
            <NavDropdown
              id="investigate"
              label="Investigate"
              icon={FlaskConical}
              items={investigateItems}
              isOpen={openGroup === 'investigate'}
              onToggle={toggleGroup}
              onClose={closeGroups}
              activeArea={activeArea}
            />
          )}

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
            <Link href="/journal" className={cn(NAV_LINK_CLASS, pathname.startsWith('/journal') && NAV_ACTIVE_CLASS)}>
              {config.navJournal}
            </Link>
          )}

          {/* Standalone: Stories */}
          <Link href="/stories" className={cn(NAV_LINK_CLASS, pathname.startsWith('/stories') && NAV_ACTIVE_CLASS)}>
            Stories
          </Link>

          {/* Standalone: Dispatch */}
          <Link href="/dispatch" className={cn(NAV_LINK_CLASS, pathname.startsWith('/dispatch') && NAV_ACTIVE_CLASS)}>
            Dispatch
          </Link>

          {/* Collab — always in nav; badge appears when enabled + has unread */}
          <CollabNotificationBell alwaysShow />
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
            type="button"
            onClick={() => setSearchOpen(true)}
            title="Search (⌘K)"
            aria-label="Search (⌘K)"
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
              type="button"
              onClick={() => setPowerMenuOpen(s => !s)}
              title="Power menu"
              aria-label="Power menu"
              aria-expanded={powerMenuOpen}
              aria-haspopup="true"
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
              <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-lg py-1 min-w-[160px] z-50">
                <Link
                  href="/settings"
                  onClick={() => setPowerMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Settings size={12} />
                  Settings
                </Link>
                <div className="mx-2 my-1 h-px bg-[var(--border)]" />
                <button
                  type="button"
                  onClick={() => { toggleTheme(); setPowerMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  onClick={() => { toggleAirGap(); setPowerMenuOpen(false) }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors',
                    airGapped
                      ? 'text-sky-500 hover:bg-[var(--blue-dim)]'
                      : 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
                  )}
                >
                  <ShieldOff size={12} />
                  {airGapped ? 'Disable air-gap' : 'Enable air-gap'}
                </button>
                <div className="mx-2 my-1 h-px bg-[var(--border)]" />
                <a
                  href="https://github.com/jcktp/operator/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setPowerMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Bug size={12} />
                  Report an issue
                </a>
                <div className="mx-2 my-1 h-px bg-[var(--border)]" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  <LogOut size={12} />
                  Log out
                </button>
                <div className="mx-2 my-1 h-px bg-[var(--border)]" />
                <button
                  type="button"
                  onClick={handleShutdown}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--red)] hover:bg-[var(--red-dim)] transition-colors"
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
