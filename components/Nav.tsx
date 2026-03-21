'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Users, Settings, FolderOpen, Power } from 'lucide-react'
import { useShutdown } from '@/components/ShutdownProvider'
import { useState } from 'react'

const links = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/upload', label: 'Add Report', icon: Upload },
  { href: '/directs', label: 'Directs', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Nav() {
  const pathname = usePathname()
  const { shutdown } = useShutdown()
  const [confirmingShutdown, setConfirmingShutdown] = useState(false)
  const [openingFolder, setOpeningFolder] = useState(false)

  const handleShutdown = () => {
    if (!confirmingShutdown) {
      setConfirmingShutdown(true)
      setTimeout(() => setConfirmingShutdown(false), 3000)
    } else {
      shutdown()
    }
  }

  const handleOpenFolder = async () => {
    setOpeningFolder(true)
    await fetch('/api/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    setTimeout(() => setOpeningFolder(false), 1000)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="font-semibold text-sm tracking-tight text-gray-900">
            operator
          </Link>

          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}

            {/* Divider */}
            <div className="w-px h-4 bg-gray-200 mx-1" />

            {/* Open reports folder */}
            <button
              onClick={handleOpenFolder}
              title="Open reports folder"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                openingFolder
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <FolderOpen size={15} />
              <span className="hidden sm:inline">Reports</span>
            </button>

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
              <span className="hidden sm:inline">{confirmingShutdown ? 'Confirm' : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
