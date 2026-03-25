'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function monday(d: Date) {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  return m
}

export function buildPresets() {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const thisMonday = monday(today)
  const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7)
  const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1)

  return [
    { label: 'All time',   from: '',                               to: '' },
    { label: 'This week',  from: toISO(thisMonday),                to: toISO(today) },
    { label: 'Last week',  from: toISO(lastMonday),                to: toISO(lastSunday) },
    { label: 'This month', from: toISO(new Date(y, m, 1)),         to: toISO(today) },
    { label: 'Last month', from: toISO(new Date(y, m - 1, 1)),     to: toISO(new Date(y, m, 0)) },
    { label: 'This year',  from: toISO(new Date(y, 0, 1)),         to: toISO(today) },
    { label: 'Last year',  from: toISO(new Date(y - 1, 0, 1)),     to: toISO(new Date(y - 1, 11, 31)) },
  ]
}

export function currentLabel(from?: string, to?: string) {
  if (!from && !to) return 'All time'
  const match = buildPresets().find(p => p.from === (from ?? '') && p.to === (to ?? ''))
  if (match) return match.label
  if (from && to) return `${from} – ${to}`
  if (from) return `From ${from}`
  return `Until ${to}`
}

interface Props {
  activeFrom?: string
  activeTo?: string
  basePath: string
}

export default function PeriodDropdown({ activeFrom, activeTo, basePath }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [customFrom, setCustomFrom] = useState(activeFrom ?? '')
  const [customTo, setCustomTo] = useState(activeTo ?? '')
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setCustomFrom(activeFrom ?? ''); setCustomTo(activeTo ?? '') }, [activeFrom, activeTo])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function update(from: string | undefined, to: string | undefined) {
    const params = new URLSearchParams(searchParams.toString())
    if (from) params.set('from', from); else params.delete('from')
    if (to) params.set('to', to); else params.delete('to')
    router.push(`${basePath}?${params.toString()}`)
    setOpen(false)
  }

  const label = currentLabel(activeFrom, activeTo)
  const presets = buildPresets()

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 bg-white transition-colors focus:outline-none',
          open
            ? 'border-gray-400 text-gray-900'
            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900'
        )}
      >
        {label}
        <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => update(p.from || undefined, p.to || undefined)}
              className={cn(
                'w-full text-left px-3 py-2 text-xs transition-colors',
                label === p.label
                  ? 'text-gray-900 font-medium bg-gray-50'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              {p.label}
            </button>
          ))}

          <div className="mx-3 my-1 h-px bg-gray-100" />
          <div className="px-3 py-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Custom range</p>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:border-gray-400 min-w-0"
              />
              <span className="text-gray-300 text-xs shrink-0">→</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:border-gray-400 min-w-0"
              />
            </div>
            <button
              onClick={() => update(customFrom || undefined, customTo || undefined)}
              disabled={!customFrom && !customTo}
              className="w-full text-xs font-medium py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
