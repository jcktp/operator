'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Database, Activity, AlertTriangle, HardDrive, Cpu, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Level = 'ok' | 'warn' | 'error' | 'loading'

interface HealthData {
  status: Level
  ai:      { status: Level; label: string; detail: string }
  memory:  { rss: number; heap: number; status: Level; systemRamMb: number; warnMb: number; errorMb: number }
  cpu:     { load: number; loadPct: number; status: Level; cores: number }
  storage: { totalMb: number; totalGb: number; status: Level; thresholdGb: number }
  machine: {
    status: Level
    ramGb: number; ramStatus: Level; ramTier: string; ramNote: string
    cores: number; coresStatus: Level; cpuModel: string; arch: string
  }
}

// ── Trigger styling (lives in the dark nav bar) ──────────────────────────────

const TRIGGER_DOT: Record<Level, string> = {
  ok:      'bg-green-500',
  warn:    'bg-amber-500',
  error:   'bg-red-500',
  loading: 'bg-white/30',
}

const TRIGGER_LABEL: Record<Level, string> = {
  ok:      'Stable',
  warn:    'Degraded',
  error:   'Issue',
  loading: '…',
}

// ── Dropdown row styling (light surface) ─────────────────────────────────────

const ROW_DOT: Record<Level, string> = {
  ok:      'bg-[var(--green)]',
  warn:    'bg-[var(--amber)]',
  error:   'bg-[var(--red)]',
  loading: 'bg-[var(--text-muted)]',
}

const ROW_ICON: Record<Level, string> = {
  ok:      'text-[var(--text-muted)]',
  warn:    'text-[var(--amber)]',
  error:   'text-[var(--red)]',
  loading: 'text-[var(--text-muted)]',
}

const ROW_DETAIL: Record<Level, string> = {
  ok:      'text-[var(--text-muted)]',
  warn:    'text-[var(--amber)]',
  error:   'text-[var(--red)]',
  loading: 'text-[var(--text-muted)]',
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

  const overall: Level = data?.status ?? 'loading'

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="System status — click for details"
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors',
          open
            ? 'bg-white/15 text-white'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        )}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            TRIGGER_DOT[overall],
            overall !== 'ok' && overall !== 'loading' && 'animate-pulse',
          )}
        />
        <span className="font-medium leading-none">{TRIGGER_LABEL[overall]}</span>
        <ChevronDown size={10} className="opacity-50" />
      </button>

      {open && data && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-xl overflow-hidden">
          {/* Header */}
          <div className={cn(
            'px-4 py-3 text-xs font-semibold border-b border-[var(--border)] flex items-center gap-2',
            data.status === 'ok'    ? 'text-[var(--text-body)]' :
            data.status === 'warn'  ? 'text-[var(--amber)]' :
                                      'text-[var(--red)]'
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', ROW_DOT[data.status])} />
            {data.status === 'ok' ? 'All systems operational' : data.status === 'warn' ? 'Attention needed' : 'Issue detected'}
          </div>

          <div className="p-3 space-y-3">
            <StatusRow
              icon={<Bot size={13} />}
              status={data.ai.status}
              label={data.ai.label}
              valueText={data.ai.status === 'ok' ? 'Online' : data.ai.status === 'loading' ? '…' : 'Offline'}
              detail={data.ai.detail}
            />

            <StatusRow
              icon={<Cpu size={13} />}
              status={data.machine?.status ?? 'loading'}
              label="Machine"
              valueText={`${data.machine.ramGb} GB · ${data.machine.cores} cores`}
              detail={`${data.machine.cpuModel} · ${data.machine.arch} · ${data.machine.ramTier}`}
            />

            <StatusRow
              icon={<Database size={13} />}
              status={data.memory.status}
              label="Memory"
              valueText={`${data.memory.heap} MB`}
              detail={`${data.memory.rss} MB process · warn at ${data.memory.warnMb} MB · ${Math.round(data.memory.systemRamMb / 1024)} GB system RAM`}
            />

            <StatusRow
              icon={<HardDrive size={13} />}
              status={data.storage.status}
              label="Storage"
              valueText={data.storage.totalMb < 1024 ? `${data.storage.totalMb} MB` : `${data.storage.totalGb} GB`}
              detail={`used of ${data.storage.thresholdGb} GB threshold`}
            />

            <StatusRow
              icon={<Activity size={13} />}
              status={data.cpu.status}
              label="CPU load"
              valueText={`${data.cpu.loadPct}%`}
              detail={`1-min avg ${data.cpu.load} · ${data.cpu.cores} cores`}
            />
          </div>

          {/* Warning messages */}
          {data.status !== 'ok' && (
            <div className="border-t border-[var(--border)] px-3 py-2.5 space-y-1 bg-[var(--surface-2)]">
              {data.machine.ramStatus !== 'ok' && (
                <p className="text-[11px] text-[var(--amber)] flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {data.machine.ramNote}
                </p>
              )}
              {data.machine.coresStatus !== 'ok' && (
                <p className="text-[11px] text-[var(--amber)] flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {data.machine.cores < 2 ? 'Single-core CPU — performance will be very poor.' : 'Low core count — consider a machine with 4+ cores for best performance.'}
                </p>
              )}
              {data.ai.status !== 'ok' && (
                <p className="text-[11px] text-[var(--amber)] flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {data.ai.status === 'error' ? `${data.ai.label} is not reachable — check Settings.` : `${data.ai.label}: ${data.ai.detail}`}
                </p>
              )}
              {data.memory.status !== 'ok' && (
                <p className="text-[11px] text-[var(--amber)] flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {data.memory.status === 'error' ? 'Memory usage is very high — consider restarting.' : 'Memory usage is elevated.'}
                </p>
              )}
              {data.cpu.status !== 'ok' && (
                <p className="text-[11px] text-[var(--amber)] flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  High CPU load — the system may feel slow.
                </p>
              )}
              {data.storage.status !== 'ok' && (
                <p className="text-[11px] text-[var(--amber)] flex items-start gap-1.5">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" />
                  {data.storage.status === 'error' ? 'Storage is over the threshold — consider clearing old reports.' : 'Storage approaching the threshold.'}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusRow({
  icon,
  status,
  label,
  valueText,
  detail,
}: {
  icon: React.ReactNode
  status: Level
  label: string
  valueText: string
  detail: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      {/* health dot */}
      <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', ROW_DOT[status])} />
      {/* icon */}
      <span className={cn('mt-0.5 shrink-0', ROW_ICON[status])}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-bright)] truncate">{label}</span>
          <span className={cn('text-[11px] shrink-0', ROW_DETAIL[status])}>{valueText}</span>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate" title={detail}>{detail}</p>
      </div>
    </div>
  )
}
