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
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-200 hover:text-gray-900 hover:border-gray-300'
          )}
        >
          {area}
        </button>
      ))}

      {directs.length > 0 && (
        <select
          value={activeDirect ?? ''}
          onChange={e => update('direct', e.target.value || undefined)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-gray-400 cursor-pointer"
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
