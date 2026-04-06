/**
 * Pure capacity-planning calculations — no side effects, fully unit-testable.
 * Formula reference: AIHR Workforce Capacity Planning methodology.
 * Recruiting demand / funnel modelling based on interfacev3 Recruitment module.
 */

// ── Team Capacity ─────────────────────────────────────────────────────────────

export interface CapacityInputs {
  /** Number of people on the team */
  teamSize: number
  /** Working hours per week per person */
  hoursPerWeek: number
  /** Number of weeks in the planning period */
  weeks: number
  /** Target productive utilisation as a percentage (0–100). Typical: 75–85 */
  utilizationPct: number
  /** Expected absence/leave rate as a percentage (0–100). Typical: 4–8 */
  absenceRatePct: number
  /**
   * Admin / coordination overhead as a percentage of productive hours (0–100).
   * Covers meetings, admin, tool maintenance — separate from utilisation.
   * Typical: 10–20% for recruiting teams. Default: 0.
   */
  overheadPct?: number
}

export interface CapacityResult {
  /** Total gross hours available (no adjustments) */
  grossHours: number
  /** Hours lost to absence */
  absenceHours: number
  /** Hours available after absence deduction */
  netHours: number
  /** Productive hours = netHours × utilisation (before overhead) */
  productiveHours: number
  /** Hours consumed by admin overhead */
  overheadHours: number
  /** Effective hours = productiveHours × (1 − overhead%) — hours actually available for work */
  effectiveHours: number
  /** Effective hours per person */
  hoursPerPerson: number
}

/**
 * Calculate available effective capacity for a team over a period.
 * overheadPct (default 0) is applied after utilisation to model admin burden.
 */
export function calculateCapacity(inputs: CapacityInputs): CapacityResult {
  const { teamSize, hoursPerWeek, weeks, utilizationPct, absenceRatePct, overheadPct = 0 } = inputs

  const grossHours      = teamSize * hoursPerWeek * weeks
  const absenceHours    = grossHours * (absenceRatePct / 100)
  const netHours        = grossHours - absenceHours
  const productiveHours = netHours * (utilizationPct / 100)
  const overheadHours   = productiveHours * (overheadPct / 100)
  const effectiveHours  = productiveHours - overheadHours
  const hoursPerPerson  = teamSize > 0 ? effectiveHours / teamSize : 0

  return { grossHours, absenceHours, netHours, productiveHours, overheadHours, effectiveHours, hoursPerPerson }
}

// ── Demand Gap Analysis ───────────────────────────────────────────────────────

export interface DemandItem {
  label: string
  hours: number
}

export interface GapResult {
  /** Total demand hours */
  demandHours: number
  /** Available effective hours */
  availableHours: number
  /** Surplus (positive) or deficit (negative) */
  gapHours: number
  /** Coverage percentage: available / demand × 100 */
  coveragePct: number
  /** Additional FTEs needed to cover the gap (0 if no gap) */
  fteNeeded: number
}

/**
 * Calculate demand vs capacity gap.
 * @param availableHours  Result of calculateCapacity().effectiveHours
 * @param demand          List of work items with estimated hours
 * @param hoursPerPerson  Effective hours per person (used to convert gap → FTEs)
 */
export function calculateGap(
  availableHours: number,
  demand: DemandItem[],
  hoursPerPerson: number,
): GapResult {
  const demandHours = demand.reduce((s, d) => s + d.hours, 0)
  const gapHours    = availableHours - demandHours
  const coveragePct = demandHours > 0 ? (availableHours / demandHours) * 100 : 100
  const fteNeeded   = gapHours < 0 && hoursPerPerson > 0
    ? Math.ceil(Math.abs(gapHours) / hoursPerPerson)
    : 0

  return { demandHours, availableHours, gapHours, coveragePct, fteNeeded }
}

/**
 * Estimate the minimum headcount required to meet a demand target.
 */
export function headcountNeeded(
  demandHours: number,
  hoursPerWeek: number,
  weeks: number,
  utilizationPct: number,
  absenceRatePct: number,
): number {
  const availablePerPerson = hoursPerWeek * weeks * (1 - absenceRatePct / 100) * (utilizationPct / 100)
  return availablePerPerson > 0 ? Math.ceil(demandHours / availablePerPerson) : 0
}

// ── Role Complexity ───────────────────────────────────────────────────────────

export interface RoleComplexityItem {
  role: string
  /** Hours multiplier relative to a Junior hire (Junior = 1.0) */
  multiplier: number
  /** Average time to fill in calendar days */
  avgTimeToFill: number
}

/** Industry benchmarks for recruiting effort by seniority level */
export const DEFAULT_ROLE_COMPLEXITY: RoleComplexityItem[] = [
  { role: 'Junior',    multiplier: 1.0, avgTimeToFill: 20 },
  { role: 'Mid',       multiplier: 1.3, avgTimeToFill: 30 },
  { role: 'Senior',    multiplier: 1.8, avgTimeToFill: 45 },
  { role: 'Staff',     multiplier: 2.0, avgTimeToFill: 55 },
  { role: 'Principal', multiplier: 2.3, avgTimeToFill: 65 },
  { role: 'Manager',   multiplier: 2.5, avgTimeToFill: 50 },
  { role: 'Director',  multiplier: 2.8, avgTimeToFill: 70 },
  { role: 'Executive', multiplier: 3.5, avgTimeToFill: 90 },
]

/**
 * Apply role complexity weighting to a raw hire target.
 * Returns the weighted demand and the average complexity multiplier.
 *
 * @param totalHires  Raw number of hires needed
 * @param roleReqs    Map of role → number of hires planned at that level
 * @param complexity  Role complexity definitions (use DEFAULT_ROLE_COMPLEXITY as base)
 */
export function applyComplexityWeighting(
  totalHires: number,
  roleReqs: Record<string, number>,
  complexity: RoleComplexityItem[],
): { weightedDemand: number; avgComplexity: number } {
  let totalWeighted = 0
  let totalCount    = 0
  complexity.forEach(rc => {
    const count = roleReqs[rc.role] ?? 0
    totalWeighted += count * rc.multiplier
    totalCount    += count
  })
  const avgComplexity = totalCount > 0 ? totalWeighted / totalCount : 1
  return { weightedDemand: Math.round(totalHires * avgComplexity * 10) / 10, avgComplexity }
}

// ── Recruiting Demand Forecasting ─────────────────────────────────────────────

export interface RecruitingDemandInputs {
  /** Currently open roles (existing backlog) */
  openRoles: number
  /** Expected new requisitions opening per month */
  newReqsPerMonth: number
  /** Annual attrition rate % — used to estimate backfill need */
  attritionRatePct: number
  /** Planning horizon in months */
  planningHorizonMonths: number
}

export interface RecruitingDemandResult {
  /** Hires needed for existing open roles */
  fromBacklog: number
  /** Hires needed for net new requisitions over the period */
  fromNewReqs: number
  /** Hires needed to backfill attrition over the period */
  fromAttrition: number
  /** Total hires needed over the planning horizon */
  totalHiresNeeded: number
}

/**
 * Forecast total hiring demand across three sources:
 * existing open roles, new requisitions, and attrition-driven backfills.
 */
export function calculateRecruitingDemand(d: RecruitingDemandInputs): RecruitingDemandResult {
  const fromBacklog   = d.openRoles
  const fromNewReqs   = d.newReqsPerMonth * d.planningHorizonMonths
  const fromAttrition = Math.ceil(d.openRoles * (d.attritionRatePct / 100) * (d.planningHorizonMonths / 12))
  return {
    fromBacklog,
    fromNewReqs,
    fromAttrition,
    totalHiresNeeded: fromBacklog + fromNewReqs + fromAttrition,
  }
}

// ── Funnel Velocity ───────────────────────────────────────────────────────────

export interface FunnelStage {
  stage: string
  /** Hours spent per hire at this stage */
  hours: number
}

/** Default recruiter hours per hire by pipeline stage */
export const DEFAULT_FUNNEL_STAGES: FunnelStage[] = [
  { stage: 'Sourcing',          hours: 6 },
  { stage: 'Screening',         hours: 3 },
  { stage: 'Interview Coord.',  hours: 4 },
  { stage: 'Offer / Close',     hours: 2 },
]

/**
 * Sum recruiter hours across all funnel stages to get total hours per hire.
 */
export function calculateFunnelVelocity(stages: FunnelStage[]): number {
  return stages.reduce((s, f) => s + f.hours, 0)
}

// ── Pipeline Goaling ──────────────────────────────────────────────────────────

export interface PipelineGoalResult {
  /** Offers that must be extended to hit the hiring target */
  requiredOffers: number
  /** Interviews needed to generate that many offers */
  requiredInterviews: number
  /** Screens needed to generate that many interviews */
  requiredScreens: number
}

/**
 * Work backwards from a hiring target through funnel conversion rates
 * to determine how many screens, interviews, and offers are needed.
 *
 * @param hiringTarget        Number of hires to achieve
 * @param acceptanceRatePct   Offer acceptance rate % (e.g. 85)
 * @param interviewsPerOffer  Interviews run per offer extended
 * @param screensPerInterview Phone screens per interview advanced
 */
export function calculatePipelineGoal(
  hiringTarget: number,
  acceptanceRatePct: number,
  interviewsPerOffer: number,
  screensPerInterview: number,
): PipelineGoalResult {
  const acceptance = acceptanceRatePct / 100
  const requiredOffers     = acceptance > 0 ? Math.ceil(hiringTarget / acceptance) : 0
  const requiredInterviews = requiredOffers * interviewsPerOffer
  const requiredScreens    = requiredInterviews * screensPerInterview
  return { requiredOffers, requiredInterviews, requiredScreens }
}

// ── Cost Estimation ───────────────────────────────────────────────────────────

/**
 * Estimate the total cost of an open position (recruiting fee + vacancy cost).
 * @param annualSalary      Target annual salary for the role
 * @param recruitingCostPct Recruiting cost as % of annual salary (typical: 15–25%)
 * @param monthsToFill      Expected time-to-fill in months (global avg: ~1.5)
 */
export function estimateRecruitingCost(
  annualSalary: number,
  recruitingCostPct: number,
  monthsToFill: number,
): { recruitingFee: number; vacancyCost: number; totalCost: number } {
  const recruitingFee = annualSalary * (recruitingCostPct / 100)
  const vacancyCost   = (annualSalary / 12) * monthsToFill
  return { recruitingFee, vacancyCost, totalCost: recruitingFee + vacancyCost }
}
