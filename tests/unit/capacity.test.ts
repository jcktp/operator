import { describe, it, expect } from 'vitest'
import {
  calculateCapacity,
  calculateGap,
  headcountNeeded,
  estimateRecruitingCost,
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
    const r = calculateCapacity(base)
    // 5 × 40 × 12 = 2400
    expect(r.grossHours).toBe(2400)
  })

  it('computes absenceHours correctly', () => {
    const r = calculateCapacity(base)
    // 2400 × 5% = 120
    expect(r.absenceHours).toBeCloseTo(120)
  })

  it('computes netHours correctly', () => {
    const r = calculateCapacity(base)
    // 2400 - 120 = 2280
    expect(r.netHours).toBeCloseTo(2280)
  })

  it('computes productiveHours correctly', () => {
    const r = calculateCapacity(base)
    // 2280 × 80% = 1824
    expect(r.productiveHours).toBeCloseTo(1824)
  })

  it('computes hoursPerPerson correctly', () => {
    const r = calculateCapacity(base)
    // 1824 / 5 = 364.8
    expect(r.hoursPerPerson).toBeCloseTo(364.8)
  })

  it('returns zero hoursPerPerson when teamSize is 0', () => {
    const r = calculateCapacity({ ...base, teamSize: 0 })
    expect(r.hoursPerPerson).toBe(0)
  })

  it('handles zero absence rate', () => {
    const r = calculateCapacity({ ...base, absenceRatePct: 0 })
    expect(r.absenceHours).toBe(0)
    expect(r.netHours).toBe(r.grossHours)
  })

  it('handles 100% utilization', () => {
    const r = calculateCapacity({ ...base, utilizationPct: 100, absenceRatePct: 0 })
    expect(r.productiveHours).toBe(r.grossHours)
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
    const r = calculateGap(1000, demand, 200)
    expect(r.demandHours).toBe(900)
  })

  it('calculates surplus gap correctly', () => {
    const r = calculateGap(1000, demand, 200)
    // 1000 - 900 = +100 surplus
    expect(r.gapHours).toBeCloseTo(100)
    expect(r.fteNeeded).toBe(0)
  })

  it('calculates deficit gap and FTEs needed', () => {
    // 500 available, 900 demand → deficit of 400, 400/200 = 2 FTE
    const r = calculateGap(500, demand, 200)
    expect(r.gapHours).toBeCloseTo(-400)
    expect(r.fteNeeded).toBe(2)
  })

  it('rounds FTEs up (ceil)', () => {
    // deficit 350, hoursPerPerson 200 → ceil(350/200) = 2
    const r = calculateGap(550, demand, 200)
    expect(r.gapHours).toBeCloseTo(-350)
    expect(r.fteNeeded).toBe(2)
  })

  it('calculates coverage percentage', () => {
    const r = calculateGap(900, demand, 200)
    // 900/900 × 100 = 100%
    expect(r.coveragePct).toBeCloseTo(100)
  })

  it('returns 100% coverage when demand is 0', () => {
    const r = calculateGap(500, [], 200)
    expect(r.coveragePct).toBe(100)
    expect(r.demandHours).toBe(0)
    expect(r.fteNeeded).toBe(0)
  })

  it('returns 0 fteNeeded when hoursPerPerson is 0 (guard)', () => {
    const r = calculateGap(0, demand, 0)
    expect(r.fteNeeded).toBe(0)
  })
})

// ── headcountNeeded ────────────────────────────────────────────────────────

describe('headcountNeeded', () => {
  it('calculates correct headcount for typical inputs', () => {
    // 1824 demand hours, 40h/wk, 12 weeks, 80% util, 5% absence
    // availablePerPerson = 40 × 12 × 0.95 × 0.80 = 364.8
    // ceil(1824 / 364.8) = 5
    const n = headcountNeeded(1824, 40, 12, 80, 5)
    expect(n).toBe(5)
  })

  it('rounds up to the next whole person', () => {
    // availablePerPerson = 40 × 12 × 1.0 × 1.0 = 480
    // ceil(481 / 480) = 2
    const n = headcountNeeded(481, 40, 12, 100, 0)
    expect(n).toBe(2)
  })

  it('returns 0 when availablePerPerson is 0', () => {
    const n = headcountNeeded(1000, 40, 12, 0, 100)
    expect(n).toBe(0)
  })

  it('handles zero demand', () => {
    const n = headcountNeeded(0, 40, 12, 80, 5)
    expect(n).toBe(0)
  })
})

// ── estimateRecruitingCost ─────────────────────────────────────────────────

describe('estimateRecruitingCost', () => {
  it('calculates recruiting fee as percentage of salary', () => {
    const r = estimateRecruitingCost(60000, 20, 1.5)
    // 60000 × 20% = 12000
    expect(r.recruitingFee).toBeCloseTo(12000)
  })

  it('calculates vacancy cost as monthly salary × months', () => {
    const r = estimateRecruitingCost(60000, 20, 1.5)
    // (60000/12) × 1.5 = 5000 × 1.5 = 7500
    expect(r.vacancyCost).toBeCloseTo(7500)
  })

  it('sums total cost correctly', () => {
    const r = estimateRecruitingCost(60000, 20, 1.5)
    expect(r.totalCost).toBeCloseTo(19500)
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
