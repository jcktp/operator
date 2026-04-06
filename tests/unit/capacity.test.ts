import { describe, it, expect } from 'vitest'
import {
  calculateCapacity,
  calculateGap,
  headcountNeeded,
  estimateRecruitingCost,
  calculateRecruitingDemand,
  applyComplexityWeighting,
  calculateFunnelVelocity,
  calculatePipelineGoal,
  DEFAULT_ROLE_COMPLEXITY,
  DEFAULT_FUNNEL_STAGES,
  type CapacityInputs,
  type DemandItem,
} from '@/lib/capacity'

// ── calculateCapacity ──────────────────────────────────────────────────────

describe('calculateCapacity', () => {
  const base: CapacityInputs = {
    teamSize: 5,
    hoursPerWeek: 40,
    weeks: 12,
    utilizationPct: 80,
    absenceRatePct: 5,
  }

  it('computes grossHours correctly', () => {
    // 5 × 40 × 12 = 2400
    expect(calculateCapacity(base).grossHours).toBe(2400)
  })

  it('computes absenceHours correctly', () => {
    // 2400 × 5% = 120
    expect(calculateCapacity(base).absenceHours).toBeCloseTo(120)
  })

  it('computes netHours correctly', () => {
    // 2400 - 120 = 2280
    expect(calculateCapacity(base).netHours).toBeCloseTo(2280)
  })

  it('computes productiveHours correctly', () => {
    // 2280 × 80% = 1824
    expect(calculateCapacity(base).productiveHours).toBeCloseTo(1824)
  })

  it('returns zero overheadHours when overheadPct is omitted', () => {
    expect(calculateCapacity(base).overheadHours).toBe(0)
  })

  it('effectiveHours equals productiveHours when overheadPct is 0', () => {
    const r = calculateCapacity(base)
    expect(r.effectiveHours).toBeCloseTo(r.productiveHours)
  })

  it('applies overhead correctly', () => {
    // 1824 productive × 15% overhead = 273.6 overhead; effective = 1550.4
    const r = calculateCapacity({ ...base, overheadPct: 15 })
    expect(r.overheadHours).toBeCloseTo(273.6)
    expect(r.effectiveHours).toBeCloseTo(1550.4)
  })

  it('computes hoursPerPerson from effectiveHours', () => {
    // no overhead: 1824 / 5 = 364.8
    expect(calculateCapacity(base).hoursPerPerson).toBeCloseTo(364.8)
  })

  it('hoursPerPerson accounts for overhead', () => {
    // overhead 15%: 1550.4 / 5 = 310.08
    expect(calculateCapacity({ ...base, overheadPct: 15 }).hoursPerPerson).toBeCloseTo(310.08)
  })

  it('returns zero hoursPerPerson when teamSize is 0', () => {
    expect(calculateCapacity({ ...base, teamSize: 0 }).hoursPerPerson).toBe(0)
  })

  it('handles zero absence rate', () => {
    const r = calculateCapacity({ ...base, absenceRatePct: 0 })
    expect(r.absenceHours).toBe(0)
    expect(r.netHours).toBe(r.grossHours)
  })
})

// ── calculateGap ───────────────────────────────────────────────────────────

describe('calculateGap', () => {
  const demand: DemandItem[] = [
    { label: 'Feature A', hours: 400 },
    { label: 'Feature B', hours: 300 },
    { label: 'Support',   hours: 200 },
  ]

  it('sums demand hours correctly', () => {
    expect(calculateGap(1000, demand, 200).demandHours).toBe(900)
  })

  it('calculates surplus gap correctly', () => {
    const r = calculateGap(1000, demand, 200)
    expect(r.gapHours).toBeCloseTo(100)
    expect(r.fteNeeded).toBe(0)
  })

  it('calculates deficit gap and FTEs needed', () => {
    // deficit 400, hoursPerPerson 200 → 2 FTE
    const r = calculateGap(500, demand, 200)
    expect(r.gapHours).toBeCloseTo(-400)
    expect(r.fteNeeded).toBe(2)
  })

  it('rounds FTEs up (ceil)', () => {
    // deficit 350, hoursPerPerson 200 → ceil(1.75) = 2
    const r = calculateGap(550, demand, 200)
    expect(r.fteNeeded).toBe(2)
  })

  it('calculates coverage percentage', () => {
    expect(calculateGap(900, demand, 200).coveragePct).toBeCloseTo(100)
  })

  it('returns 100% coverage when demand is 0', () => {
    const r = calculateGap(500, [], 200)
    expect(r.coveragePct).toBe(100)
    expect(r.fteNeeded).toBe(0)
  })

  it('returns 0 fteNeeded when hoursPerPerson is 0', () => {
    expect(calculateGap(0, demand, 0).fteNeeded).toBe(0)
  })
})

// ── headcountNeeded ────────────────────────────────────────────────────────

describe('headcountNeeded', () => {
  it('calculates correct headcount for typical inputs', () => {
    // 1824 demand, 40h/wk, 12 weeks, 80% util, 5% absence → availablePerPerson = 364.8 → ceil(1824/364.8) = 5
    expect(headcountNeeded(1824, 40, 12, 80, 5)).toBe(5)
  })

  it('rounds up to the next whole person', () => {
    // ceil(481/480) = 2
    expect(headcountNeeded(481, 40, 12, 100, 0)).toBe(2)
  })

  it('returns 0 when availablePerPerson is 0', () => {
    expect(headcountNeeded(1000, 40, 12, 0, 100)).toBe(0)
  })

  it('handles zero demand', () => {
    expect(headcountNeeded(0, 40, 12, 80, 5)).toBe(0)
  })
})

// ── estimateRecruitingCost ─────────────────────────────────────────────────

describe('estimateRecruitingCost', () => {
  it('calculates recruiting fee as percentage of salary', () => {
    expect(estimateRecruitingCost(60000, 20, 1.5).recruitingFee).toBeCloseTo(12000)
  })

  it('calculates vacancy cost as monthly salary × months', () => {
    // (60000/12) × 1.5 = 7500
    expect(estimateRecruitingCost(60000, 20, 1.5).vacancyCost).toBeCloseTo(7500)
  })

  it('sums total cost correctly', () => {
    expect(estimateRecruitingCost(60000, 20, 1.5).totalCost).toBeCloseTo(19500)
  })

  it('handles zero recruiting cost percentage', () => {
    const r = estimateRecruitingCost(60000, 0, 2)
    expect(r.recruitingFee).toBe(0)
    expect(r.totalCost).toBeCloseTo(10000)
  })

  it('handles zero months to fill', () => {
    const r = estimateRecruitingCost(60000, 20, 0)
    expect(r.vacancyCost).toBe(0)
    expect(r.totalCost).toBeCloseTo(12000)
  })
})

// ── calculateRecruitingDemand ─────────────────────────────────────────────

describe('calculateRecruitingDemand', () => {
  const base = { openRoles: 20, newReqsPerMonth: 5, attritionRatePct: 12, planningHorizonMonths: 6 }

  it('fromBacklog equals openRoles', () => {
    expect(calculateRecruitingDemand(base).fromBacklog).toBe(20)
  })

  it('fromNewReqs equals newReqsPerMonth × horizon', () => {
    // 5 × 6 = 30
    expect(calculateRecruitingDemand(base).fromNewReqs).toBe(30)
  })

  it('fromAttrition is ceil of openRoles × attrition% × horizon/12', () => {
    // ceil(20 × 0.12 × 0.5) = ceil(1.2) = 2
    expect(calculateRecruitingDemand(base).fromAttrition).toBe(2)
  })

  it('totalHiresNeeded sums all three sources', () => {
    // 20 + 30 + 2 = 52
    expect(calculateRecruitingDemand(base).totalHiresNeeded).toBe(52)
  })

  it('handles zero new reqs per month', () => {
    const r = calculateRecruitingDemand({ ...base, newReqsPerMonth: 0 })
    expect(r.fromNewReqs).toBe(0)
    expect(r.totalHiresNeeded).toBe(r.fromBacklog + r.fromAttrition)
  })

  it('handles zero attrition', () => {
    const r = calculateRecruitingDemand({ ...base, attritionRatePct: 0 })
    expect(r.fromAttrition).toBe(0)
  })
})

// ── applyComplexityWeighting ──────────────────────────────────────────────

describe('applyComplexityWeighting', () => {
  it('returns avgComplexity 1.0 when only Junior roles', () => {
    const r = applyComplexityWeighting(10, { Junior: 10 }, DEFAULT_ROLE_COMPLEXITY)
    expect(r.avgComplexity).toBeCloseTo(1.0)
    expect(r.weightedDemand).toBeCloseTo(10)
  })

  it('applies Executive multiplier correctly', () => {
    const r = applyComplexityWeighting(10, { Executive: 10 }, DEFAULT_ROLE_COMPLEXITY)
    expect(r.avgComplexity).toBeCloseTo(3.5)
    expect(r.weightedDemand).toBeCloseTo(35)
  })

  it('averages complexity across mixed levels', () => {
    // 5 Junior (1.0) + 5 Senior (1.8) → avg = 1.4
    const r = applyComplexityWeighting(10, { Junior: 5, Senior: 5 }, DEFAULT_ROLE_COMPLEXITY)
    expect(r.avgComplexity).toBeCloseTo(1.4)
    expect(r.weightedDemand).toBeCloseTo(14)
  })

  it('defaults to avgComplexity 1.0 when roleReqs is empty', () => {
    const r = applyComplexityWeighting(10, {}, DEFAULT_ROLE_COMPLEXITY)
    expect(r.avgComplexity).toBe(1)
    expect(r.weightedDemand).toBeCloseTo(10)
  })
})

// ── calculateFunnelVelocity ───────────────────────────────────────────────

describe('calculateFunnelVelocity', () => {
  it('sums default funnel stages to 15 hours', () => {
    // sourcing 6 + screening 3 + interview coord 4 + offer/close 2 = 15
    expect(calculateFunnelVelocity(DEFAULT_FUNNEL_STAGES)).toBe(15)
  })

  it('returns 0 for empty stages', () => {
    expect(calculateFunnelVelocity([])).toBe(0)
  })

  it('sums custom stages correctly', () => {
    expect(calculateFunnelVelocity([{ stage: 'A', hours: 10 }, { stage: 'B', hours: 5 }])).toBe(15)
  })
})

// ── calculatePipelineGoal ─────────────────────────────────────────────────

describe('calculatePipelineGoal', () => {
  it('calculates required offers from acceptance rate', () => {
    // ceil(30 / 0.85) = ceil(35.29) = 36
    expect(calculatePipelineGoal(30, 85, 4, 3).requiredOffers).toBe(36)
  })

  it('calculates required interviews', () => {
    // 36 offers × 4 interviews = 144
    expect(calculatePipelineGoal(30, 85, 4, 3).requiredInterviews).toBe(144)
  })

  it('calculates required screens', () => {
    // 144 interviews × 3 screens = 432
    expect(calculatePipelineGoal(30, 85, 4, 3).requiredScreens).toBe(432)
  })

  it('returns 0 offers when acceptance rate is 0', () => {
    expect(calculatePipelineGoal(30, 0, 4, 3).requiredOffers).toBe(0)
  })

  it('handles 100% acceptance rate', () => {
    // ceil(30/1.0) = 30 offers
    expect(calculatePipelineGoal(30, 100, 4, 3).requiredOffers).toBe(30)
  })
})

// ── DEFAULT constants ─────────────────────────────────────────────────────

describe('DEFAULT_ROLE_COMPLEXITY', () => {
  it('has 8 levels', () => {
    expect(DEFAULT_ROLE_COMPLEXITY).toHaveLength(8)
  })

  it('Junior has multiplier 1.0', () => {
    const junior = DEFAULT_ROLE_COMPLEXITY.find(r => r.role === 'Junior')
    expect(junior?.multiplier).toBe(1.0)
  })

  it('Executive has the highest multiplier', () => {
    const maxMultiplier = Math.max(...DEFAULT_ROLE_COMPLEXITY.map(r => r.multiplier))
    const exec = DEFAULT_ROLE_COMPLEXITY.find(r => r.role === 'Executive')
    expect(exec?.multiplier).toBe(maxMultiplier)
  })

  it('Executive has the longest time to fill', () => {
    const maxTtf = Math.max(...DEFAULT_ROLE_COMPLEXITY.map(r => r.avgTimeToFill))
    const exec = DEFAULT_ROLE_COMPLEXITY.find(r => r.role === 'Executive')
    expect(exec?.avgTimeToFill).toBe(maxTtf)
  })
})
