import { prisma } from './db'

type SeedEntry = { term: string; definition: string; scope: string }

const SEEDS: SeedEntry[] = [
  // ── Global (all modes) ──────────────────────────────────────────────────────
  { term: 'OKR',   definition: 'Objectives & Key Results',             scope: 'global' },
  { term: 'KPI',   definition: 'Key Performance Indicator',            scope: 'global' },
  { term: 'ROI',   definition: 'Return on Investment',                 scope: 'global' },
  { term: 'NPS',   definition: 'Net Promoter Score',                   scope: 'global' },
  { term: 'CSAT',  definition: 'Customer Satisfaction Score',          scope: 'global' },
  { term: 'YoY',   definition: 'Year over Year',                       scope: 'global' },
  { term: 'QoQ',   definition: 'Quarter over Quarter',                 scope: 'global' },

  // ── Executive / Consulting — Finance ───────────────────────────────────────
  { term: 'P&L',      definition: 'Profit & Loss statement',             scope: 'mode:executive' },
  { term: 'EBITDA',   definition: 'Earnings Before Interest, Taxes, Depreciation & Amortisation', scope: 'mode:executive' },
  { term: 'MRR',      definition: 'Monthly Recurring Revenue',           scope: 'mode:executive' },
  { term: 'ARR',      definition: 'Annual Recurring Revenue',            scope: 'mode:executive' },
  { term: 'CAC',      definition: 'Customer Acquisition Cost',           scope: 'mode:executive' },
  { term: 'LTV',      definition: 'Customer Lifetime Value',             scope: 'mode:executive' },
  { term: 'FTE',      definition: 'Full-Time Equivalent',                scope: 'mode:executive' },
  { term: 'OPEX',     definition: 'Operating Expenditure',               scope: 'mode:executive' },
  { term: 'CAPEX',    definition: 'Capital Expenditure',                 scope: 'mode:executive' },
  { term: 'FCF',      definition: 'Free Cash Flow',                      scope: 'mode:executive' },
  { term: 'NWC',      definition: 'Net Working Capital',                 scope: 'mode:executive' },
  { term: 'DSO',      definition: 'Days Sales Outstanding',              scope: 'mode:executive' },
  { term: 'DPO',      definition: 'Days Payable Outstanding',            scope: 'mode:executive' },
  { term: 'EBIT',     definition: 'Earnings Before Interest & Taxes',    scope: 'mode:executive' },
  // HR
  { term: 'ATS',        definition: 'Applicant Tracking System',         scope: 'mode:executive' },
  { term: 'TTS',        definition: 'Time to Start',                     scope: 'mode:executive' },
  { term: 'TTH',        definition: 'Time to Hire',                      scope: 'mode:executive' },
  { term: 'HRIS',       definition: 'Human Resources Information System', scope: 'mode:executive' },
  { term: 'HC',         definition: 'Headcount',                         scope: 'mode:executive' },
  { term: 'PTO',        definition: 'Paid Time Off',                     scope: 'mode:executive' },
  { term: 'ONA',        definition: 'Organisational Network Analysis',   scope: 'mode:executive' },
  // Sales
  { term: 'ACV',    definition: 'Annual Contract Value',                 scope: 'mode:executive' },
  { term: 'TCV',    definition: 'Total Contract Value',                  scope: 'mode:executive' },
  { term: 'AE',     definition: 'Account Executive',                     scope: 'mode:executive' },
  { term: 'SDR',    definition: 'Sales Development Representative',      scope: 'mode:executive' },
  { term: 'BDR',    definition: 'Business Development Representative',   scope: 'mode:executive' },
  { term: 'SQL',    definition: 'Sales Qualified Lead',                  scope: 'mode:executive' },
  { term: 'MQL',    definition: 'Marketing Qualified Lead',              scope: 'mode:executive' },
  { term: 'MEDDIC', definition: 'Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion — sales qualification framework', scope: 'mode:executive' },
  // Marketing
  { term: 'ROAS',  definition: 'Return on Ad Spend',                     scope: 'mode:executive' },
  { term: 'CPC',   definition: 'Cost Per Click',                         scope: 'mode:executive' },
  { term: 'CPL',   definition: 'Cost Per Lead',                          scope: 'mode:executive' },
  { term: 'CPM',   definition: 'Cost Per Mille (thousand impressions)',  scope: 'mode:executive' },
  { term: 'CTR',   definition: 'Click-Through Rate',                     scope: 'mode:executive' },
  { term: 'CVR',   definition: 'Conversion Rate',                        scope: 'mode:executive' },

  // ── Consulting ─────────────────────────────────────────────────────────────
  { term: 'SOW',      definition: 'Statement of Work',                   scope: 'mode:consulting' },
  { term: 'MSA',      definition: 'Master Service Agreement',            scope: 'mode:consulting' },
  { term: 'RACI',     definition: 'Responsible, Accountable, Consulted, Informed — accountability matrix', scope: 'mode:consulting' },
  { term: 'PMO',      definition: 'Project Management Office',           scope: 'mode:consulting' },
  { term: 'MVP',      definition: 'Minimum Viable Product',              scope: 'mode:consulting' },
  { term: 'C-suite',  definition: 'Chief-level executives (CEO, CFO, COO, CTO, etc.)', scope: 'mode:consulting' },

  // ── Journalism ─────────────────────────────────────────────────────────────
  { term: 'FOIA',             definition: 'Freedom of Information Act request',    scope: 'mode:journalism' },
  { term: 'lede',             definition: 'Opening sentence of a news story that summarises the key facts', scope: 'mode:journalism' },
  { term: 'nut graf',         definition: 'Paragraph that explains why the story matters', scope: 'mode:journalism' },
  { term: 'on background',    definition: 'Information that can be used but not attributed to the source', scope: 'mode:journalism' },
  { term: 'on record',        definition: 'Source can be named and quoted directly', scope: 'mode:journalism' },
  { term: 'off record',       definition: 'Information cannot be published or attributed', scope: 'mode:journalism' },
  { term: 'embargo',          definition: 'Agreement not to publish before a specified date/time', scope: 'mode:journalism' },
  { term: 'byline',           definition: "Reporter's name as it appears on a published story", scope: 'mode:journalism' },
  { term: 'stringer',         definition: 'Freelance journalist contributing on a per-story basis', scope: 'mode:journalism' },

  // ── Team Lead ──────────────────────────────────────────────────────────────
  { term: 'velocity',     definition: 'Amount of work a team completes in a sprint, measured in story points', scope: 'mode:team-lead' },
  { term: 'burndown',     definition: 'Chart showing remaining work vs. time in a sprint',                    scope: 'mode:team-lead' },
  { term: 'retro',        definition: 'Retrospective — sprint review meeting to discuss what went well/poorly', scope: 'mode:team-lead' },
  { term: 'sprint',       definition: 'Fixed-length iteration (usually 1–2 weeks) in agile development',      scope: 'mode:team-lead' },
  { term: 'CI/CD',        definition: 'Continuous Integration / Continuous Delivery',                         scope: 'mode:team-lead' },
  { term: 'LGTM',         definition: 'Looks Good To Me — code review approval',                              scope: 'mode:team-lead' },
  { term: 'DoD',          definition: 'Definition of Done',                                                   scope: 'mode:team-lead' },
  { term: 'DoR',          definition: 'Definition of Ready',                                                  scope: 'mode:team-lead' },
  { term: 'DORA metrics', definition: 'Deployment Frequency, Lead Time, Change Failure Rate, MTTR — DevOps performance benchmarks', scope: 'mode:team-lead' },
  { term: 'epic',         definition: 'Large body of work broken down into smaller stories',                  scope: 'mode:team-lead' },

  // ── Market Research ────────────────────────────────────────────────────────
  { term: 'CES',                definition: 'Customer Effort Score',                                    scope: 'mode:market-research' },
  { term: 'TAM',                definition: 'Total Addressable Market',                                  scope: 'mode:market-research' },
  { term: 'SAM',                definition: 'Serviceable Addressable Market',                            scope: 'mode:market-research' },
  { term: 'SOM',                definition: 'Serviceable Obtainable Market',                             scope: 'mode:market-research' },
  { term: 'cohort',             definition: 'Group of users or respondents sharing a common characteristic tracked over time', scope: 'mode:market-research' },
  { term: 'IDI',                definition: 'In-Depth Interview',                                        scope: 'mode:market-research' },
  { term: 'JTBD',               definition: 'Jobs To Be Done — framework for understanding customer motivations', scope: 'mode:market-research' },
  { term: 'p-value',            definition: 'Probability that results are due to chance; <0.05 typically considered significant', scope: 'mode:market-research' },
  { term: 'confidence interval', definition: 'Range within which the true value is expected to fall at a given probability', scope: 'mode:market-research' },

  // ── Legal ──────────────────────────────────────────────────────────────────
  { term: 'AOR',          definition: 'Attorney of Record',                                          scope: 'mode:legal' },
  { term: 'CoC',          definition: 'Chain of Custody',                                            scope: 'mode:legal' },
  { term: 'NDA',          definition: 'Non-Disclosure Agreement',                                    scope: 'mode:legal' },
  { term: 'MSA',          definition: 'Master Service Agreement',                                    scope: 'mode:legal' },
  { term: 'SOW',          definition: 'Statement of Work',                                           scope: 'mode:legal' },
  { term: 'TRO',          definition: 'Temporary Restraining Order',                                 scope: 'mode:legal' },
  { term: 'injunction',   definition: 'Court order requiring a party to do or stop doing something', scope: 'mode:legal' },
  { term: 'discovery',    definition: 'Pre-trial process of exchanging relevant evidence',            scope: 'mode:legal' },
  { term: 'deposition',   definition: 'Out-of-court sworn testimony recorded for later use',         scope: 'mode:legal' },
  { term: 'Bates number', definition: 'Sequential ID stamped on documents during discovery',         scope: 'mode:legal' },
  { term: 'privilege log', definition: 'List of documents withheld from discovery due to attorney–client privilege', scope: 'mode:legal' },
]

/** Seed default glossary terms if none exist yet for this mode. Idempotent (upsert). */
export async function seedGlossaryIfEmpty(): Promise<void> {
  const count = await prisma.glossaryTerm.count()
  if (count > 0) return // already seeded

  const data = SEEDS.map(s => ({
    id: crypto.randomUUID(),
    term: s.term,
    definition: s.definition,
    scope: s.scope,
  }))

  // Use individual upserts to handle unique constraint gracefully
  await Promise.all(
    data.map(d =>
      prisma.glossaryTerm.upsert({
        where: { term_scope: { term: d.term, scope: d.scope } },
        update: {},
        create: d,
      })
    )
  )
}
