'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Users, Settings, Library, Power, BarChart2, BookOpen, MessageSquare } from 'lucide-react'
import { useShutdown } from '@/components/ShutdownProvider'
import { useState } from 'react'
import WalkieTalkie from '@/components/WalkieTalkie'

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
  const { shutdown } = useShutdown()
  const [confirmingShutdown, setConfirmingShutdown] = useState(false)

  const handleShutdown = () => {
    if (!confirmingShutdown) {
      setConfirmingShutdown(true)
      setTimeout(() => setConfirmingShutdown(false), 3000)
    } else {
      shutdown()
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          <Link href="/" className="flex items-center gap-2.5 group">
            <WalkieTalkie />
            <span
              className="text-xl text-gray-900"
              style={{ fontFamily: 'var(--font-caveat)', fontWeight: 700 }}
            >
              operator
            </span>
          </Link>

          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  pathname === href || (href !== '/' && pathname.startsWith(href))
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}

            <div className="w-px h-4 bg-gray-200 mx-1" />

            {/* Power off */}
            <button
              onClick={handleShutdown}
              title={confirmingShutdown ? 'Click again to confirm shutdown' : 'Power off'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                confirmingShutdown
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              <Power size={15} />
              {confirmingShutdown && <span className="hidden sm:inline">Confirm</span>}
            </button>
          </div>

        </div>
      </div>
    </nav>
  )
}
