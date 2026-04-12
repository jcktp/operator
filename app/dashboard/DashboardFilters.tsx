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
 'px-3 py-1.5 text-sm font-medium rounded-[4px] border transition-colors',
 activeArea === area
 ? 'bg-[var(--ink)] text-[var(--ink-contrast)] border-[var(--ink)]'
 : 'bg-[var(--surface)] text-[var(--text-body)] border-[var(--border)] hover:text-[var(--text-bright)] hover:border-[var(--border)] '
 )}
 >
 {area}
 </button>
 ))}

 {directs.length > 0 && (
 <select
 value={activeDirect ?? ''}
 onChange={e => update('direct', e.target.value || undefined)}
 className="text-sm border border-[var(--border)] rounded-[4px] px-3 py-1.5 bg-[var(--surface)] text-[var(--text-body)] focus:outline-none focus:border-[var(--border-mid)] cursor-pointer"
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
