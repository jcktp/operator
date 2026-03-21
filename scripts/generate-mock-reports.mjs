import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const OUT = join(homedir(), 'Desktop', 'operator-mock-reports')
import { mkdirSync } from 'fs'
mkdirSync(OUT, { recursive: true })

// ─── 1. CFO — Finance Report (Excel) ─────────────────────────────────────────
const financeWb = XLSX.utils.book_new()

const summaryData = [
  ['Acme Corp — Finance Report', '', 'March 2026'],
  ['Prepared by: Sarah Chen, CFO', '', ''],
  ['', '', ''],
  ['P&L SUMMARY', '', ''],
  ['', 'Actual', 'Budget', 'Variance', '% Var'],
  ['Revenue', 4210000, 4500000, -290000, '-6.4%'],
  ['Cost of Goods Sold', 1560000, 1620000, 60000, '3.7%'],
  ['Gross Profit', 2650000, 2880000, -230000, '-8.0%'],
  ['Gross Margin %', '63.0%', '64.0%', '', '-1.0pp'],
  ['', '', '', '', ''],
  ['Operating Expenses', '', '', '', ''],
  ['  Sales & Marketing', 820000, 900000, 80000, '8.9%'],
  ['  R&D', 610000, 580000, -30000, '-5.2%'],
  ['  G&A', 290000, 310000, 20000, '6.5%'],
  ['  Total OpEx', 1720000, 1790000, 70000, '3.9%'],
  ['', '', '', '', ''],
  ['EBITDA', 930000, 1090000, -160000, '-14.7%'],
  ['EBITDA Margin %', '22.1%', '24.2%', '', '-2.2pp'],
  ['Net Income', 640000, 810000, -170000, '-21.0%'],
]

const cashData = [
  ['CASH & LIQUIDITY', ''],
  ['Cash on Hand', '$12.4M'],
  ['Cash Burn (MTD)', '$1.1M'],
  ['Runway at Current Burn', '11.3 months'],
  ['', ''],
  ['ACCOUNTS RECEIVABLE', ''],
  ['Total AR', '$3.2M'],
  ['  0–30 days', '$1.8M'],
  ['  31–60 days', '$0.9M'],
  ['  60+ days (overdue)', '$0.5M'],
  ['DSO (Days Sales Outstanding)', '38 days'],
  ['Previous month DSO', '31 days'],
  ['', ''],
  ['HEADCOUNT COST', ''],
  ['Total Payroll (March)', '$2.1M'],
  ['vs. Prior Month', '+$48K (+2.3%)'],
  ['Headcount (EOP)', '142'],
]

const revenueData = [
  ['REVENUE BREAKDOWN', '', ''],
  ['Segment', 'March Actual', 'March Budget'],
  ['Enterprise', 2480000, 2700000],
  ['Mid-Market', 1120000, 1100000],
  ['SMB', 510000, 600000],
  ['Professional Services', 100000, 100000],
  ['Total', 4210000, 4500000],
  ['', '', ''],
  ['ARR METRICS', '', ''],
  ['ARR (End of Period)', '$48.2M', ''],
  ['ARR Growth (YoY)', '+18%', ''],
  ['Net Revenue Retention (NRR)', '108%', ''],
  ['Gross Revenue Retention (GRR)', '91%', ''],
  ['New ARR (March)', '$1.1M', ''],
  ['Churned ARR (March)', '$0.62M', ''],
  ['Expansion ARR (March)', '$0.48M', ''],
]

XLSX.utils.book_append_sheet(financeWb, XLSX.utils.aoa_to_sheet(summaryData), 'P&L Summary')
XLSX.utils.book_append_sheet(financeWb, XLSX.utils.aoa_to_sheet(cashData), 'Cash & AR')
XLSX.utils.book_append_sheet(financeWb, XLSX.utils.aoa_to_sheet(revenueData), 'Revenue')
XLSX.writeFile(financeWb, join(OUT, 'finance_report_march_2026.xlsx'))
console.log('✓ finance_report_march_2026.xlsx')


// ─── 2. CHRO — HR & People Report (CSV) ──────────────────────────────────────
const hrCsv = `HR & People Report — Q1 2026
Prepared by: Marcus Webb, Chief People Officer
Date: March 31 2026

HEADCOUNT SUMMARY
Metric,Value,Prior Month,Change
Total Headcount,142,138,+4
Full-Time Employees,131,128,+3
Contractors,11,10,+1
Open Roles,19,14,+5
Offer Acceptance Rate,74%,81%,-7pp

HEADCOUNT BY DEPARTMENT
Department,HC,Budget HC,Delta
Engineering,54,58,-4
Sales,32,34,-2
Marketing,18,18,0
Customer Success,16,14,+2
Finance,8,8,0
HR & People,6,6,0
Product,5,6,-1
Legal,3,3,0
Total,142,147,-5

ATTRITION
Metric,Q1 2026,Q4 2025
Total Attrition,6,4
Regrettable Attrition,4,2
Annualised Attrition Rate,16.9%,11.3%
Engineering Attrition,3,1

ATTRITION DETAIL
Name,Department,Tenure,Type,Reason
[Redacted],Engineering,2.1 yrs,Regrettable,Comp — accepted 35% raise at competitor
[Redacted],Engineering,3.4 yrs,Regrettable,Career growth — moved to Staff role elsewhere
[Redacted],Sales,0.8 yrs,Non-regrettable,Performance managed out
[Redacted],Engineering,1.2 yrs,Regrettable,Relocation
[Redacted],Marketing,4.1 yrs,Non-regrettable,Personal reasons
[Redacted],CS,0.5 yrs,Non-regrettable,Misaligned role

COMPENSATION & ENGAGEMENT
Metric,Value,Note
Median Base Salary,£72400,+3.1% vs. prior year
Engineering P50 vs. Market,88th percentile,Radford March 2026 cut
Avg Tenure,2.3 yrs,Down from 2.7 yrs in Q4
eNPS Score (March),+22,Down from +34 in Q4
Survey Participation Rate,78%,Target is 80%
eNPS Benchmark (SaaS),+31,We are 9 points below benchmark

OPEN ROLES
Role,Department,Days Open,Status
Senior Software Engineer x3,Engineering,42,3 in final round
Staff Engineer,Engineering,67,Offer declined — reopened
Product Designer,Product,28,Screening
Enterprise AE x2,Sales,18,Interviewing
SDR x2,Sales,12,Offer stage
Customer Success Manager,CS,35,Offer accepted — starts April 14
Data Analyst,Finance,51,On hold — budget review

NOTES FROM CHRO
- Engineering attrition is a concern. Q1 saw 3 regrettable departures vs. 1 in Q4. Exit interviews cite compensation as primary factor in 2 of 3 cases. Recommend compensation review for IC4-IC6 band before end of Q2.
- eNPS drop from +34 to +22 requires attention. Pulse survey open comments cite uncertainty around growth path and lack of clarity on promotion criteria.
- Staff Engineer role has been open 67 days with one declined offer. Considering narrowing scope or adjusting comp band.
- Budget approval needed for Data Analyst role to proceed.
`
writeFileSync(join(OUT, 'hr_people_report_q1_2026.csv'), hrCsv)
console.log('✓ hr_people_report_q1_2026.csv')


// ─── 3. VP Sales — Sales Report (Text) ───────────────────────────────────────
const salesReport = `SALES REPORT — MARCH 2026
Prepared by: James Okafor, VP Sales
Date: April 1, 2026

──────────────────────────────────────────────
HEADLINE NUMBERS
──────────────────────────────────────────────
New ARR Closed (March):     $1,100,000
March Quota:                $1,500,000
Attainment:                 73.3%

Q1 New ARR:                 $3,140,000
Q1 Quota:                   $4,200,000
Q1 Attainment:              74.8%

YTD vs. Prior Year:         -8% (Q1 2025 was $3.42M)

──────────────────────────────────────────────
PIPELINE
──────────────────────────────────────────────
Total Open Pipeline:        $14.2M
Stage 3+ Pipeline:          $6.8M
Pipeline Coverage (Q2):     2.8x  [target: 3.5x]

New Pipe Generated (March): $2.1M
New Pipe Target (March):    $3.0M
Pipeline Attainment:        70%

Average Deal Size:          $84,000 (up from $71K in Q1 2025)
Average Sales Cycle:        67 days (up from 54 days)
Win Rate (YTD):             22%  (down from 28% in 2025)

──────────────────────────────────────────────
DEALS CLOSED — MARCH
──────────────────────────────────────────────
Customer            Segment       ARR         Notes
────────────────────────────────────────────────────────────────
FinCo Holdings      Enterprise    $340,000    Expanded from pilot
Merkle & Sons       Mid-Market    $128,000    New logo
DataBridge GmbH     Enterprise    $220,000    Competitive win vs. Vendor B
Orbit Logistics     Mid-Market    $96,000     New logo
Cascade Retail      SMB           $44,000     New logo
PulseHealth         Mid-Market    $112,000    New logo
TerraLink           SMB           $38,000     New logo
Synergy Partners    Enterprise    $122,000    Renewal + expansion

──────────────────────────────────────────────
DEALS LOST — MARCH
──────────────────────────────────────────────
Customer            ARR at Stake    Lost To         Reason
───────────────────────────────────────────────────────────────
GlobalEdge Inc      $480,000        Vendor A        Price — they came in 30% cheaper
Apex Finance        $310,000        No decision     Budget freeze, pushed to H2
Morrison Group      $195,000        Vendor B        Product gap: advanced reporting
Lighthouse Co       $88,000         Vendor A        Existing relationship

Notable: GlobalEdge ($480K) was our largest opportunity of the quarter. Lost on price. Vendor A has been aggressive with discounting in Enterprise.

──────────────────────────────────────────────
REP PERFORMANCE
──────────────────────────────────────────────
Rep             Quota       Closed      Attainment
────────────────────────────────────────────────────
Emma Davis      $350K       $462K       132%  ✓
Tom Reyes       $350K       $340K       97%   ✓
Priya Singh     $350K       $122K       35%   ✗  (on PIP since Feb)
Marcus Hunt     $350K       $176K       50%   ✗  (new hire, ramping — month 3)
Lena Köhler     $100K       $0          0%    ✗  (SDR promoted, still onboarding)

──────────────────────────────────────────────
Q2 OUTLOOK
──────────────────────────────────────────────
Q2 Quota:               $4,500,000
Stage 3+ Coverage:      $6.8M (1.5x — below 3x target)
Committed (verbal):     $1.9M
Best Case:              $3.4M
Likely (internal):      $2.6M — $2.9M

At current trajectory we are tracking to miss Q2 quota by approximately 35-40%.

Key risks:
1. Pipeline coverage is critically thin at 1.5x stage 3+. Need $8M+ to feel confident.
2. Priya Singh on PIP — if exit is required, losing $350K quota in Q2.
3. Vendor A price aggression is impacting win rate on deals >$200K.

Actions in flight:
- Working with Marketing on demand gen to build $4M+ pipe by end of April.
- Brought in deal desk support for all opportunities >$150K to tighten commercial terms.
- Competitive battle card vs. Vendor A being updated this week.
`
writeFileSync(join(OUT, 'sales_report_march_2026.txt'), salesReport)
console.log('✓ sales_report_march_2026.txt')


// ─── 4. Head of Recruitment — Recruitment Report (Excel) ─────────────────────
const recWb = XLSX.utils.book_new()

const recSummary = [
  ['Recruitment Report — Q1 2026', '', '', ''],
  ['Prepared by: Aisha Patel, Head of Talent', '', '', ''],
  ['', '', '', ''],
  ['SUMMARY METRICS', '', '', ''],
  ['Metric', 'Q1 2026', 'Q4 2025', 'Target'],
  ['Positions Filled', 9, 12, 14],
  ['Positions Open (EOP)', 19, 14, 8],
  ['Time to Hire (avg days)', 48, 39, 35],
  ['Time to Fill (avg days)', 62, 51, 45],
  ['Offer Acceptance Rate', '74%', '81%', '85%'],
  ['Candidate NPS', '+18', '+29', '+35'],
  ['Agency Spend', '£48,200', '£31,000', '£25,000'],
  ['Cost per Hire (avg)', '£5,360', '£4,100', '£4,000'],
  ['Sourcing — Inbound %', '41%', '55%', '60%'],
  ['Sourcing — Outbound %', '38%', '30%', ''],
  ['Sourcing — Agency %', '21%', '15%', '10%'],
]

const pipeline = [
  ['HIRING PIPELINE BY ROLE', '', '', '', '', ''],
  ['Role', 'Dept', 'Days Open', 'Stage', 'Top Candidate', 'Notes'],
  ['Senior SWE', 'Eng', 42, 'Final Round (3)', 'Strong slate', 'Offers expected w/c Apr 7'],
  ['Senior SWE', 'Eng', 42, 'Final Round (3)', 'Strong slate', ''],
  ['Senior SWE', 'Eng', 42, 'Final Round (3)', 'Strong slate', ''],
  ['Staff Engineer', 'Eng', 67, 'Sourcing', '—', 'Offer declined at £118K; reopened at £128K'],
  ['Product Designer', 'Product', 28, 'Screening', 'Reviewing 12 apps', ''],
  ['Enterprise AE', 'Sales', 18, 'Interviewing', '6 in process', ''],
  ['Enterprise AE', 'Sales', 18, 'Interviewing', '6 in process', ''],
  ['SDR', 'Sales', 12, 'Offer Stage', 'Verbal accepted', 'Start date TBC'],
  ['SDR', 'Sales', 12, 'Offer Stage', 'Verbal accepted', ''],
  ['CS Manager', 'CS', 35, 'Offer Accepted', 'Starts Apr 14', 'Done'],
  ['Data Analyst', 'Finance', 51, 'On Hold', '—', 'Awaiting budget sign-off'],
]

const declinedOffers = [
  ['DECLINED OFFERS — Q1', '', '', ''],
  ['Role', 'Offered', 'Declined Reason', 'Action'],
  ['Staff Engineer', '£118,000', 'Counter-offer from current employer', 'Re-opened at £128K'],
  ['Enterprise AE', '£75,000 base', 'Accepted competitor offer (higher OTE)', 'Reviewing OTE structure'],
  ['Senior SWE', '£95,000', 'Remote-only requirement', 'Discussing hybrid policy exception'],
]

XLSX.utils.book_append_sheet(recWb, XLSX.utils.aoa_to_sheet(recSummary), 'Summary')
XLSX.utils.book_append_sheet(recWb, XLSX.utils.aoa_to_sheet(pipeline), 'Open Roles')
XLSX.utils.book_append_sheet(recWb, XLSX.utils.aoa_to_sheet(declinedOffers), 'Declined Offers')
XLSX.writeFile(recWb, join(OUT, 'recruitment_report_q1_2026.xlsx'))
console.log('✓ recruitment_report_q1_2026.xlsx')


// ─── 5. COO — Operations Report (Markdown) ───────────────────────────────────
const opsReport = `# Operations Report — March 2026
**Prepared by:** Daniel Torres, Chief Operating Officer
**Date:** April 1, 2026

---

## Executive Summary

March was operationally mixed. Infrastructure reliability hit a quarterly high at 99.91% uptime, and customer onboarding time improved for the third consecutive month. However, two P1 incidents impacted Enterprise customers mid-month, and support ticket volume is trending up at a rate that will require a staffing decision by end of Q2.

---

## Infrastructure & Reliability

| Metric | March | February | Target |
|---|---|---|---|
| Uptime (prod) | 99.91% | 99.84% | 99.9% |
| P1 Incidents | 2 | 0 | 0 |
| P2 Incidents | 5 | 7 | <4 |
| Mean Time to Resolve (P1) | 4.2 hrs | — | <2 hrs |
| Deploys per week | 18 | 16 | >15 |
| Rollbacks | 1 | 2 | 0 |
| Infrastructure Cost (AWS) | £142,000 | £138,000 | £140,000 |

### P1 Incident Summary

**Incident 1 — March 11, 14:32–18:47 GMT (4h15m)**
Database replica lag caused read queries to return stale data for 3 Enterprise accounts. Root cause: autovacuum misconfiguration following the March 8 schema migration. Affected customers notified. Post-mortem complete. Fix deployed March 13.

**Incident 2 — March 19, 09:15–11:03 GMT (1h48m)**
API gateway rate limiting incorrectly applied to Enterprise tier customers during a config push. 7 customers affected. Root cause: missing environment flag in deployment script. Runbook updated. Additional deployment gate added to CI pipeline.

---

## Customer Onboarding

| Metric | March | February | January |
|---|---|---|---|
| New Customers Onboarded | 14 | 11 | 9 |
| Avg Time to First Value (days) | 12.4 | 14.1 | 17.3 |
| Onboarding CSAT | 4.3 / 5 | 4.1 / 5 | 3.9 / 5 |
| Customers Overdue (>30 days) | 2 | 3 | 4 |
| Onboarding Headcount | 4 | 4 | 4 |

Time to First Value has improved 29% over the quarter. The 2 overdue customers are both large Enterprise implementations (FinCo Holdings, DataBridge GmbH) with complex SSO requirements. Both are engaged and progressing.

---

## Customer Support

| Metric | March | February | Target |
|---|---|---|---|
| Total Tickets (inbound) | 847 | 712 | <700 |
| Tickets Resolved | 821 | 698 | — |
| First Response Time (avg) | 3.8 hrs | 3.1 hrs | <4 hrs |
| Resolution Time (avg) | 18.2 hrs | 16.4 hrs | <20 hrs |
| CSAT (support) | 4.1 / 5 | 4.3 / 5 | >4.2 |
| Escalations to Engineering | 28 | 19 | <15 |
| Support Team Headcount | 7 | 7 | — |

Ticket volume is up 19% month-over-month. At current growth rate (~15% MoM), we will breach our SLA capacity threshold by June without adding headcount. I am preparing a business case for 2 additional Support Engineers to present in April. Engineering escalations are also increasing, which is absorbing approximately 12–15% of an engineer's time per week.

---

## Vendor & Cost Management

| Vendor | Monthly Cost | vs. Budget | Notes |
|---|---|---|---|
| AWS | £142,000 | +£2,000 | Slightly over on data transfer |
| Datadog | £18,400 | on budget | Contract renewal in July |
| Intercom | £6,200 | on budget | — |
| Stripe | £4,100 | +£600 | Volume-driven — positive signal |
| GitHub | £3,800 | on budget | — |
| Notion | £1,200 | on budget | — |
| **Total** | **£175,700** | **+£2,600** | |

---

## Q2 Priorities

1. Resolve autovacuum configuration across all database clusters (in progress, due Apr 15)
2. Hire 2 Support Engineers — business case to leadership by April 30
3. Reduce Engineering escalations from support by improving internal knowledge base
4. Complete SOC 2 Type II audit preparation — vendor assessment due May 1
5. Renegotiate Datadog contract ahead of July renewal (target: 15% reduction)
`
writeFileSync(join(OUT, 'operations_report_march_2026.md'), opsReport)
console.log('✓ operations_report_march_2026.md')


console.log(`\nAll 5 mock reports saved to:\n  ~/Desktop/operator-mock-reports/\n`)
console.log('Reports:')
console.log('  📊 finance_report_march_2026.xlsx       — CFO, Finance area')
console.log('  📋 hr_people_report_q1_2026.csv         — CHRO, HR & People area')
console.log('  📄 sales_report_march_2026.txt          — VP Sales, Sales area')
console.log('  📊 recruitment_report_q1_2026.xlsx      — Head of Talent, Recruitment area')
console.log('  📝 operations_report_march_2026.md      — COO, Operations area')
