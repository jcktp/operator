'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FolderOpen, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'operator_active_area'

interface Props {
  onAreaChange?: (area: string | null) => void
}

export default function ActiveAreaBadge({ onAreaChange }: Props) {
  const searchParams = useSearchParams()
  const [activeArea, setActiveArea] = useState<string | null>(null)

  // Restore from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      setActiveArea(stored)
      onAreaChange?.(stored)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist whenever URL contains ?area=
  useEffect(() => {
    const area = searchParams.get('area')
    if (area) {
      sessionStorage.setItem(STORAGE_KEY, area)
      setActiveArea(area)
      onAreaChange?.(area)
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setActiveArea(null)
    onAreaChange?.(null)
  }

  if (!activeArea) return null

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium shrink-0',
        'bg-indigo-50 border-indigo-200 text-indigo-700',
        'dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300'
      )}
    >
      <FolderOpen size={11} className="shrink-0" />
      <span className="max-w-[120px] truncate">{activeArea}</span>
      <button
        onClick={dismiss}
        aria-label="Clear area filter"
        className="shrink-0 hover:text-indigo-900 dark:hover:text-indigo-100 transition-colors leading-none"
      >
        <X size={11} />
      </button>
    </div>
  )
}
