'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Direct { id: string; name: string }

interface Props {
  areas: string[]
  directs: Direct[]
  activeArea?: string
  activePeriod?: string
  activeDirect?: string
}

const PERIODS = [
  { label: '7d', value: '7' },
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
  { label: 'All', value: 'all' },
]

export default function DashboardFilters({ areas, directs, activeArea, activePeriod = '30', activeDirect }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function update(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/dashboard?${params.toString()}`)
  }

  function toggleArea(area: string) {
    update('area', activeArea === area ? undefined : area)
  }

  function togglePeriod(period: string) {
    update('period', period)
  }

  function toggleDirect(id: string) {
    update('direct', activeDirect === id ? undefined : id)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Period selector */}
      <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => togglePeriod(p.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              activePeriod === p.value
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Area pills */}
      {areas.map(area => (
        <button
          key={area}
          onClick={() => toggleArea(area)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
            activeArea === area
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-500 border-gray-200 hover:text-gray-900 hover:border-gray-300'
          )}
        >
          {area}
        </button>
      ))}

      {/* Direct report selector */}
      {directs.length > 0 && (
        <select
          value={activeDirect ?? ''}
          onChange={e => update('direct', e.target.value || undefined)}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-500 focus:outline-none focus:border-gray-400 cursor-pointer"
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
