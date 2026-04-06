/**
 * Pure capacity-planning calculations — no side effects, fully unit-testable.
 * Formula reference: AIHR Workforce Capacity Planning methodology.
 */

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
}

export interface CapacityResult {
  /** Total gross hours available (no adjustments) */
  grossHours: number
  /** Hours lost to absence */
  absenceHours: number
  /** Hours available after absence deduction */
  netHours: number
  /** Productive hours = netHours × utilization */
  productiveHours: number
  /** Productive hours per person */
  hoursPerPerson: number
}

/**
 * Calculate available productive capacity for a team over a period.
 */
export function calculateCapacity(inputs: CapacityInputs): CapacityResult {
  const { teamSize, hoursPerWeek, weeks, utilizationPct, absenceRatePct } = inputs

  const grossHours      = teamSize * hoursPerWeek * weeks
  const absenceHours    = grossHours * (absenceRatePct / 100)
  const netHours        = grossHours - absenceHours
  const productiveHours = netHours * (utilizationPct / 100)
  const hoursPerPerson  = teamSize > 0 ? productiveHours / teamSize : 0

  return { grossHours, absenceHours, netHours, productiveHours, hoursPerPerson }
}

export interface DemandItem {
  label: string
  hours: number
}

export interface GapResult {
  /** Total demand hours */
  demandHours: number
  /** Available productive hours */
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
 * @param availableHours  Result of calculateCapacity().productiveHours
 * @param demand          List of work items with estimated hours
 * @param hoursPerPerson  Productive hours per person (used to convert gap → FTEs)
 */
export function calculateGap(
  availableHours: number,
  demand: DemandItem[],
  hoursPerPerson: number,
): GapResult {
  const demandHours   = demand.reduce((s, d) => s + d.hours, 0)
  const gapHours      = availableHours - demandHours
  const coveragePct   = demandHours > 0 ? (availableHours / demandHours) * 100 : 100
  const fteNeeded     = gapHours < 0 && hoursPerPerson > 0
    ? Math.ceil(Math.abs(gapHours) / hoursPerPerson)
    : 0

  return { demandHours, availableHours, gapHours, coveragePct, fteNeeded }
}

/**
 * Estimate the minimum headcount required to meet a demand target.
 * @param demandHours        Total hours of work needed
 * @param hoursPerWeek       Working hours per week per person
 * @param weeks              Number of weeks in the period
 * @param utilizationPct     Target utilisation % (0–100)
 * @param absenceRatePct     Absence rate % (0–100)
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

/**
 * Estimate monthly cost of an open position (salary + recruiting overhead).
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
