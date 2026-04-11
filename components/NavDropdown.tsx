'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type React from 'react'

// Accepts both lucide ForwardRefExoticComponent icons and the app's custom plain-function icons
type AnyIcon = React.ComponentType<{ size?: number; className?: string }>

export interface NavGroupItem {
  href: string
  label: string
  icon: AnyIcon
  hasNotifDot?: boolean
  onClick?: () => void
}

export interface NavDropdownProps {
  id: string
  label: string
  icon: AnyIcon
  items: NavGroupItem[]
  isOpen: boolean
  onToggle: (id: string) => void
  onClose: () => void
  activeArea?: string | null
}

// hrefs that receive ?area= when an active area is set
const AREA_AWARE_HREFS = new Set(['/library', '/dashboard', '/entities'])

export default function NavDropdown({
  id,
  label,
  icon: GroupIcon,
  items,
  isOpen,
  onToggle,
  onClose,
  activeArea,
}: NavDropdownProps) {
  const pathname = usePathname()
  const dropRef = useRef<HTMLDivElement>(null)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!isOpenRef.current) return
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [onClose])

  const groupIsActive = items.some(
    item => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
  )

  const resolveHref = (href: string) =>
    activeArea && AREA_AWARE_HREFS.has(href)
      ? `${href}?area=${encodeURIComponent(activeArea)}`
      : href

  return (
    <div className="relative shrink-0" ref={dropRef} data-nav-group={id}>
      <button
        onClick={() => onToggle(id)}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors',
          groupIsActive || isOpen
            ? 'font-bold text-white'
            : 'font-normal text-white/55 hover:text-white'
        )}
      >
        <GroupIcon size={13} className="shrink-0" />
        {label}
        <ChevronDown
          size={10}
          className={cn('transition-transform duration-150', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-[4px] shadow-lg py-1 min-w-[180px] z-50 dark:bg-zinc-900 dark:border-zinc-700">
          {items.map(item => {
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={resolveHref(item.href)}
                onClick={() => {
                  item.onClick?.()
                  onClose()
                }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors',
                  isActive
                    ? 'bg-gray-50 text-gray-900 dark:bg-zinc-800 dark:text-zinc-50'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                )}
              >
                <Icon size={13} className="shrink-0" />
                {item.label}
                {item.hasNotifDot && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
