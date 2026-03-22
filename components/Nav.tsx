'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Users, Settings, Library, Power, BarChart2, BookOpen, MessageSquare, Trash2, Search } from 'lucide-react'
import { useShutdown } from '@/components/ShutdownProvider'
import { useState, useEffect } from 'react'
import WalkieTalkie from '@/components/WalkieTalkie'
import { useDispatch } from '@/components/DispatchContext'
import StatusIndicator from '@/components/StatusIndicator'
import SearchModal from '@/components/SearchModal'

const links = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { href: '/upload', label: 'Add Report', icon: Upload },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/directs', label: 'Directs', icon: Users },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/dispatch', label: 'Dispatch', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const { shutdown } = useShutdown()
  const { open: dispatchOpen } = useDispatch()
  const [confirmingShutdown, setConfirmingShutdown] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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

  const handleShutdown = () => {
    if (!confirmingShutdown) {
      setConfirmingShutdown(true)
      setTimeout(() => setConfirmingShutdown(false), 3000)
    } else {
      shutdown()
    }
  }

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

          {/* Power off — right side */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <StatusIndicator />
            <div className="w-px h-4 bg-gray-200" />
            {confirmingShutdown && (
              <>
                <button
                  onClick={() => { setConfirmingShutdown(false); router.push('/settings#danger') }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Uninstall Operator"
                >
                  <Trash2 size={12} />
                  <span className="hidden sm:inline">Uninstall</span>
                </button>
                <div className="w-px h-4 bg-gray-200" />
              </>
            )}
            <button
              onClick={handleShutdown}
              title={confirmingShutdown ? 'Click again to confirm shutdown' : 'Power off'}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                confirmingShutdown
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <Power size={13} />
              {confirmingShutdown && <span className="hidden sm:inline">Shut down</span>}
            </button>
          </div>

        </div>
      </div>
    </nav>
    {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  )
}
