'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Database, Activity, AlertTriangle, HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'

type Level = 'ok' | 'warn' | 'error' | 'loading'

interface HealthData {
  status: Level
  ai: { status: Level; label: string; detail: string }
  memory: { rss: number; heap: number; status: Level; systemRamMb: number; warnMb: number; errorMb: number }
  cpu: { load: number; loadPct: number; status: Level }
  storage: { totalMb: number; totalGb: number; status: Level; thresholdGb: number }
}

const ICON_COLOR: Record<Level, string> = {
  ok:      'text-gray-400',
  warn:    'text-amber-500',
  error:   'text-red-500',
  loading: 'text-gray-300',
}

const TEXT_COLOR: Record<Level, string> = {
  ok:      'text-gray-400',
  warn:    'text-amber-500',
  error:   'text-red-500',
  loading: 'text-gray-300',
}

const DETAIL_COLOR: Record<Level, string> = {
  ok:      'text-gray-300',
  warn:    'text-amber-400',
  error:   'text-red-400',
  loading: 'text-gray-500',
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

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const aiStatus = data?.ai.status ?? 'loading'
  const memStatus = data?.memory.status ?? 'loading'
  const cpuStatus = data?.cpu.status ?? 'loading'
  const storageStatus = data?.storage.status ?? 'loading'

  const aiLabel = data
    ? data.ai.status === 'ok' ? data.ai.label : data.ai.label
    : '…'
  const memLabel = data ? `${data.memory.heap} MB` : '…'
  const cpuLabel = data ? `${data.cpu.loadPct}%` : '…'
  const storageLabel = data
    ? data.storage.totalMb < 1024
      ? `${data.storage.totalMb} MB`
      : `${data.storage.totalGb} GB`
    : '…'

  const hasIssue = data && data.status !== 'ok'

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors hover:bg-gray-50',
          hasIssue && 'bg-amber-50 hover:bg-amber-100'
        )}
        title="System status — click for details"
      >
        {/* AI */}
        <span className="flex items-center gap-1">
          <Bot size={12} className={cn(ICON_COLOR[aiStatus], aiStatus !== 'ok' && 'animate-pulse')} />
          <span className={cn('text-[11px] font-medium leading-none', TEXT_COLOR[aiStatus])}>{aiLabel}</span>
        </span>

        {/* Memory */}
        <span className="flex items-center gap-1">
          <Database size={11} className={ICON_COLOR[memStatus]} />
          <span className={cn('text-[11px] font-medium leading-none', TEXT_COLOR[memStatus])}>{memLabel}</span>
        </span>

        {/* Storage */}
        <span className="flex items-center gap-1">
          <HardDrive size={11} className={ICON_COLOR[storageStatus]} />
          <span className={cn('text-[11px] font-medium leading-none', TEXT_COLOR[storageStatus])}>{storageLabel}</span>
        </span>

        {/* CPU — only show when not ok to save space, always show value */}
        <span className="flex items-center gap-1">
          <Activity size={11} className={ICON_COLOR[cpuStatus]} />
          <span className={cn('text-[11px] font-medium leading-none', TEXT_COLOR[cpuStatus])}>{cpuLabel}</span>
        </span>

        {hasIssue && <AlertTriangle size={11} className="text-amber-500" />}
      </button>

      {open && data && (
        <div className="absolute right-0 top-full mt-2 z-50 w-60 bg-gray-950 text-white rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className={cn(
            'px-4 py-3 text-xs font-semibold',
            data.status === 'ok' ? 'bg-gray-900 text-gray-300' : data.status === 'warn' ? 'bg-amber-950 text-amber-300' : 'bg-red-950 text-red-300'
          )}>
            {data.status === 'ok' ? 'All systems operational' : data.status === 'warn' ? 'Attention needed' : 'Issue detected'}
          </div>

          <div className="p-3 space-y-3">
            {/* AI row */}
            <div className="flex items-start gap-2.5">
              <Bot size={13} className={cn('mt-0.5 shrink-0', ICON_COLOR[data.ai.status])} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{data.ai.label}</span>
                  <span className={cn('text-[11px]', DETAIL_COLOR[data.ai.status])}>
                    {data.ai.status === 'ok' ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{data.ai.detail}</p>
              </div>
            </div>

            {/* Memory row */}
            <div className="flex items-start gap-2.5">
              <Database size={13} className={cn('mt-0.5 shrink-0', ICON_COLOR[data.memory.status])} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">Memory</span>
                  <span className={cn('text-[11px]', DETAIL_COLOR[data.memory.status])}>
                    {data.memory.heap} MB heap
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {data.memory.rss} MB process RSS · {Math.round(data.memory.systemRamMb / 1024)} GB system RAM · warn at {data.memory.warnMb} MB
                </p>
              </div>
            </div>

            {/* Storage row */}
            <div className="flex items-start gap-2.5">
              <HardDrive size={13} className={cn('mt-0.5 shrink-0', ICON_COLOR[data.storage.status])} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">Storage</span>
                  <span className={cn('text-[11px]', DETAIL_COLOR[data.storage.status])}>
                    {data.storage.totalMb < 1024 ? `${data.storage.totalMb} MB` : `${data.storage.totalGb} GB`}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  used of {data.storage.thresholdGb} GB threshold
                </p>
              </div>
            </div>

            {/* CPU row */}
            <div className="flex items-start gap-2.5">
              <Activity size={13} className={cn('mt-0.5 shrink-0', ICON_COLOR[data.cpu.status])} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">CPU load</span>
                  <span className={cn('text-[11px]', DETAIL_COLOR[data.cpu.status])}>
                    {data.cpu.loadPct}%
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">1-min average · {data.cpu.load} load</p>
              </div>
            </div>
          </div>

          {/* Warning messages */}
          {data.status !== 'ok' && (
            <div className="border-t border-gray-800 px-3 py-2.5 space-y-1">
              {data.ai.status !== 'ok' && (
                <p className="text-[11px] text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {data.ai.status === 'error' ? `${data.ai.label} is not reachable — check Settings.` : `${data.ai.label}: ${data.ai.detail}`}
                </p>
              )}
              {data.memory.status !== 'ok' && (
                <p className="text-[11px] text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {data.memory.status === 'error' ? 'Heap memory is very high — consider restarting.' : 'Heap memory usage is elevated.'}
                </p>
              )}
              {data.cpu.status !== 'ok' && (
                <p className="text-[11px] text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  High CPU load — the system may feel slow.
                </p>
              )}
              {data.storage.status !== 'ok' && (
                <p className="text-[11px] text-amber-400 flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {data.storage.status === 'error' ? 'Storage is over the threshold — consider clearing old reports.' : 'Storage usage is approaching the threshold.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
