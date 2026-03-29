import { prisma } from './db'

type SeedEntry = { term: string; definition: string; scope: string }

// Bump this version string whenever new terms are added — triggers a re-seed on next startup.
const SEED_VERSION = '2'

const SEEDS: SeedEntry[] = [
  // ── Global (all modes) ──────────────────────────────────────────────────────
  { term: 'OKR',   definition: 'Objectives & Key Results',             scope: 'global' },
  { term: 'KPI',   definition: 'Key Performance Indicator',            scope: 'global' },
  { term: 'ROI',   definition: 'Return on Investment',                 scope: 'global' },
  { term: 'NPS',   definition: 'Net Promoter Score',                   scope: 'global' },
  { term: 'CSAT',  definition: 'Customer Satisfaction Score',          scope: 'global' },
  { term: 'WoW',   definition: 'Week over Week — percentage change from one week to the next', scope: 'global' },
  { term: 'MoM',   definition: 'Month over Month — percentage change from one month to the next', scope: 'global' },
  { term: 'QoQ',   definition: 'Quarter over Quarter — change between consecutive fiscal quarters', scope: 'global' },
  { term: 'YoY',   definition: 'Year over Year — comparison of performance across the same period in consecutive years', scope: 'global' },

  // ── Executive / Consulting — Finance ───────────────────────────────────────
  { term: 'P&L',      definition: 'Profit & Loss statement',             scope: 'mode:executive' },
  { term: 'EBITDA',   definition: 'Earnings Before Interest, Taxes, Depreciation & Amortisation', scope: 'mode:executive' },
  { term: 'EBIT',     definition: 'Earnings Before Interest & Taxes',    scope: 'mode:executive' },
  { term: 'GM',       definition: 'Gross Margin — revenue minus cost of goods sold, expressed as a percentage', scope: 'mode:executive' },
  { term: 'MRR',      definition: 'Monthly Recurring Revenue',           scope: 'mode:executive' },
  { term: 'ARR',      definition: 'Annual Recurring Revenue',            scope: 'mode:executive' },
  { term: 'CAC',      definition: 'Customer Acquisition Cost',           scope: 'mode:executive' },
  { term: 'LTV',      definition: 'Customer Lifetime Value',             scope: 'mode:executive' },
  { term: 'FTE',      definition: 'Full-Time Equivalent',                scope: 'mode:executive' },
  { term: 'OPEX',     definition: 'Operating Expenditure',               scope: 'mode:executive' },
  { term: 'CAPEX',    definition: 'Capital Expenditure',                 scope: 'mode:executive' },
  { term: 'FCF',      definition: 'Free Cash Flow',                      scope: 'mode:executive' },
  { term: 'NWC',      definition: 'Net Working Capital',                 scope: 'mode:executive' },
  { term: 'DSO',      definition: 'Days Sales Outstanding — average days to collect payment after a sale', scope: 'mode:executive' },
  { term: 'DPO',      definition: 'Days Payable Outstanding — average days before paying suppliers', scope: 'mode:executive' },
  { term: 'CAGR',     definition: 'Compound Annual Growth Rate — smoothed annual growth rate over a period', scope: 'mode:executive' },
  { term: 'burn rate', definition: 'Rate at which a company spends cash reserves (monthly or weekly)', scope: 'mode:executive' },
  { term: 'runway',   definition: 'How many months of cash remain at the current burn rate', scope: 'mode:executive' },
  { term: 'CRM',      definition: 'Customer Relationship Management — software/system for managing customer interactions', scope: 'mode:executive' },
  { term: 'churn rate', definition: 'Percentage of customers or revenue lost in a given period', scope: 'mode:executive' },
  { term: 'GRR',      definition: 'Gross Revenue Retention — percentage of recurring revenue retained, excluding expansion', scope: 'mode:executive' },
  { term: 'NRR',      definition: 'Net Revenue Retention — revenue retained including expansions and upsells, minus churn', scope: 'mode:executive' },
  // HR
  { term: 'ATS',          definition: 'Applicant Tracking System',              scope: 'mode:executive' },
  { term: 'TTS',          definition: 'Time to Start',                          scope: 'mode:executive' },
  { term: 'TTH',          definition: 'Time to Hire',                           scope: 'mode:executive' },
  { term: 'HRIS',         definition: 'Human Resources Information System',     scope: 'mode:executive' },
  { term: 'HC',           definition: 'Headcount',                              scope: 'mode:executive' },
  { term: 'PTO',          definition: 'Paid Time Off',                          scope: 'mode:executive' },
  { term: 'ONA',          definition: 'Organisational Network Analysis',        scope: 'mode:executive' },
  { term: 'attrition',    definition: 'Rate at which employees leave, calculated as departures ÷ average headcount', scope: 'mode:executive' },
  { term: 'eNPS',         definition: 'Employee Net Promoter Score — measures likelihood of employees recommending the company as a workplace', scope: 'mode:executive' },
  { term: 'L&D',          definition: 'Learning & Development',                 scope: 'mode:executive' },
  // Sales
  { term: 'ACV',          definition: 'Annual Contract Value',                  scope: 'mode:executive' },
  { term: 'TCV',          definition: 'Total Contract Value',                   scope: 'mode:executive' },
  { term: 'AE',           definition: 'Account Executive',                      scope: 'mode:executive' },
  { term: 'SDR',          definition: 'Sales Development Representative',       scope: 'mode:executive' },
  { term: 'BDR',          definition: 'Business Development Representative',    scope: 'mode:executive' },
  { term: 'SQL',          definition: 'Sales Qualified Lead',                   scope: 'mode:executive' },
  { term: 'MQL',          definition: 'Marketing Qualified Lead',               scope: 'mode:executive' },
  { term: 'SAL',          definition: 'Sales Accepted Lead — MQL accepted by sales as worth pursuing', scope: 'mode:executive' },
  { term: 'MEDDIC',       definition: 'Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion — sales qualification framework', scope: 'mode:executive' },
  { term: 'win rate',     definition: 'Percentage of deals won out of total opportunities closed', scope: 'mode:executive' },
  { term: 'pipeline coverage', definition: 'Ratio of pipeline value to quota; typically 3–4× coverage is considered healthy', scope: 'mode:executive' },
  { term: 'quota',        definition: 'Sales target assigned to an individual rep or team for a period', scope: 'mode:executive' },
  // Marketing
  { term: 'ROAS',  definition: 'Return on Ad Spend',                     scope: 'mode:executive' },
  { term: 'CPC',   definition: 'Cost Per Click',                         scope: 'mode:executive' },
  { term: 'CPL',   definition: 'Cost Per Lead',                          scope: 'mode:executive' },
  { term: 'CPA',   definition: 'Cost Per Acquisition',                   scope: 'mode:executive' },
  { term: 'CPM',   definition: 'Cost Per Mille (thousand impressions)',  scope: 'mode:executive' },
  { term: 'CTR',   definition: 'Click-Through Rate',                     scope: 'mode:executive' },
  { term: 'CVR',   definition: 'Conversion Rate',                        scope: 'mode:executive' },
  { term: 'B2B',   definition: 'Business to Business',                   scope: 'mode:executive' },
  { term: 'B2C',   definition: 'Business to Consumer',                   scope: 'mode:executive' },
  { term: 'SEO',   definition: 'Search Engine Optimisation',             scope: 'mode:executive' },
  { term: 'SEM',   definition: 'Search Engine Marketing — paid search advertising', scope: 'mode:executive' },

  // ── Consulting ─────────────────────────────────────────────────────────────
  { term: 'SOW',        definition: 'Statement of Work',                        scope: 'mode:consulting' },
  { term: 'MSA',        definition: 'Master Service Agreement',                 scope: 'mode:consulting' },
  { term: 'RACI',       definition: 'Responsible, Accountable, Consulted, Informed — accountability matrix', scope: 'mode:consulting' },
  { term: 'PMO',        definition: 'Project Management Office',                scope: 'mode:consulting' },
  { term: 'MVP',        definition: 'Minimum Viable Product',                   scope: 'mode:consulting' },
  { term: 'C-suite',    definition: 'Chief-level executives (CEO, CFO, COO, CTO, etc.)', scope: 'mode:consulting' },
  { term: 'SWOT',       definition: 'Strengths, Weaknesses, Opportunities, Threats — strategic assessment framework', scope: 'mode:consulting' },
  { term: 'MECE',       definition: 'Mutually Exclusive, Collectively Exhaustive — principle for structuring analysis without gaps or overlap', scope: 'mode:consulting' },
  { term: 'CAGR',       definition: 'Compound Annual Growth Rate',              scope: 'mode:consulting' },
  { term: 'run rate',   definition: 'Annualised projection of current-period performance', scope: 'mode:consulting' },
  { term: 'quick win',  definition: 'Low-effort, high-impact improvement achievable in the near term', scope: 'mode:consulting' },
  { term: 'workstream', definition: 'Distinct track of work within a larger project, typically owned by a sub-team', scope: 'mode:consulting' },
  { term: 'synergy',    definition: 'Value created by combining two entities or processes that exceeds what each produces separately', scope: 'mode:consulting' },
  { term: 'KSF',        definition: 'Key Success Factor — critical capability or condition required to achieve the objective', scope: 'mode:consulting' },
  { term: 'ROA',        definition: 'Return on Assets',                         scope: 'mode:consulting' },
  { term: 'ROE',        definition: 'Return on Equity',                         scope: 'mode:consulting' },

  // ── Journalism ─────────────────────────────────────────────────────────────
  { term: 'FOIA',          definition: 'Freedom of Information Act request',          scope: 'mode:journalism' },
  { term: 'lede',          definition: 'Opening sentence or paragraph of a story that summarises the key facts', scope: 'mode:journalism' },
  { term: 'nut graf',      definition: 'Paragraph that explains why the story matters and its broader significance', scope: 'mode:journalism' },
  { term: 'hed',           definition: 'Headline (intentional misspelling used in editing to distinguish it from body text)', scope: 'mode:journalism' },
  { term: 'dek',           definition: 'Sub-headline or standfirst — short summary line below the headline', scope: 'mode:journalism' },
  { term: 'graf',          definition: 'Paragraph',                                   scope: 'mode:journalism' },
  { term: 'TK',            definition: '"To come" — placeholder marker for information still to be gathered or confirmed', scope: 'mode:journalism' },
  { term: 'dateline',      definition: 'Line at the start of a story indicating where and when it was reported', scope: 'mode:journalism' },
  { term: 'on background', definition: 'Information that can be used but cannot be attributed to the source by name', scope: 'mode:journalism' },
  { term: 'on record',     definition: 'Source can be named and quoted directly in the story', scope: 'mode:journalism' },
  { term: 'off record',    definition: 'Information cannot be published or attributed in any form', scope: 'mode:journalism' },
  { term: 'embargo',       definition: 'Agreement not to publish before a specified date and time', scope: 'mode:journalism' },
  { term: 'byline',        definition: "Reporter's name as it appears on a published story",       scope: 'mode:journalism' },
  { term: 'stringer',      definition: 'Freelance journalist contributing on a per-story basis',   scope: 'mode:journalism' },
  { term: 'source protection', definition: 'Ethical and legal obligation to protect the identity of confidential sources', scope: 'mode:journalism' },
  { term: 'AP style',      definition: 'Associated Press Stylebook — the standard style guide for most US news organisations', scope: 'mode:journalism' },

  // ── Team Lead ──────────────────────────────────────────────────────────────
  { term: 'velocity',      definition: 'Amount of work a team completes in a sprint, measured in story points', scope: 'mode:team-lead' },
  { term: 'story point',   definition: 'Relative unit for estimating effort or complexity of a task, not time', scope: 'mode:team-lead' },
  { term: 'burndown',      definition: 'Chart showing remaining work vs. time left in a sprint',            scope: 'mode:team-lead' },
  { term: 'retro',         definition: 'Retrospective — end-of-sprint meeting to review what went well and what needs improvement', scope: 'mode:team-lead' },
  { term: 'sprint',        definition: 'Fixed-length iteration (usually 1–2 weeks) in agile development',   scope: 'mode:team-lead' },
  { term: 'CI/CD',         definition: 'Continuous Integration / Continuous Delivery — automated build, test, and deploy pipeline', scope: 'mode:team-lead' },
  { term: 'LGTM',          definition: 'Looks Good To Me — code review approval',                           scope: 'mode:team-lead' },
  { term: 'DoD',           definition: 'Definition of Done — agreed criteria that must be met for a task to be considered complete', scope: 'mode:team-lead' },
  { term: 'DoR',           definition: 'Definition of Ready — criteria a task must meet before it can enter a sprint', scope: 'mode:team-lead' },
  { term: 'DORA metrics',  definition: 'Deployment Frequency, Lead Time for Changes, Change Failure Rate, MTTR — DevOps performance benchmarks', scope: 'mode:team-lead' },
  { term: 'MTTR',          definition: 'Mean Time to Recovery — average time to restore service after an incident', scope: 'mode:team-lead' },
  { term: 'lead time',     definition: 'Time from a task being created (or committed) to it being deployed to production', scope: 'mode:team-lead' },
  { term: 'epic',          definition: 'Large body of work broken down into smaller user stories',           scope: 'mode:team-lead' },
  { term: 'WIP',           definition: 'Work In Progress — tasks currently being worked on; high WIP signals multitasking and context-switching risk', scope: 'mode:team-lead' },
  { term: 'PO',            definition: 'Product Owner — responsible for the product backlog and prioritisation', scope: 'mode:team-lead' },
  { term: 'PBI',           definition: 'Product Backlog Item — any unit of work in the product backlog',    scope: 'mode:team-lead' },
  { term: 'throughput',    definition: 'Number of items completed per unit of time — a flow-based alternative to velocity', scope: 'mode:team-lead' },
  { term: 'tech debt',     definition: 'Accumulated cost of shortcuts and suboptimal decisions that need to be addressed later', scope: 'mode:team-lead' },

  // ── Market Research ────────────────────────────────────────────────────────
  { term: 'CES',                definition: 'Customer Effort Score — measures how easy it was for a customer to get their issue resolved', scope: 'mode:market-research' },
  { term: 'TAM',                definition: 'Total Addressable Market',                                  scope: 'mode:market-research' },
  { term: 'SAM',                definition: 'Serviceable Addressable Market — portion of TAM reachable by the product or service', scope: 'mode:market-research' },
  { term: 'SOM',                definition: 'Serviceable Obtainable Market — realistic share of SAM capturable in the near term', scope: 'mode:market-research' },
  { term: 'cohort',             definition: 'Group of subjects sharing a common characteristic tracked over time', scope: 'mode:market-research' },
  { term: 'IDI',                definition: 'In-Depth Interview — qualitative one-on-one research method', scope: 'mode:market-research' },
  { term: 'JTBD',               definition: 'Jobs To Be Done — framework for understanding the underlying goal a customer is trying to achieve', scope: 'mode:market-research' },
  { term: 'p-value',            definition: 'Probability that observed results occurred by chance; p < 0.05 is typically considered statistically significant', scope: 'mode:market-research' },
  { term: 'confidence interval', definition: 'Range within which the true value is expected to fall at a given probability level (e.g. 95%)', scope: 'mode:market-research' },
  { term: 'margin of error',    definition: 'Maximum expected difference between a sample result and the true population value', scope: 'mode:market-research' },
  { term: 'sample size',        definition: 'Number of respondents in a study; larger samples reduce margin of error', scope: 'mode:market-research' },
  { term: 'segmentation',       definition: 'Dividing a market or audience into groups with shared characteristics for targeted analysis', scope: 'mode:market-research' },
  { term: 'churn',              definition: 'Rate at which customers or respondents stop using a product or participating in a panel', scope: 'mode:market-research' },
  { term: 'funnel',             definition: 'Staged model of the customer journey from awareness to purchase', scope: 'mode:market-research' },
  { term: 'CLT',                definition: 'Central Location Test — in-person research session where respondents evaluate products at a controlled venue', scope: 'mode:market-research' },
  { term: 'qual',               definition: 'Qualitative research — unstructured, exploratory; surfaces motivations, attitudes, and language', scope: 'mode:market-research' },
  { term: 'quant',              definition: 'Quantitative research — structured, measurable; produces statistically projectible data', scope: 'mode:market-research' },

  // ── Legal ──────────────────────────────────────────────────────────────────
  { term: 'AOR',           definition: 'Attorney of Record',                                          scope: 'mode:legal' },
  { term: 'CoC',           definition: 'Chain of Custody — documented sequence of possession for evidence', scope: 'mode:legal' },
  { term: 'NDA',           definition: 'Non-Disclosure Agreement',                                    scope: 'mode:legal' },
  { term: 'MSA',           definition: 'Master Service Agreement',                                    scope: 'mode:legal' },
  { term: 'SOW',           definition: 'Statement of Work',                                           scope: 'mode:legal' },
  { term: 'TRO',           definition: 'Temporary Restraining Order — short-term court order preventing an action pending a hearing', scope: 'mode:legal' },
  { term: 'injunction',    definition: 'Court order requiring or prohibiting a specific action; can be temporary, preliminary, or permanent', scope: 'mode:legal' },
  { term: 'discovery',     definition: 'Pre-trial process in which parties exchange relevant evidence and documents', scope: 'mode:legal' },
  { term: 'deposition',    definition: 'Out-of-court sworn testimony given by a witness and recorded for later use in litigation', scope: 'mode:legal' },
  { term: 'Bates number',  definition: 'Sequential identifier stamped on documents during discovery to track and reference them', scope: 'mode:legal' },
  { term: 'privilege log', definition: 'List of documents withheld from discovery on grounds of attorney–client privilege or work-product doctrine', scope: 'mode:legal' },
  { term: 'affidavit',     definition: 'Written statement of facts voluntarily made under oath',      scope: 'mode:legal' },
  { term: 'subpoena',      definition: 'Legal order compelling a witness to testify or produce documents', scope: 'mode:legal' },
  { term: 'motion',        definition: 'Formal request to the court to take a specific action',       scope: 'mode:legal' },
  { term: 'plaintiff',     definition: 'Party who initiates a lawsuit',                              scope: 'mode:legal' },
  { term: 'defendant',     definition: 'Party against whom a lawsuit is filed',                      scope: 'mode:legal' },
  { term: 'settlement',    definition: 'Resolution of a dispute agreed by the parties, avoiding a trial', scope: 'mode:legal' },
  { term: 'class action',  definition: 'Lawsuit filed by a group of plaintiffs with similar claims against the same defendant(s)', scope: 'mode:legal' },
  { term: 'pro se',        definition: 'A party representing themselves without an attorney',        scope: 'mode:legal' },
  { term: 'in camera',     definition: 'Judge reviews documents or testimony privately, outside public court proceedings', scope: 'mode:legal' },
]

/** Seed (or refresh) glossary terms. Re-runs when SEED_VERSION changes. Idempotent per term. */
export async function seedGlossaryIfEmpty(): Promise<void> {
  const versionRow = await prisma.setting.findUnique({ where: { key: 'knowledge_seed_version' } })
  if (versionRow?.value === SEED_VERSION) return // already at current version

  await Promise.all(
    SEEDS.map(s =>
      prisma.glossaryTerm.upsert({
        where: { term_scope: { term: s.term, scope: s.scope } },
        update: {},  // never overwrite user edits
        create: { id: crypto.randomUUID(), term: s.term, definition: s.definition, scope: s.scope },
      })
    )
  )

  await prisma.setting.upsert({
    where: { key: 'knowledge_seed_version' },
    update: { value: SEED_VERSION },
    create: { id: crypto.randomUUID(), key: 'knowledge_seed_version', value: SEED_VERSION },
  })
}
