'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import PeriodDropdown from '@/components/PeriodDropdown'

interface Direct { id: string; name: string }

interface Props {
  areas: string[]
  directs: Direct[]
  activeArea?: string
  activeFrom?: string
  activeTo?: string
  activeDirect?: string
}

export default function DashboardFilters({ areas, directs, activeArea, activeFrom, activeTo, activeDirect }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function update(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value); else params.delete(key)
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodDropdown activeFrom={activeFrom} activeTo={activeTo} basePath="/dashboard" />

      {areas.map(area => (
        <button
          key={area}
          onClick={() => update('area', activeArea === area ? undefined : area)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
            activeArea === area
              ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-gray-900 dark:border-zinc-100'
              : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 border-gray-200 dark:border-zinc-700 hover:text-gray-900 dark:hover:text-zinc-50 hover:border-gray-300 dark:hover:border-zinc-500'
          )}
        >
          {area}
        </button>
      ))}

      {directs.length > 0 && (
        <select
          value={activeDirect ?? ''}
          onChange={e => update('direct', e.target.value || undefined)}
          className="text-sm border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 focus:outline-none focus:border-gray-400 dark:focus:border-zinc-500 cursor-pointer"
        >
          <option value="">All directs</option>
          {directs.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
