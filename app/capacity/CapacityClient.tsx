'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Users, Calculator, UserPlus, TrendingUp, Target, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calculateCapacity, calculateGap, headcountNeeded, estimateRecruitingCost,
  calculateRecruitingDemand, applyComplexityWeighting, calculateFunnelVelocity,
  calculatePipelineGoal,
  DEFAULT_ROLE_COMPLEXITY, DEFAULT_FUNNEL_STAGES,
  type DemandItem, type RoleComplexityItem, type FunnelStage,
} from '@/lib/capacity'

interface HeadcountEntry {
  id: string; role: string; department: string; currentCount: number; targetCount: number
  openPositions: number; attritionRate: number; status: string; targetDate: string | null
  hiringManager: string | null; notes: string | null; projectId: string | null
}

const HC_STATUSES = ['planning', 'recruiting', 'on_hold', 'filled'] as const
const HC_STATUS_LABEL: Record<string, string> = {
  planning: 'Planning', recruiting: 'Recruiting', on_hold: 'On hold', filled: 'Filled',
}
const HC_STATUS_COLOR: Record<string, string> = {
  planning:   'text-amber-600 dark:text-amber-400',
  recruiting: 'text-blue-600 dark:text-blue-400',
  on_hold:    'text-gray-400 dark:text-zinc-500',
  filled:     'text-emerald-600 dark:text-emerald-400',
}

const inputCls = 'w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'
const numCls   = 'border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-zinc-800 dark:text-zinc-100 w-24 text-right'

function StatCard({ label, value, sub, accent, status }: {
  label: string; value: string; sub?: string; accent?: boolean
  status?: 'green' | 'yellow' | 'red'
}) {
  const borderCls = status === 'red' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950'
    : status === 'yellow' ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950'
    : status === 'green' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950'
    : accent ? 'border-[#0026c0]/20 bg-indigo-50 dark:bg-indigo-950'
    : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900'
  const valCls = status === 'red' ? 'text-red-600 dark:text-red-400'
    : status === 'yellow' ? 'text-amber-600 dark:text-amber-400'
    : status === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : accent ? 'text-[#0026c0] dark:text-indigo-400' : 'text-gray-900 dark:text-zinc-50'
  return (
    <div className={cn('rounded-xl border p-4', borderCls)}>
      <div className={cn('text-xl font-semibold', valCls)}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 dark:text-zinc-500">{icon}</span>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-200">{title}</h2>
    </div>
  )
}

export default function CapacityClient() {
  // ── Team capacity inputs ───────────────────────────────────────────────────
  const [teamSize,     setTeamSize]     = useState(10)
  const [hoursPerWeek, setHoursPerWeek] = useState(40)
  const [weeks,        setWeeks]        = useState(13)
  const [utilPct,      setUtilPct]      = useState(80)
  const [absencePct,   setAbsencePct]   = useState(5)
  const [overheadPct,  setOverheadPct]  = useState(15)

  // ── Demand gap items ───────────────────────────────────────────────────────
  const [demand, setDemand]             = useState<DemandItem[]>([{ label: 'Core workload', hours: 3000 }])
  const [newDemandLabel, setNewDemandLabel] = useState('')
  const [newDemandHours, setNewDemandHours] = useState('')

  // ── Recruiting demand planner ──────────────────────────────────────────────
  const [openRoles,       setOpenRoles]       = useState(20)
  const [newReqsPerMonth, setNewReqsPerMonth] = useState(5)
  const [attritionPct,    setAttritionPct]    = useState(12)
  const [horizonMonths,   setHorizonMonths]   = useState<3 | 6 | 12>(6)

  // ── Role complexity ────────────────────────────────────────────────────────
  const [complexity, setComplexity] = useState<RoleComplexityItem[]>(DEFAULT_ROLE_COMPLEXITY)
  const [roleReqs, setRoleReqs]     = useState<Record<string, number>>({
    Junior: 6, Mid: 8, Senior: 5, Staff: 3, Principal: 2, Manager: 3, Director: 2, Executive: 1,
  })

  // ── Funnel velocity ────────────────────────────────────────────────────────
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>(DEFAULT_FUNNEL_STAGES)

  // ── Pipeline goaling ───────────────────────────────────────────────────────
  const [hiringTarget,        setHiringTarget]        = useState(30)
  const [acceptanceRatePct,   setAcceptanceRatePct]   = useState(85)
  const [interviewsPerOffer,  setInterviewsPerOffer]  = useState(4)
  const [screensPerInterview, setScreensPerInterview] = useState(3)

  // ── Recruiting cost estimator ──────────────────────────────────────────────
  const [salary,       setSalary]       = useState(60000)
  const [recruitPct,   setRecruitPct]   = useState(20)
  const [monthsToFill, setMonthsToFill] = useState(1.5)

  // ── Headcount registry ─────────────────────────────────────────────────────
  const [entries, setEntries]       = useState<HeadcountEntry[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [filterDept, setFilterDept] = useState('all')

  const [fRole, setFRole]           = useState('')
  const [fDept, setFDept]           = useState('')
  const [fCurrent, setFCurrent]     = useState('0')
  const [fTarget, setFTarget]       = useState('0')
  const [fOpen, setFOpen]           = useState('0')
  const [fAttrition, setFAttrition] = useState('0')
  const [fStatus, setFStatus]       = useState('planning')
  const [fTargetDate, setFTargetDate] = useState('')
  const [fHiringMgr, setFHiringMgr]   = useState('')
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/headcount')
      if (res.ok) { const d = await res.json() as { entries: HeadcountEntry[] }; setEntries(d.entries) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── All calculations ───────────────────────────────────────────────────────
  const cap   = calculateCapacity({ teamSize, hoursPerWeek, weeks, utilizationPct: utilPct, absenceRatePct: absencePct, overheadPct })
  const gap   = calculateGap(cap.effectiveHours, demand, cap.hoursPerPerson)
  const needed = headcountNeeded(gap.demandHours, hoursPerWeek, weeks, utilPct, absencePct)
  const cost  = estimateRecruitingCost(salary, recruitPct, monthsToFill)

  const recruitDemand = calculateRecruitingDemand({ openRoles, newReqsPerMonth, attritionRatePct: attritionPct, planningHorizonMonths: horizonMonths })
  const { weightedDemand, avgComplexity } = applyComplexityWeighting(recruitDemand.totalHiresNeeded, roleReqs, complexity)

  const totalHoursPerHire  = calculateFunnelVelocity(funnelStages)
  const effectiveHiresCap  = totalHoursPerHire > 0 ? Math.floor(cap.effectiveHours / totalHoursPerHire) : 0
  const hiresGap           = effectiveHiresCap - Math.ceil(weightedDemand)
  const additionalRecsNeeded = cap.hoursPerPerson > 0 && totalHoursPerHire > 0 && hiresGap < 0
    ? Math.ceil(Math.abs(hiresGap) * totalHoursPerHire / cap.hoursPerPerson) : 0

  const pipeline = calculatePipelineGoal(hiringTarget, acceptanceRatePct, interviewsPerOffer, screensPerInterview)

  // Coverage traffic light
  const coverageStatus: 'green' | 'yellow' | 'red' = gap.coveragePct >= 100 ? 'green'
    : gap.coveragePct >= 70 ? 'yellow' : 'red'

  // Hiring demand utilisation traffic light
  const hireUtil = effectiveHiresCap > 0 ? (Math.ceil(weightedDemand) / effectiveHiresCap) * 100 : 100
  const hireStatus: 'green' | 'yellow' | 'red' = hireUtil < 80 ? 'green' : hireUtil <= 100 ? 'yellow' : 'red'

  // Headcount registry
  const departments = ['all', ...Array.from(new Set(entries.map(e => e.department))).sort()]
  const visible = filterDept === 'all' ? entries : entries.filter(e => e.department === filterDept)
  const totalCurrent = entries.reduce((s, e) => s + e.currentCount, 0)
  const totalTarget  = entries.reduce((s, e) => s + e.targetCount, 0)
  const totalOpen    = entries.reduce((s, e) => s + e.openPositions, 0)
  const recruiting   = entries.filter(e => e.status === 'recruiting').length

  const handleCreate = async () => {
    if (!fRole.trim() || !fDept.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/headcount', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: fRole, department: fDept,
          currentCount: parseInt(fCurrent) || 0, targetCount: parseInt(fTarget) || 0,
          openPositions: parseInt(fOpen) || 0, attritionRate: parseFloat(fAttrition) || 0,
          status: fStatus, targetDate: fTargetDate || undefined, hiringManager: fHiringMgr,
        }),
      })
      if (res.ok) {
        const d = await res.json() as { entry: HeadcountEntry }
        setEntries(prev => [...prev, d.entry].sort((a, b) => a.department.localeCompare(b.department) || a.role.localeCompare(b.role)))
        setFRole(''); setFDept(''); setFCurrent('0'); setFTarget('0'); setFOpen('0')
        setFAttrition('0'); setFStatus('planning'); setFTargetDate(''); setFHiringMgr(''); setShowForm(false)
      }
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const updateStatus = async (id: string, status: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e))
    await fetch(`/api/headcount/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {})
  }

  const handleDelete = async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
    await fetch(`/api/headcount/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="max-w-4xl space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Capacity Planning</h1>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">Model team capacity, forecast recruiting demand, and track headcount.</p>
      </div>

      {/* ── SECTION 1: CAPACITY CALCULATOR ── */}
      <section className="space-y-4">
        <SectionHeader icon={<Calculator size={15} />} title="Capacity calculator" />

        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            Effective hours = team × hours/week × weeks × (1 − absence%) × utilisation% × (1 − overhead%)
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Team size',     val: teamSize,     set: setTeamSize,     min: 1 },
              { label: 'Hours/week',    val: hoursPerWeek, set: setHoursPerWeek, min: 1 },
              { label: 'Weeks',         val: weeks,        set: setWeeks,        min: 1 },
              { label: 'Utilisation %', val: utilPct,      set: setUtilPct,      min: 1, max: 100 },
              { label: 'Absence %',     val: absencePct,   set: setAbsencePct,   min: 0, max: 100 },
              { label: 'Overhead %',    val: overheadPct,  set: setOverheadPct,  min: 0, max: 100 },
            ].map(({ label, val, set, min, max }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">{label}</label>
                <input type="number" value={val} min={min} max={max}
                  onChange={e => set(Math.max(min ?? 0, parseFloat(e.target.value) || 0))}
                  className={numCls + ' w-full'} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <StatCard label="Gross hours"     value={Math.round(cap.grossHours).toLocaleString()} />
            <StatCard label="Effective hours" value={Math.round(cap.effectiveHours).toLocaleString()}
              sub={`after ${absencePct}% absence, ${utilPct}% util, ${overheadPct}% overhead`} accent />
            <StatCard label="Hours/person"    value={Math.round(cap.hoursPerPerson).toLocaleString()} sub="effective" />
            <StatCard label="Overhead loss"   value={Math.round(cap.overheadHours).toLocaleString() + ' h'}
              sub={`${overheadPct}% of productive hrs`} />
          </div>
        </div>

        {/* Demand gap */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-200">Demand items</h3>
            <span className={cn('text-sm font-semibold',
              coverageStatus === 'green' ? 'text-emerald-600 dark:text-emerald-400'
              : coverageStatus === 'yellow' ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400')}>
              {Math.round(gap.coveragePct)}% coverage
              {gap.fteNeeded > 0 && <span className="text-xs font-normal text-gray-500 dark:text-zinc-400 ml-1">· need {gap.fteNeeded} more FTE</span>}
            </span>
          </div>

          <div className="space-y-1.5">
            {demand.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-700 dark:text-zinc-200 truncate">{d.label}</span>
                <input type="number" value={d.hours} min={0}
                  onChange={e => setDemand(prev => prev.map((x, j) => j === i ? { ...x, hours: parseInt(e.target.value) || 0 } : x))}
                  className={numCls} />
                <span className="text-xs text-gray-400 dark:text-zinc-500 w-6">h</span>
                {demand.length > 1 && (
                  <button onClick={() => setDemand(prev => prev.filter((_, j) => j !== i))}
                    className="text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 items-center pt-1">
            <input value={newDemandLabel} onChange={e => setNewDemandLabel(e.target.value)} placeholder="Initiative label"
              className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none dark:bg-zinc-800 dark:text-zinc-100" />
            <input type="number" value={newDemandHours} onChange={e => setNewDemandHours(e.target.value)} placeholder="hrs" min={0}
              className={numCls} />
            <button onClick={() => {
              if (!newDemandLabel.trim() || !newDemandHours) return
              setDemand(prev => [...prev, { label: newDemandLabel.trim(), hours: parseInt(newDemandHours) || 0 }])
              setNewDemandLabel(''); setNewDemandHours('')
            }} className="px-3 py-1.5 rounded-lg text-sm bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors">
              <Plus size={13} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1 border-t border-gray-100 dark:border-zinc-800">
            <StatCard label="Total demand" value={gap.demandHours.toLocaleString() + ' h'} />
            <StatCard label="Gap"
              value={(gap.gapHours >= 0 ? '+' : '') + Math.round(gap.gapHours).toLocaleString() + ' h'}
              sub={gap.gapHours >= 0 ? 'Surplus' : `Deficit — ${needed} FTE needed`}
              status={coverageStatus} />
            <StatCard label="FTEs to cover demand" value={needed.toString()} sub="minimum headcount" />
          </div>
        </div>
      </section>

      {/* ── SECTION 2: RECRUITING DEMAND PLANNER ── */}
      <section className="space-y-4">
        <SectionHeader icon={<TrendingUp size={15} />} title="Recruiting demand planner" />

        {/* Demand inputs */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            Forecasts total hiring demand across three sources: existing open roles, new requisitions, and attrition-driven backfills.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Open roles now</label>
              <input type="number" value={openRoles} min={0} onChange={e => setOpenRoles(parseInt(e.target.value) || 0)} className={numCls + ' w-full'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">New reqs / month</label>
              <input type="number" value={newReqsPerMonth} min={0} onChange={e => setNewReqsPerMonth(parseInt(e.target.value) || 0)} className={numCls + ' w-full'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Attrition rate % / yr</label>
              <input type="number" value={attritionPct} min={0} max={100} onChange={e => setAttritionPct(parseFloat(e.target.value) || 0)} className={numCls + ' w-full'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Planning horizon</label>
              <select value={horizonMonths} onChange={e => setHorizonMonths(parseInt(e.target.value) as 3 | 6 | 12)} className={inputCls}>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-gray-100 dark:border-zinc-800">
            <StatCard label="From backlog"    value={recruitDemand.fromBacklog.toString()} sub="existing open roles" />
            <StatCard label="From new reqs"   value={recruitDemand.fromNewReqs.toString()} sub={`${newReqsPerMonth}/mo × ${horizonMonths} mo`} />
            <StatCard label="Attrition fills" value={recruitDemand.fromAttrition.toString()} sub={`${attritionPct}% annual churn`} />
            <StatCard label="Total hires needed" value={recruitDemand.totalHiresNeeded.toString()} accent />
          </div>
        </div>

        {/* Role complexity */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-200">Role complexity weighting</h3>
            <span className="text-[11px] text-gray-400 dark:text-zinc-500">Avg complexity: <span className="font-medium text-gray-700 dark:text-zinc-200">{avgComplexity.toFixed(2)}×</span></span>
          </div>
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            Each seniority level carries a complexity multiplier — an Executive role demands 3.5× more recruiter effort than a Junior hire.
            Set how many of each level you need to fill.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 dark:text-zinc-500 border-b border-gray-100 dark:border-zinc-800">
                  <th className="pb-2 font-medium">Level</th>
                  <th className="pb-2 font-medium text-right">Multiplier</th>
                  <th className="pb-2 font-medium text-right">Avg days to fill</th>
                  <th className="pb-2 font-medium text-right">Hires needed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-zinc-800/50">
                {complexity.map((rc, i) => (
                  <tr key={rc.role}>
                    <td className="py-1.5 font-medium text-gray-700 dark:text-zinc-200">{rc.role}</td>
                    <td className="py-1.5 text-right">
                      <input type="number" value={rc.multiplier} min={0.1} step={0.1}
                        onChange={e => setComplexity(prev => prev.map((x, j) => j === i ? { ...x, multiplier: parseFloat(e.target.value) || 1 } : x))}
                        className="w-16 border border-gray-200 dark:border-zinc-700 rounded px-2 py-0.5 text-right dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none" />
                    </td>
                    <td className="py-1.5 text-right">
                      <input type="number" value={rc.avgTimeToFill} min={1}
                        onChange={e => setComplexity(prev => prev.map((x, j) => j === i ? { ...x, avgTimeToFill: parseInt(e.target.value) || 1 } : x))}
                        className="w-16 border border-gray-200 dark:border-zinc-700 rounded px-2 py-0.5 text-right dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none" />
                    </td>
                    <td className="py-1.5 text-right">
                      <input type="number" value={roleReqs[rc.role] ?? 0} min={0}
                        onChange={e => setRoleReqs(prev => ({ ...prev, [rc.role]: parseInt(e.target.value) || 0 }))}
                        className="w-16 border border-gray-200 dark:border-zinc-700 rounded px-2 py-0.5 text-right dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
            <StatCard label="Raw demand"      value={recruitDemand.totalHiresNeeded.toString()} sub="hires needed" />
            <StatCard label="Complexity adj." value={weightedDemand.toFixed(1)} sub={`${avgComplexity.toFixed(2)}× avg complexity`} accent />
            <StatCard label="Effective hires capacity" value={effectiveHiresCap.toString()}
              sub={`${Math.round(cap.effectiveHours)} h ÷ ${totalHoursPerHire} h/hire`}
              status={hireStatus} />
          </div>

          {additionalRecsNeeded > 0 && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium pt-1">
              Capacity gap: need ~{additionalRecsNeeded} additional recruiter{additionalRecsNeeded !== 1 ? 's' : ''} to cover complexity-adjusted demand over {horizonMonths} months.
            </p>
          )}
        </div>
      </section>

      {/* ── SECTION 3: FUNNEL VELOCITY & PIPELINE GOALING ── */}
      <section className="space-y-4">
        <SectionHeader icon={<Zap size={15} />} title="Funnel velocity & pipeline goaling" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Funnel velocity */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-200">Hours per hire by stage</h3>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Recruiter hours per successful hire at each pipeline stage.</p>
            <div className="space-y-2">
              {funnelStages.map((stage, i) => (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700 dark:text-zinc-200">{stage.stage}</span>
                  <input type="number" value={stage.hours} min={0} step={0.5}
                    onChange={e => setFunnelStages(prev => prev.map((x, j) => j === i ? { ...x, hours: parseFloat(e.target.value) || 0 } : x))}
                    className={numCls} />
                  <span className="text-xs text-gray-400 dark:text-zinc-500 w-4">h</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-zinc-400">Total per hire</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50">{totalHoursPerHire} h</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-zinc-400">Effective hires capacity</span>
              <span className={cn('text-sm font-semibold',
                hireStatus === 'green' ? 'text-emerald-600 dark:text-emerald-400'
                : hireStatus === 'yellow' ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400')}>
                {effectiveHiresCap} hires
              </span>
            </div>
          </div>

          {/* Pipeline goaling */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-200">Pipeline goaling calculator</h3>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Set your hiring target and conversion rates to see how many screens, interviews, and offers you need.</p>
            <div className="space-y-2">
              {[
                { label: 'Hiring target',         val: hiringTarget,        set: setHiringTarget,        step: 1 },
                { label: 'Offer acceptance %',    val: acceptanceRatePct,   set: setAcceptanceRatePct,   step: 1 },
                { label: 'Interviews per offer',  val: interviewsPerOffer,  set: setInterviewsPerOffer,  step: 0.5 },
                { label: 'Screens per interview', val: screensPerInterview, set: setScreensPerInterview, step: 0.5 },
              ].map(({ label, val, set, step }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700 dark:text-zinc-200">{label}</span>
                  <input type="number" value={val} min={0} step={step}
                    onChange={e => set(parseFloat(e.target.value) || 0)}
                    className={numCls} />
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 space-y-1.5">
              {[
                { label: 'Offers needed',     value: pipeline.requiredOffers },
                { label: 'Interviews needed', value: pipeline.requiredInterviews },
                { label: 'Screens needed',    value: pipeline.requiredScreens },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">{label}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-zinc-50">{value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: RECRUITING COST ESTIMATOR ── */}
      <section className="space-y-4">
        <SectionHeader icon={<Target size={15} />} title="Recruiting cost estimator" />
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            Global average time-to-fill: 44 days (≈ 1.5 months). Recruiting agency fee typically 15–25% of annual salary.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Annual salary (€)', val: salary,       set: setSalary,       step: 1000 },
              { label: 'Recruiting fee %',  val: recruitPct,   set: setRecruitPct,   step: 1 },
              { label: 'Months to fill',    val: monthsToFill, set: setMonthsToFill, step: 0.5 },
            ].map(({ label, val, set, step }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">{label}</label>
                <input type="number" value={val} min={0} step={step}
                  onChange={e => set(parseFloat(e.target.value) || 0)}
                  className={numCls + ' w-full'} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <StatCard label="Recruiting fee" value={`€${Math.round(cost.recruitingFee).toLocaleString()}`} />
            <StatCard label="Vacancy cost"   value={`€${Math.round(cost.vacancyCost).toLocaleString()}`} sub="lost productivity while open" />
            <StatCard label="Total per hire" value={`€${Math.round(cost.totalCost).toLocaleString()}`} accent />
          </div>
        </div>
      </section>

      {/* ── SECTION 5: HEADCOUNT REGISTRY ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader icon={<UserPlus size={15} />} title="Headcount registry" />
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors">
            <Plus size={14} /> Add role
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Current headcount"   value={totalCurrent.toString()} />
          <StatCard label="Target headcount"    value={totalTarget.toString()} />
          <StatCard label="Open positions"      value={totalOpen.toString()} accent={totalOpen > 0} />
          <StatCard label="Actively recruiting" value={recruiting.toString()} />
        </div>

        {departments.length > 2 && (
          <div className="flex gap-1.5 flex-wrap">
            {departments.map(d => (
              <button key={d} onClick={() => setFilterDept(d)}
                className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors capitalize',
                  filterDept === d ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400')}>
                {d === 'all' ? 'All departments' : d}
              </button>
            ))}
          </div>
        )}

        {showForm && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Add Role</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Role *</label>
                <input value={fRole} onChange={e => setFRole(e.target.value)} placeholder="e.g. Senior Engineer" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Department *</label>
                <input value={fDept} onChange={e => setFDept(e.target.value)} placeholder="e.g. Engineering" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Current headcount</label>
                <input type="number" value={fCurrent} min={0} onChange={e => setFCurrent(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Target headcount</label>
                <input type="number" value={fTarget} min={0} onChange={e => setFTarget(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Open positions</label>
                <input type="number" value={fOpen} min={0} onChange={e => setFOpen(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Attrition rate % / yr</label>
                <input type="number" value={fAttrition} min={0} max={100} step={0.5} onChange={e => setFAttrition(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Status</label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inputCls}>
                  {HC_STATUSES.map(s => <option key={s} value={s}>{HC_STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Target fill date</label>
                <input type="date" value={fTargetDate} onChange={e => setFTargetDate(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Hiring manager</label>
                <input value={fHiringMgr} onChange={e => setFHiringMgr(e.target.value)} placeholder="Who is running this hire?" className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleCreate} disabled={saving || !fRole.trim() || !fDept.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />} Add
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm">No roles tracked yet. Add your first role above.</div>
        ) : (
          <div className="space-y-2">
            {visible.map(entry => {
              const gap_ = entry.targetCount - entry.currentCount
              return (
                <div key={entry.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Users size={15} className={cn('shrink-0 mt-0.5', HC_STATUS_COLOR[entry.status])} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-zinc-50">{entry.role}</p>
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500">{entry.department}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-zinc-400">
                        <span>{entry.currentCount} current → {entry.targetCount} target</span>
                        {gap_ > 0 && <span className="text-amber-600 dark:text-amber-400">{gap_} gap</span>}
                        {entry.openPositions > 0 && <span className="text-blue-600 dark:text-blue-400">{entry.openPositions} open req{entry.openPositions !== 1 ? 's' : ''}</span>}
                        {entry.attritionRate > 0 && <span>{entry.attritionRate}% attrition/yr</span>}
                        {entry.hiringManager && <span>HM: {entry.hiringManager}</span>}
                        {entry.targetDate && <span>Target: {new Date(entry.targetDate).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <select value={entry.status} onChange={e => void updateStatus(entry.id, e.target.value)}
                      className={cn('text-[11px] font-medium px-2 py-1 rounded-full border-0 bg-transparent focus:outline-none shrink-0', HC_STATUS_COLOR[entry.status])}>
                      {HC_STATUSES.map(s => <option key={s} value={s} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50">{HC_STATUS_LABEL[s]}</option>)}
                    </select>
                    <button onClick={() => void handleDelete(entry.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
