'use client'

import { useState, useEffect, useCallback } from 'react'
import { Zap, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  calculateCapacity, calculateGap, headcountNeeded, estimateRecruitingCost,
  calculateRecruitingDemand, applyComplexityWeighting, calculateFunnelVelocity,
  calculatePipelineGoal,
  DEFAULT_ROLE_COMPLEXITY, DEFAULT_FUNNEL_STAGES,
  type DemandItem, type RoleComplexityItem, type FunnelStage,
} from '@/lib/capacity'
import { StatCard, SectionHeader, numCls } from './capacity-shared'
import CapacityCalculatorSection from './CapacityCalculatorSection'
import RecruitingDemandSection from './RecruitingDemandSection'
import HeadcountRegistrySection from './HeadcountRegistrySection'

interface HeadcountEntry {
  id: string; role: string; department: string; currentCount: number; targetCount: number
  openPositions: number; attritionRate: number; status: string; targetDate: string | null
  hiringManager: string | null; notes: string | null; projectId: string | null
}

export default function CapacityClient() {
  // ── Team capacity inputs ───────────────────────────────────────────────────
  const [teamSize, setTeamSize] = useState(10)
  const [hoursPerWeek, setHoursPerWeek] = useState(40)
  const [weeks, setWeeks] = useState(13)
  const [utilPct, setUtilPct] = useState(80)
  const [absencePct, setAbsencePct] = useState(5)
  const [overheadPct, setOverheadPct] = useState(15)

  // ── Demand gap items ───────────────────────────────────────────────────────
  const [demand, setDemand] = useState<DemandItem[]>([{ label: 'Core workload', hours: 3000 }])
  const [newDemandLabel, setNewDemandLabel] = useState('')
  const [newDemandHours, setNewDemandHours] = useState('')

  // ── Recruiting demand planner ──────────────────────────────────────────────
  const [openRoles, setOpenRoles] = useState(20)
  const [newReqsPerMonth, setNewReqsPerMonth] = useState(5)
  const [attritionPct, setAttritionPct] = useState(12)
  const [horizonMonths, setHorizonMonths] = useState<3 | 6 | 12>(6)

  // ── Role complexity ────────────────────────────────────────────────────────
  const [complexity, setComplexity] = useState<RoleComplexityItem[]>(DEFAULT_ROLE_COMPLEXITY)
  const [roleReqs, setRoleReqs] = useState<Record<string, number>>({
    Junior: 6, Mid: 8, Senior: 5, Staff: 3, Principal: 2, Manager: 3, Director: 2, Executive: 1,
  })

  // ── Funnel velocity ────────────────────────────────────────────────────────
  const [funnelStages, setFunnelStages] = useState<FunnelStage[]>(DEFAULT_FUNNEL_STAGES)

  // ── Pipeline goaling ───────────────────────────────────────────────────────
  const [hiringTarget, setHiringTarget] = useState(30)
  const [acceptanceRatePct, setAcceptanceRatePct] = useState(85)
  const [interviewsPerOffer, setInterviewsPerOffer] = useState(4)
  const [screensPerInterview, setScreensPerInterview] = useState(3)

  // ── Recruiting cost estimator ──────────────────────────────────────────────
  const [salary, setSalary] = useState(60000)
  const [recruitPct, setRecruitPct] = useState(20)
  const [monthsToFill, setMonthsToFill] = useState(1.5)

  // ── Headcount registry ─────────────────────────────────────────────────────
  const [entries, setEntries] = useState<HeadcountEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterDept, setFilterDept] = useState('all')

  const [fRole, setFRole] = useState('')
  const [fDept, setFDept] = useState('')
  const [fCurrent, setFCurrent] = useState('0')
  const [fTarget, setFTarget] = useState('0')
  const [fOpen, setFOpen] = useState('0')
  const [fAttrition, setFAttrition] = useState('0')
  const [fStatus, setFStatus] = useState('planning')
  const [fTargetDate, setFTargetDate] = useState('')
  const [fHiringMgr, setFHiringMgr] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/headcount')
      if (res.ok) { const d = await res.json() as { entries: HeadcountEntry[] }; setEntries(d.entries) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  // ── All calculations ───────────────────────────────────────────────────────
  const cap = calculateCapacity({ teamSize, hoursPerWeek, weeks, utilizationPct: utilPct, absenceRatePct: absencePct, overheadPct })
  const gap = calculateGap(cap.effectiveHours, demand, cap.hoursPerPerson)
  const needed = headcountNeeded(gap.demandHours, hoursPerWeek, weeks, utilPct, absencePct)
  const cost = estimateRecruitingCost(salary, recruitPct, monthsToFill)

  const recruitDemand = calculateRecruitingDemand({ openRoles, newReqsPerMonth, attritionRatePct: attritionPct, planningHorizonMonths: horizonMonths })
  const { weightedDemand, avgComplexity } = applyComplexityWeighting(recruitDemand.totalHiresNeeded, roleReqs, complexity)

  const totalHoursPerHire = calculateFunnelVelocity(funnelStages)
  const effectiveHiresCap = totalHoursPerHire > 0 ? Math.floor(cap.effectiveHours / totalHoursPerHire) : 0
  const hiresGap = effectiveHiresCap - Math.ceil(weightedDemand)
  const additionalRecsNeeded = cap.hoursPerPerson > 0 && totalHoursPerHire > 0 && hiresGap < 0
    ? Math.ceil(Math.abs(hiresGap) * totalHoursPerHire / cap.hoursPerPerson) : 0

  const pipeline = calculatePipelineGoal(hiringTarget, acceptanceRatePct, interviewsPerOffer, screensPerInterview)

  const coverageStatus: 'green' | 'yellow' | 'red' = gap.coveragePct >= 100 ? 'green'
    : gap.coveragePct >= 70 ? 'yellow' : 'red'
  const hireUtil = effectiveHiresCap > 0 ? (Math.ceil(weightedDemand) / effectiveHiresCap) * 100 : 100
  const hireStatus: 'green' | 'yellow' | 'red' = hireUtil < 80 ? 'green' : hireUtil <= 100 ? 'yellow' : 'red'

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
        <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Capacity Planning</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Model team capacity, forecast recruiting demand, and track headcount.</p>
      </div>

      {/* ── SECTION 1: CAPACITY CALCULATOR ── */}
      <CapacityCalculatorSection
        teamSize={teamSize} setTeamSize={setTeamSize}
        hoursPerWeek={hoursPerWeek} setHoursPerWeek={setHoursPerWeek}
        weeks={weeks} setWeeks={setWeeks}
        utilPct={utilPct} setUtilPct={setUtilPct}
        absencePct={absencePct} setAbsencePct={setAbsencePct}
        overheadPct={overheadPct} setOverheadPct={setOverheadPct}
        cap={cap} demand={demand} setDemand={setDemand}
        newDemandLabel={newDemandLabel} setNewDemandLabel={setNewDemandLabel}
        newDemandHours={newDemandHours} setNewDemandHours={setNewDemandHours}
        gap={gap} needed={needed} coverageStatus={coverageStatus}
      />

      {/* ── SECTION 2: RECRUITING DEMAND PLANNER ── */}
      <RecruitingDemandSection
        openRoles={openRoles} setOpenRoles={setOpenRoles}
        newReqsPerMonth={newReqsPerMonth} setNewReqsPerMonth={setNewReqsPerMonth}
        attritionPct={attritionPct} setAttritionPct={setAttritionPct}
        horizonMonths={horizonMonths} setHorizonMonths={setHorizonMonths}
        recruitDemand={recruitDemand}
        complexity={complexity} setComplexity={setComplexity}
        roleReqs={roleReqs} setRoleReqs={setRoleReqs}
        weightedDemand={weightedDemand} avgComplexity={avgComplexity}
        effectiveHiresCap={effectiveHiresCap} effectiveHours={cap.effectiveHours}
        totalHoursPerHire={totalHoursPerHire} hireStatus={hireStatus}
        additionalRecsNeeded={additionalRecsNeeded} hoursPerPerson={cap.hoursPerPerson}
      />

      {/* ── SECTION 3: FUNNEL VELOCITY & PIPELINE GOALING ── */}
      <section className="space-y-4">
        <SectionHeader icon={<Zap size={15} />} title="Funnel velocity & pipeline goaling" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Funnel velocity */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--text-body)]">Hours per hire by stage</h3>
            <p className="text-xs text-[var(--text-muted)]">Recruiter hours per successful hire at each pipeline stage.</p>
            <div className="space-y-2">
              {funnelStages.map((stage, i) => (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-[var(--text-body)]">{stage.stage}</span>
                  <input type="number" value={stage.hours} min={0} step={0.5}
                    onChange={e => setFunnelStages(prev => prev.map((x, j) => j === i ? { ...x, hours: parseFloat(e.target.value) || 0 } : x))}
                    className={numCls} />
                  <span className="text-xs text-[var(--text-muted)] w-4">h</span>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">Total per hire</span>
              <span className="text-sm font-semibold text-[var(--text-bright)]">{totalHoursPerHire} h</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">Effective hires capacity</span>
              <span className={cn('text-sm font-semibold',
                hireStatus === 'green' ? 'text-emerald-600'
                : hireStatus === 'yellow' ? 'text-[var(--amber)]'
                : 'text-[var(--red)]')}>
                {effectiveHiresCap} hires
              </span>
            </div>
          </div>

          {/* Pipeline goaling */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--text-body)]">Pipeline goaling calculator</h3>
            <p className="text-xs text-[var(--text-muted)]">Set your hiring target and conversion rates to see how many screens, interviews, and offers you need.</p>
            <div className="space-y-2">
              {[
                { label: 'Hiring target', val: hiringTarget, set: setHiringTarget, step: 1 },
                { label: 'Offer acceptance %', val: acceptanceRatePct, set: setAcceptanceRatePct, step: 1 },
                { label: 'Interviews per offer', val: interviewsPerOffer, set: setInterviewsPerOffer, step: 0.5 },
                { label: 'Screens per interview', val: screensPerInterview, set: setScreensPerInterview, step: 0.5 },
              ].map(({ label, val, set, step }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-[var(--text-body)]">{label}</span>
                  <input type="number" value={val} min={0} step={step}
                    onChange={e => set(parseFloat(e.target.value) || 0)}
                    className={numCls} />
                </div>
              ))}
            </div>
            <div className="pt-2 border-t border-[var(--border)] space-y-1.5">
              {[
                { label: 'Offers needed', value: pipeline.requiredOffers },
                { label: 'Interviews needed', value: pipeline.requiredInterviews },
                { label: 'Screens needed', value: pipeline.requiredScreens },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">{label}</span>
                  <span className="text-sm font-semibold text-[var(--text-bright)]">{value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: RECRUITING COST ESTIMATOR ── */}
      <section className="space-y-4">
        <SectionHeader icon={<Target size={15} />} title="Recruiting cost estimator" />
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
          <p className="text-xs text-[var(--text-muted)]">
            Global average time-to-fill: 44 days (≈ 1.5 months). Recruiting agency fee typically 15–25% of annual salary.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Annual salary (€)', val: salary, set: setSalary, step: 1000 },
              { label: 'Recruiting fee %', val: recruitPct, set: setRecruitPct, step: 1 },
              { label: 'Months to fill', val: monthsToFill, set: setMonthsToFill, step: 0.5 },
            ].map(({ label, val, set, step }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">{label}</label>
                <input type="number" value={val} min={0} step={step}
                  onChange={e => set(parseFloat(e.target.value) || 0)}
                  className={numCls + ' w-full'} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <StatCard label="Recruiting fee" value={`€${Math.round(cost.recruitingFee).toLocaleString()}`} />
            <StatCard label="Vacancy cost" value={`€${Math.round(cost.vacancyCost).toLocaleString()}`} sub="lost productivity while open" />
            <StatCard label="Total per hire" value={`€${Math.round(cost.totalCost).toLocaleString()}`} accent />
          </div>
        </div>
      </section>

      {/* ── SECTION 5: HEADCOUNT REGISTRY ── */}
      <HeadcountRegistrySection
        entries={entries} loading={loading} showForm={showForm} setShowForm={setShowForm}
        filterDept={filterDept} setFilterDept={setFilterDept}
        fRole={fRole} setFRole={setFRole} fDept={fDept} setFDept={setFDept}
        fCurrent={fCurrent} setFCurrent={setFCurrent} fTarget={fTarget} setFTarget={setFTarget}
        fOpen={fOpen} setFOpen={setFOpen} fAttrition={fAttrition} setFAttrition={setFAttrition}
        fStatus={fStatus} setFStatus={setFStatus} fTargetDate={fTargetDate} setFTargetDate={setFTargetDate}
        fHiringMgr={fHiringMgr} setFHiringMgr={setFHiringMgr}
        saving={saving} handleCreate={handleCreate} updateStatus={updateStatus} handleDelete={handleDelete}
      />
    </div>
  )
}
