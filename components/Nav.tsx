'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Users, Settings, Library, Power, BarChart2, BookOpen, MessageSquare, Search, ChevronDown, LogOut } from 'lucide-react'
import { useShutdown } from '@/components/ShutdownProvider'
import { useState, useEffect, useRef } from 'react'
import WalkieTalkie from '@/components/WalkieTalkie'
import { useDispatch } from '@/components/DispatchContext'
import { playShutdownBeep } from '@/lib/beep'
import { useMode } from '@/components/ModeContext'
import StatusIndicator from '@/components/StatusIndicator'
import SearchModal from '@/components/SearchModal'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { shutdown, forceShutdown } = useShutdown()
  const { open: dispatchOpen } = useDispatch()
  const config = useMode()
  const [powerMenuOpen, setPowerMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
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

  const links = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard', label: 'Dashboard', icon: BarChart2 },
    { href: '/upload', label: config.navDocuments, icon: Upload },
    { href: '/library', label: config.navLibrary, icon: Library },
    { href: '/directs', label: config.navPeople, icon: Users },
    { href: '/journal', label: config.navJournal, icon: BookOpen },
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className={cn(dispatchOpen ? 'w-3/4' : 'w-full', 'px-4 sm:px-6')}>
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
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                  pathname === href || (href !== '/' && pathname.startsWith(href))
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Icon size={13} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
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
