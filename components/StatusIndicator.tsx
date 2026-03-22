'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type Level = 'ok' | 'warn' | 'error' | 'loading'

interface HealthData {
  status: Level
  ai: { status: Level; label: string; detail: string }
  memory: { rss: number; heap: number; status: Level }
  cpu: { load: number; loadPct: number; status: Level }
}

const DOT: Record<Level, string> = {
  ok:      'bg-green-400',
  warn:    'bg-amber-400',
  error:   'bg-red-400',
  loading: 'bg-gray-300',
}

const LABEL: Record<Level, string> = {
  ok:      'text-green-600',
  warn:    'text-amber-500',
  error:   'text-red-500',
  loading: 'text-gray-400',
}

const TEXT: Record<Level, string> = {
  ok:      'All systems operational',
  warn:    'Attention needed',
  error:   'Issue detected',
  loading: 'Checking…',
}

function Row({ label, value, status }: { label: string; value: string; status: Level }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-400">{label}</span>
      <span className={cn('font-medium', LABEL[status])}>{value}</span>
    </div>
  )
}

export default function StatusIndicator() {
  const [data, setData] = useState<HealthData | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const poll = () => {
    fetch('/api/health')
      .then(r => r.json())
      .then((d: HealthData) => setData(d))
      .catch(() => {})
  }

  useEffect(() => {
    poll()
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const status = data?.status ?? 'loading'
  const pulsing = status === 'warn' || status === 'error'

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen(v => !v)}
        title={TEXT[status]}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
      >
        <span className="relative flex h-2 w-2">
          {pulsing && (
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', DOT[status])} />
          )}
          <span className={cn('relative inline-flex rounded-full h-2 w-2', DOT[status])} />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-gray-950 text-white rounded-xl shadow-2xl p-3 space-y-2.5">
          {/* Overall */}
          <div className="flex items-center gap-2 pb-2 border-b border-gray-800">
            <span className={cn('relative flex h-2 w-2 shrink-0')}>
              {pulsing && <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', DOT[status])} />}
              <span className={cn('relative inline-flex rounded-full h-2 w-2', DOT[status])} />
            </span>
            <span className={cn('text-xs font-medium', LABEL[status])}>{TEXT[status]}</span>
          </div>

          {data ? (
            <div className="space-y-1.5 text-xs">
              <Row
                label={data.ai.label}
                value={data.ai.status === 'ok' ? data.ai.detail : data.ai.detail || 'Offline'}
                status={data.ai.status}
              />
              <Row
                label="Memory"
                value={`${data.memory.rss} MB`}
                status={data.memory.status}
              />
              <Row
                label="CPU load"
                value={`${data.cpu.loadPct}%`}
                status={data.cpu.status}
              />
            </div>
          ) : (
            <p className="text-xs text-gray-500">Loading…</p>
          )}

          {/* Warnings */}
          {data && (
            <div className="space-y-1 pt-1 border-t border-gray-800">
              {data.ai.status !== 'ok' && (
                <p className="text-[11px] text-amber-400">
                  {data.ai.status === 'error' ? `${data.ai.label} is not reachable — check Settings.` : `${data.ai.label}: ${data.ai.detail}`}
                </p>
              )}
              {data.memory.status !== 'ok' && (
                <p className="text-[11px] text-amber-400">
                  {data.memory.status === 'error' ? 'Memory usage critical — consider restarting.' : 'Memory usage is high.'}
                </p>
              )}
              {data.cpu.status !== 'ok' && (
                <p className="text-[11px] text-amber-400">High CPU load — system may be slow.</p>
              )}
              {data.status === 'ok' && (
                <p className="text-[11px] text-gray-500">No issues detected.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
