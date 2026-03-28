'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Users, Settings, Library, Power, BarChart2, BookOpen, MessageSquare, Search, ChevronDown, LogOut, Radio } from '@/components/icons'
import { Network, Users as UsersIcon, BarChart2 as BarChart2Icon, Clock, type LucideIcon } from 'lucide-react'

const EXTRA_NAV_ICONS: Record<string, LucideIcon> = {
  Network,
  Users: UsersIcon,
  BarChart2: BarChart2Icon,
  Clock,
}
import { useShutdown } from '@/components/ShutdownProvider'
import { useState, useEffect, useRef } from 'react'
import WalkieTalkie from '@/components/WalkieTalkie'
import { playShutdownBeep } from '@/lib/beep'
import { useMode } from '@/components/ModeContext'
import StatusIndicator from '@/components/StatusIndicator'
import SearchModal from '@/components/SearchModal'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { shutdown, forceShutdown } = useShutdown()

  const config = useMode()
  const [powerMenuOpen, setPowerMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const powerMenuRef = useRef<HTMLDivElement>(null)
  const libraryWrapRef = useRef<HTMLDivElement>(null)
  const [newReport, setNewReport] = useState<{ name: string } | null>(null)
  const [notifShowing, setNotifShowing] = useState(false)
  const [notifLeft, setNotifLeft] = useState(0)
  const lastReportIdRef = useRef<string | null>(null)
  const lastReportCreatedAtRef = useRef<string | null>(null)
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const links = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard', label: 'Dashboard', icon: BarChart2 },
    { href: '/upload', label: config.navDocuments, icon: Upload },
    { href: '/library', label: config.navLibrary, icon: Library },
    ...config.features.extraNavItems.map(item => ({ href: item.href, label: item.label, icon: EXTRA_NAV_ICONS[item.icon] ?? Network })),
    { href: '/directs', label: config.navPeople, icon: Users },
    { href: '/journal', label: config.navJournal, icon: BookOpen },
    { href: '/pulse', label: 'Pulse', icon: Radio },
    { href: '/dispatch', label: 'Dispatch', icon: MessageSquare },
    { href: '/settings', label: 'Settings', icon: Settings },
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
          // Only notify for remote submissions (reports that have a directReport attached)
          if (!latest.directReport) return
          const name = latest.directReport.name
          const rect = libraryWrapRef.current?.getBoundingClientRect()
          if (rect) setNotifLeft(rect.left)
          setNewReport({ name })
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

  const dismissNotif = () => {
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

  if (hidden) return null

  return (
    <>
    {newReport && (
      <div
        className={cn(
          'fixed z-40 transition-all duration-200',
          notifShowing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
        )}
        style={{ top: 60, left: notifLeft }}
      >
        <Link
          href="/library"
          onClick={dismissNotif}
          className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 whitespace-nowrap"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          Report received from <span className="font-medium ml-1">{newReport.name}</span>
        </Link>
      </div>
    )}
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0 mr-8">
            <WalkieTalkie />
            <span
              className="text-xl text-gray-900"
              style={{ fontFamily: 'var(--font-caveat)', fontWeight: 700 }}
            >
              operator
            </span>
          </Link>

          {/* Nav links — left-aligned, fills remaining space */}
          <div className="flex items-center gap-0.5 flex-1">
            {links.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
              const linkClass = cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              )
              if (href === '/library') {
                return (
                  <div key={href} ref={libraryWrapRef}>
                    <Link href={href} className={linkClass} onClick={dismissNotif}>
                      <Icon size={13} />
                      <span className="hidden sm:inline">{label}</span>
                      {newReport && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 ml-0.5" />}
                    </Link>
                  </div>
                )
              }
              return (
                <Link key={href} href={href} className={linkClass}>
                  <Icon size={13} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              )
            })}
          </div>

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            title="Search (⌘K)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
          >
            <Search size={13} />
            <span className="hidden lg:inline text-gray-300">⌘K</span>
          </button>

          {/* Power menu — right side */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <StatusIndicator />
            <div className="w-px h-4 bg-gray-200" />
            <div className="relative" ref={powerMenuRef}>
              <button
                onClick={() => setPowerMenuOpen(s => !s)}
                title="Power menu"
                className={cn(
                  'flex items-center gap-0.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                  powerMenuOpen ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                <Power size={13} />
                <ChevronDown size={10} />
              </button>
              {powerMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px] z-50">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut size={12} />
                    Log out
                  </button>
                  <div className="mx-2 my-1 h-px bg-gray-100" />
                  <button
                    onClick={handleShutdown}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Power size={12} />
                    Shut down
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </nav>
    {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  )
}
