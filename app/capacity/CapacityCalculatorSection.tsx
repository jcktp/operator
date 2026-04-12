'use client'

import { Plus, Trash2, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type DemandItem } from '@/lib/capacity'
import { StatCard, SectionHeader, numCls } from './capacity-shared'

interface CapacityCalculatorSectionProps {
  teamSize: number; setTeamSize: (v: number) => void
  hoursPerWeek: number; setHoursPerWeek: (v: number) => void
  weeks: number; setWeeks: (v: number) => void
  utilPct: number; setUtilPct: (v: number) => void
  absencePct: number; setAbsencePct: (v: number) => void
  overheadPct: number; setOverheadPct: (v: number) => void
  // Computed capacity
  cap: { grossHours: number; effectiveHours: number; hoursPerPerson: number; overheadHours: number }
  // Demand gap
  demand: DemandItem[]; setDemand: (v: DemandItem[] | ((prev: DemandItem[]) => DemandItem[])) => void
  newDemandLabel: string; setNewDemandLabel: (v: string) => void
  newDemandHours: string; setNewDemandHours: (v: string) => void
  gap: { demandHours: number; gapHours: number; coveragePct: number; fteNeeded: number }
  needed: number
  coverageStatus: 'green' | 'yellow' | 'red'
}

export default function CapacityCalculatorSection(props: CapacityCalculatorSectionProps) {
  const {
    teamSize, setTeamSize, hoursPerWeek, setHoursPerWeek, weeks, setWeeks,
    utilPct, setUtilPct, absencePct, setAbsencePct, overheadPct, setOverheadPct,
    cap, demand, setDemand, newDemandLabel, setNewDemandLabel, newDemandHours, setNewDemandHours,
    gap, needed, coverageStatus,
  } = props

  return (
    <section className="space-y-4">
      <SectionHeader icon={<Calculator size={15} />} title="Capacity calculator" />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
        <p className="text-xs text-[var(--text-muted)]">
          Effective hours = team x hours/week x weeks x (1 - absence%) x utilisation% x (1 - overhead%)
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Team size', val: teamSize, set: setTeamSize, min: 1 },
            { label: 'Hours/week', val: hoursPerWeek, set: setHoursPerWeek, min: 1 },
            { label: 'Weeks', val: weeks, set: setWeeks, min: 1 },
            { label: 'Utilisation %', val: utilPct, set: setUtilPct, min: 1, max: 100 },
            { label: 'Absence %', val: absencePct, set: setAbsencePct, min: 0, max: 100 },
            { label: 'Overhead %', val: overheadPct, set: setOverheadPct, min: 0, max: 100 },
          ].map(({ label, val, set, min, max }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">{label}</label>
              <input type="number" value={val} min={min} max={max}
                onChange={e => set(Math.max(min ?? 0, parseFloat(e.target.value) || 0))}
                className={numCls + ' w-full'} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <StatCard label="Gross hours" value={Math.round(cap.grossHours).toLocaleString()} />
          <StatCard label="Effective hours" value={Math.round(cap.effectiveHours).toLocaleString()}
            sub={`after ${absencePct}% absence, ${utilPct}% util, ${overheadPct}% overhead`} accent />
          <StatCard label="Hours/person" value={Math.round(cap.hoursPerPerson).toLocaleString()} sub="effective" />
          <StatCard label="Overhead loss" value={Math.round(cap.overheadHours).toLocaleString() + ' h'}
            sub={`${overheadPct}% of productive hrs`} />
        </div>
      </div>

      {/* Demand gap */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--text-body)]">Demand items</h3>
          <span className={cn('text-sm font-semibold',
            coverageStatus === 'green' ? 'text-emerald-600'
            : coverageStatus === 'yellow' ? 'text-[var(--amber)]'
            : 'text-[var(--red)]')}>
            {Math.round(gap.coveragePct)}% coverage
            {gap.fteNeeded > 0 && <span className="text-xs font-normal text-[var(--text-muted)] ml-1">· need {gap.fteNeeded} more FTE</span>}
          </span>
        </div>

        <div className="space-y-1.5">
          {demand.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 text-sm text-[var(--text-body)] truncate">{d.label}</span>
              <input type="number" value={d.hours} min={0}
                onChange={e => setDemand(prev => prev.map((x, j) => j === i ? { ...x, hours: parseInt(e.target.value) || 0 } : x))}
                className={numCls} />
              <span className="text-xs text-[var(--text-muted)] w-6">h</span>
              {demand.length > 1 && (
                <button onClick={() => setDemand(prev => prev.filter((_, j) => j !== i))}
                  className="text-[var(--border)] hover:text-[var(--red)] transition-colors"><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 items-center pt-1">
          <input value={newDemandLabel} onChange={e => setNewDemandLabel(e.target.value)} placeholder="Initiative label"
            className="flex-1 border border-[var(--border)] rounded-[4px] px-3 py-1.5 text-sm focus:outline-none" />
          <input type="number" value={newDemandHours} onChange={e => setNewDemandHours(e.target.value)} placeholder="hrs" min={0}
            className={numCls} />
          <button onClick={() => {
            if (!newDemandLabel.trim() || !newDemandHours) return
            setDemand(prev => [...prev, { label: newDemandLabel.trim(), hours: parseInt(newDemandHours) || 0 }])
            setNewDemandLabel(''); setNewDemandHours('')
          }} className="h-7 px-2.5 rounded-[4px] text-xs bg-[var(--ink)] text-[var(--ink-contrast)] hover:bg-[var(--ink)] transition-colors">
            <Plus size={13} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1 border-t border-[var(--border)]">
          <StatCard label="Total demand" value={gap.demandHours.toLocaleString() + ' h'} />
          <StatCard label="Gap"
            value={(gap.gapHours >= 0 ? '+' : '') + Math.round(gap.gapHours).toLocaleString() + ' h'}
            sub={gap.gapHours >= 0 ? 'Surplus' : `Deficit — ${needed} FTE needed`}
            status={coverageStatus} />
          <StatCard label="FTEs to cover demand" value={needed.toString()} sub="minimum headcount" />
        </div>
      </div>
    </section>
  )
}
