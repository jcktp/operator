'use client'

import { TrendingUp } from 'lucide-react'
import { type RoleComplexityItem } from '@/lib/capacity'
import { StatCard, SectionHeader, numCls, inputCls } from './capacity-shared'

interface RecruitingDemandSectionProps {
  openRoles: number; setOpenRoles: (v: number) => void
  newReqsPerMonth: number; setNewReqsPerMonth: (v: number) => void
  attritionPct: number; setAttritionPct: (v: number) => void
  horizonMonths: 3 | 6 | 12; setHorizonMonths: (v: 3 | 6 | 12) => void
  recruitDemand: { fromBacklog: number; fromNewReqs: number; fromAttrition: number; totalHiresNeeded: number }
  complexity: RoleComplexityItem[]; setComplexity: (v: RoleComplexityItem[] | ((prev: RoleComplexityItem[]) => RoleComplexityItem[])) => void
  roleReqs: Record<string, number>; setRoleReqs: (v: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void
  weightedDemand: number; avgComplexity: number
  effectiveHiresCap: number; effectiveHours: number; totalHoursPerHire: number
  hireStatus: 'green' | 'yellow' | 'red'
  additionalRecsNeeded: number; hoursPerPerson: number
}

export default function RecruitingDemandSection(props: RecruitingDemandSectionProps) {
  const {
    openRoles, setOpenRoles, newReqsPerMonth, setNewReqsPerMonth,
    attritionPct, setAttritionPct, horizonMonths, setHorizonMonths,
    recruitDemand, complexity, setComplexity, roleReqs, setRoleReqs,
    weightedDemand, avgComplexity, effectiveHiresCap, effectiveHours, totalHoursPerHire,
    hireStatus, additionalRecsNeeded,
  } = props

  return (
    <section className="space-y-4">
      <SectionHeader icon={<TrendingUp size={15} />} title="Recruiting demand planner" />

      {/* Demand inputs */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-4">
        <p className="text-xs text-[var(--text-muted)]">
          Forecasts total hiring demand across three sources: existing open roles, new requisitions, and attrition-driven backfills.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Open roles now</label>
            <input type="number" value={openRoles} min={0} onChange={e => setOpenRoles(parseInt(e.target.value) || 0)} className={numCls + ' w-full'} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">New reqs / month</label>
            <input type="number" value={newReqsPerMonth} min={0} onChange={e => setNewReqsPerMonth(parseInt(e.target.value) || 0)} className={numCls + ' w-full'} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Attrition rate % / yr</label>
            <input type="number" value={attritionPct} min={0} max={100} onChange={e => setAttritionPct(parseFloat(e.target.value) || 0)} className={numCls + ' w-full'} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Planning horizon</label>
            <select value={horizonMonths} onChange={e => setHorizonMonths(parseInt(e.target.value) as 3 | 6 | 12)} className={inputCls}>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-[var(--border)]">
          <StatCard label="From backlog" value={recruitDemand.fromBacklog.toString()} sub="existing open roles" />
          <StatCard label="From new reqs" value={recruitDemand.fromNewReqs.toString()} sub={`${newReqsPerMonth}/mo × ${horizonMonths} mo`} />
          <StatCard label="Attrition fills" value={recruitDemand.fromAttrition.toString()} sub={`${attritionPct}% annual churn`} />
          <StatCard label="Total hires needed" value={recruitDemand.totalHiresNeeded.toString()} accent />
        </div>
      </div>

      {/* Role complexity */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--text-body)]">Role complexity weighting</h3>
          <span className="text-[11px] text-[var(--text-muted)]">Avg complexity: <span className="font-medium text-[var(--text-body)]">{avgComplexity.toFixed(2)}x</span></span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Each seniority level carries a complexity multiplier — an Executive role demands 3.5x more recruiter effort than a Junior hire.
          Set how many of each level you need to fill.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="pb-2 font-medium">Level</th>
                <th className="pb-2 font-medium text-right">Multiplier</th>
                <th className="pb-2 font-medium text-right">Avg days to fill</th>
                <th className="pb-2 font-medium text-right">Hires needed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/50">
              {complexity.map((rc, i) => (
                <tr key={rc.role}>
                  <td className="py-1.5 font-medium text-[var(--text-body)]">{rc.role}</td>
                  <td className="py-1.5 text-right">
                    <input type="number" value={rc.multiplier} min={0.1} step={0.1}
                      onChange={e => setComplexity(prev => prev.map((x, j) => j === i ? { ...x, multiplier: parseFloat(e.target.value) || 1 } : x))}
                      className="w-16 border border-[var(--border)] rounded px-2 py-0.5 text-right focus:outline-none" />
                  </td>
                  <td className="py-1.5 text-right">
                    <input type="number" value={rc.avgTimeToFill} min={1}
                      onChange={e => setComplexity(prev => prev.map((x, j) => j === i ? { ...x, avgTimeToFill: parseInt(e.target.value) || 1 } : x))}
                      className="w-16 border border-[var(--border)] rounded px-2 py-0.5 text-right focus:outline-none" />
                  </td>
                  <td className="py-1.5 text-right">
                    <input type="number" value={roleReqs[rc.role] ?? 0} min={0}
                      onChange={e => setRoleReqs(prev => ({ ...prev, [rc.role]: parseInt(e.target.value) || 0 }))}
                      className="w-16 border border-[var(--border)] rounded px-2 py-0.5 text-right focus:outline-none" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
          <StatCard label="Raw demand" value={recruitDemand.totalHiresNeeded.toString()} sub="hires needed" />
          <StatCard label="Complexity adj." value={weightedDemand.toFixed(1)} sub={`${avgComplexity.toFixed(2)}x avg complexity`} accent />
          <StatCard label="Effective hires capacity" value={effectiveHiresCap.toString()}
            sub={`${Math.round(effectiveHours)} h / ${totalHoursPerHire} h/hire`}
            status={hireStatus} />
        </div>

        {additionalRecsNeeded > 0 && (
          <p className="text-xs text-[var(--red)] font-medium pt-1">
            Capacity gap: need ~{additionalRecsNeeded} additional recruiter{additionalRecsNeeded !== 1 ? 's' : ''} to cover complexity-adjusted demand over {horizonMonths} months.
          </p>
        )}
      </div>
    </section>
  )
}
