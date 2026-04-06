'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Users, Calculator, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calculateCapacity, calculateGap, headcountNeeded, estimateRecruitingCost, type DemandItem } from '@/lib/capacity'

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

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-4', accent ? 'border-[#0026c0]/20 bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900')}>
      <div className={cn('text-xl font-semibold', accent ? 'text-[#0026c0] dark:text-indigo-400' : 'text-gray-900 dark:text-zinc-50')}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function CapacityClient() {
  // ── Calculator state ───────────────────────────────────────────────────────
  const [teamSize,     setTeamSize]     = useState(10)
  const [hoursPerWeek, setHoursPerWeek] = useState(40)
  const [weeks,        setWeeks]        = useState(13)   // one quarter
  const [utilPct,      setUtilPct]      = useState(80)
  const [absencePct,   setAbsencePct]   = useState(5)
  const [demand, setDemand]             = useState<DemandItem[]>([{ label: 'Core workload', hours: 3000 }])
  const [newDemandLabel, setNewDemandLabel] = useState('')
  const [newDemandHours, setNewDemandHours] = useState('')

  // ── Recruiting cost estimator ──────────────────────────────────────────────
  const [salary,        setSalary]        = useState(60000)
  const [recruitPct,    setRecruitPct]    = useState(20)
  const [monthsToFill,  setMonthsToFill]  = useState(1.5)

  // ── Headcount registry ─────────────────────────────────────────────────────
  const [entries, setEntries]     = useState<HeadcountEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [filterDept, setFilterDept] = useState('all')

  const [fRole, setFRole]                 = useState('')
  const [fDept, setFDept]                 = useState('')
  const [fCurrent, setFCurrent]           = useState('0')
  const [fTarget, setFTarget]             = useState('0')
  const [fOpen, setFOpen]                 = useState('0')
  const [fAttrition, setFAttrition]       = useState('0')
  const [fStatus, setFStatus]             = useState('planning')
  const [fTargetDate, setFTargetDate]     = useState('')
  const [fHiringMgr, setFHiringMgr]       = useState('')
  const [saving, setSaving]               = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/headcount')
      if (res.ok) { const d = await res.json() as { entries: HeadcountEntry[] }; setEntries(d.entries) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Calculations ───────────────────────────────────────────────────────────
  const cap    = calculateCapacity({ teamSize, hoursPerWeek, weeks, utilizationPct: utilPct, absenceRatePct: absencePct })
  const gap    = calculateGap(cap.productiveHours, demand, cap.hoursPerPerson)
  const needed = headcountNeeded(gap.demandHours, hoursPerWeek, weeks, utilPct, absencePct)
  const cost   = estimateRecruitingCost(salary, recruitPct, monthsToFill)

  const departments = ['all', ...Array.from(new Set(entries.map(e => e.department))).sort()]
  const visible = filterDept === 'all' ? entries : entries.filter(e => e.department === filterDept)

  // Aggregates for header
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
        setFRole(''); setFDept(''); setFCurrent('0'); setFTarget('0'); setFOpen('0'); setFAttrition('0'); setFStatus('planning'); setFTargetDate(''); setFHiringMgr(''); setShowForm(false)
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

  const coverageColor = gap.coveragePct >= 90 ? 'text-emerald-600 dark:text-emerald-400'
    : gap.coveragePct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'

  return (
    <div className="max-w-4xl space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Capacity Planning</h1>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">Model team capacity, analyse demand gaps, and track headcount.</p>
      </div>

      {/* ── CALCULATOR ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Calculator size={15} className="text-gray-400 dark:text-zinc-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Capacity calculator</h2>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
          <p className="text-xs text-gray-400 dark:text-zinc-500">Formula: Available hours = team size × hours/week × weeks × (1 − absence%) × utilisation%</p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Team size', val: teamSize, set: setTeamSize, min: 1 },
              { label: 'Hours/week', val: hoursPerWeek, set: setHoursPerWeek, min: 1 },
              { label: 'Weeks', val: weeks, set: setWeeks, min: 1 },
              { label: 'Utilisation %', val: utilPct, set: setUtilPct, min: 1, max: 100 },
              { label: 'Absence %', val: absencePct, set: setAbsencePct, min: 0, max: 100 },
            ].map(({ label, val, set, min, max }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">{label}</label>
                <input type="number" value={val} min={min} max={max}
                  onChange={e => set(Math.max(min ?? 0, parseFloat(e.target.value) || 0))}
                  className={numCls + ' w-full'} />
              </div>
            ))}
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <StatCard label="Gross hours" value={Math.round(cap.grossHours).toLocaleString()} />
            <StatCard label="Productive hours" value={Math.round(cap.productiveHours).toLocaleString()} sub={`${utilPct}% util after ${absencePct}% absence`} accent />
            <StatCard label="Hours/person" value={Math.round(cap.hoursPerPerson).toLocaleString()} sub="productive" />
            <StatCard label="Absence loss" value={Math.round(cap.absenceHours).toLocaleString() + ' h'} sub={`${absencePct}% of gross`} />
          </div>
        </div>

        {/* Demand */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-200">Demand items</h3>
            <span className={cn('text-sm font-semibold', coverageColor)}>
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
            <StatCard label="Gap" value={(gap.gapHours >= 0 ? '+' : '') + Math.round(gap.gapHours).toLocaleString() + ' h'}
              sub={gap.gapHours >= 0 ? 'Surplus' : `Deficit · ${headcountNeeded(gap.demandHours, hoursPerWeek, weeks, utilPct, absencePct)} FTE needed`}
              accent={gap.gapHours >= 0} />
            <StatCard label="Headcount needed" value={needed.toString()} sub="to cover demand" />
          </div>
        </div>

        {/* Recruiting cost estimator */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-zinc-200">Recruiting cost estimator</h3>
          <p className="text-xs text-gray-400 dark:text-zinc-500">Global average time-to-fill: 44 days (≈ 1.5 months). Recruiting fee typically 15–25% of annual salary.</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Annual salary (€)', val: salary, set: setSalary },
              { label: 'Recruiting fee %', val: recruitPct, set: setRecruitPct },
              { label: 'Months to fill', val: monthsToFill, set: setMonthsToFill },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">{label}</label>
                <input type="number" value={val} min={0} step={label.includes('salary') ? 1000 : 0.5}
                  onChange={e => set(parseFloat(e.target.value) || 0)}
                  className={numCls + ' w-full'} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <StatCard label="Recruiting fee" value={`€${Math.round(cost.recruitingFee).toLocaleString()}`} />
            <StatCard label="Vacancy cost" value={`€${Math.round(cost.vacancyCost).toLocaleString()}`} sub="lost productivity while role is open" />
            <StatCard label="Total per hire" value={`€${Math.round(cost.totalCost).toLocaleString()}`} accent />
          </div>
        </div>
      </section>

      {/* ── HEADCOUNT REGISTRY ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus size={15} className="text-gray-400 dark:text-zinc-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-zinc-200">Headcount registry</h2>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 transition-colors">
            <Plus size={14} /> Add role
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Current headcount"  value={totalCurrent.toString()} />
          <StatCard label="Target headcount"   value={totalTarget.toString()} />
          <StatCard label="Open positions"     value={totalOpen.toString()} accent={totalOpen > 0} />
          <StatCard label="Actively recruiting" value={recruiting.toString()} />
        </div>

        {/* Dept filter */}
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
