export type AppMode =
  | 'executive'
  | 'journalism'
  | 'team_lead'
  | 'market_research'
  | 'legal'
  | 'human_resources'

export interface ModeFeatures {
  /** Named entity extraction, cross-linking, and entity search */
  entities: boolean
  /** Timeline event extraction and display */
  timeline: boolean
  /** Redaction detection, display, and library filter */
  redactions: boolean
  /** Verification checklist on documents */
  verification: boolean
  /** Cross-document comparison section */
  documentComparison: boolean
  /** Keyword monitoring panel and highlighting in Pulse */
  keywordMonitoring: boolean
  /** Investigation folder template prompt in notebook */
  investigationTemplate: boolean
  /** Auto-initialise Pulse with mode-specific default feeds */
  defaultFeeds: boolean
  /** Journal page description override */
  journalDescription: string | null
  /** Automatically extract risk insights into the Risk Register on document upload */
  riskRegister: boolean
  /** Automatically populate the Claims Tracker from analysis insights on document upload */
  claims: boolean
  /** Metrics board page — aggregated KPIs across all documents */
  metricsBoard: boolean
  /** Show extracted metrics and period comparison on individual document pages */
  showReportMetrics: boolean
  /**
   * Extra nav items with optional group placement:
   *   'analysis' (default) → Analysis dropdown
   *   'intake'             → Intake dropdown
   *   'notebook'           → Notebook dropdown (alongside journal)
   */
  extraNavItems: Array<{ href: string; label: string; icon: string; group?: 'analysis' | 'investigate' | 'intake' | 'notebook' }>
  /** Move Pulse from Intake into the Notebook dropdown */
  pulseInNotebook: boolean
  /** Move the navPeople link (Sources/Directs/etc.) from Analysis into the Notebook dropdown */
  peopleInNotebook: boolean
}

export interface ModeConfig {
  id: AppMode
  label: string
  tagline: string
  icon: string
  // Terminology
  personLabel: string
  personLabelPlural: string
  documentLabel: string
  documentLabelPlural: string
  collectionLabel: string
  collectionLabelPlural: string
  // Project workspace terminology
  projectLabel: string
  projectLabelPlural: string
  // Nav labels
  navPeople: string
  navDocuments: string
  navLibrary: string
  navJournal: string
  // Upload page
  uploadTitle: string
  uploadDescription: string
  uploadAreaLabel: string
  defaultAreas: string[]
  acceptedFileTypes: string
  // Journal/notes default folders
  defaultJournalFolders: string[]
  // Empty states
  emptyStateTitle: string
  emptyStateBody: string
  emptyStateCta: string
  // AI framing — injected into every system prompt
  aiContext: string
  // Mode-specific framing for analyzeReport()
  analysisFraming: string
  // Optional feature flags
  features: ModeFeatures
}

const DEFAULT_FEATURES: ModeFeatures = {
  entities: false,
  timeline: false,
  redactions: false,
  verification: false,
  documentComparison: false,
  keywordMonitoring: false,
  investigationTemplate: false,
  defaultFeeds: false,
  riskRegister: false,
  claims: false,
  metricsBoard: false,
  showReportMetrics: true,
  journalDescription: null,
  extraNavItems: [],
  pulseInNotebook: false,
  peopleInNotebook: false,
}

const BASE_FILE_TYPES = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md'
const IMAGE_FILE_TYPES = '.jpg,.jpeg,.png,.webp,.heic,.gif'
const AUDIO_FILE_TYPES = '.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac,.opus'

export const MODES: Record<AppMode, ModeConfig> = {
  executive: {
    id: 'executive',
    label: 'Executive',
    tagline: 'Business reporting & team oversight',
    icon: '📊',
    personLabel: 'Direct',
    personLabelPlural: 'Directs',
    documentLabel: 'Report',
    documentLabelPlural: 'Reports',
    collectionLabel: 'Area',
    collectionLabelPlural: 'Areas',
    projectLabel: 'Project',
    projectLabelPlural: 'Projects',
    navPeople: 'Directs',
    navDocuments: 'Add Report',
    navLibrary: 'Library',
    navJournal: 'Notebook',
    uploadTitle: 'Add Report',
    uploadDescription: 'Upload reports from your team to get AI-powered insights across your business.',
    uploadAreaLabel: 'Business Area',
    defaultAreas: ['Finance', 'HR & People', 'Sales', 'Marketing', 'Operations', 'Product', 'Engineering', 'Legal', 'Customer Success', 'Recruitment', 'Strategy', 'Other'],
    acceptedFileTypes: `${BASE_FILE_TYPES},${AUDIO_FILE_TYPES}`,
    defaultJournalFolders: ['Weekly Reflections', 'Ideas', 'Decisions', 'General'],
    emptyStateTitle: 'No reports yet',
    emptyStateBody: 'Upload your first report to get a unified view of your business.',
    emptyStateCta: 'Add first report',
    aiContext: 'You are advising a business executive. Focus on operational performance, financial health, team effectiveness, and strategic opportunities.',
    analysisFraming: 'Lead with implications, not just facts — what does this mean for the business? A risk is financial exposure, execution failure, or competitive disadvantage; quantify it where possible. An opportunity is revenue expansion, cost efficiency, or strategic optionality. Surface trends across periods and flag anomalies relative to targets or stated goals. Questions should focus on decision ownership, magnitude, and time window: who needs to act, by when, and what happens if they don\'t.',
    features: {
      ...DEFAULT_FEATURES,
      documentComparison: true,
      metricsBoard: true,
      riskRegister: true,
      pulseInNotebook: true,
      peopleInNotebook: true,
      journalDescription: 'Leadership notes organised by theme — decisions, strategy, reflections',
      extraNavItems: [
        { href: '/metrics',   label: 'Metrics',        icon: 'BarChart2'   },
        { href: '/risks',     label: 'Risk Register',  icon: 'ShieldAlert' },
        { href: '/actions',   label: 'Actions',        icon: 'ListChecks'  },
        { href: '/decisions', label: 'Decisions',      icon: 'Lightbulb'   },
      ],
    },
  },

  journalism: {
    id: 'journalism',
    label: 'Journalism',
    tagline: 'Field notes, sources & story research',
    icon: '📰',
    personLabel: 'Source',
    personLabelPlural: 'Sources',
    documentLabel: 'Notes',
    documentLabelPlural: 'Notes',
    collectionLabel: 'Beat',
    collectionLabelPlural: 'Beats',
    projectLabel: 'Story',
    projectLabelPlural: 'Stories',
    navPeople: 'Sources',
    navDocuments: 'Add Documents',
    navLibrary: 'Library',
    navJournal: 'Notebook',
    uploadTitle: 'Add Document or Photo',
    uploadDescription: 'Upload documents, photos, or source materials to your story archive.',
    uploadAreaLabel: 'Beat / Story',
    defaultAreas: ['Politics', 'Crime', 'Business', 'Culture', 'Sport', 'Technology', 'International', 'Environment', 'Health', 'Education'],
    acceptedFileTypes: `${BASE_FILE_TYPES},${IMAGE_FILE_TYPES},${AUDIO_FILE_TYPES}`,
    defaultJournalFolders: ['Current Story', 'Sources', 'Raw Notes', 'Background', 'Research'],
    emptyStateTitle: 'No stories yet',
    emptyStateBody: 'Upload your first document or photo to start building your story archive.',
    emptyStateCta: 'Add first document',
    aiContext: 'You are assisting an investigative journalist. Prioritise verifiable claims, source attribution, factual consistency, and contradictions across notes. Never fabricate quotes or sources.',
    analysisFraming: 'Distinguish verified fact from reported claim from inference — label each explicitly in your analysis. A risk is an unverifiable assertion, a source motive that could invert the narrative, or a gap in the chain of custody. An opportunity is a corroboration lead, a secondary source angle, or an unreported connection worth pursuing. Surface verbatim quotes as separate observations, distinct from paraphrase. Questions should challenge the story: what would disprove this? Who corroborates independently? Flag what is missing as much as what is present.',
    features: {
      ...DEFAULT_FEATURES,
      entities: true,
      timeline: true,
      redactions: true,
      verification: true,
      documentComparison: true,
      riskRegister: true,
      claims: true,
      keywordMonitoring: true,
      investigationTemplate: true,
      defaultFeeds: true,
      showReportMetrics: false,
      journalDescription: 'Investigation notes organised by folder — sources, timelines, claims',
      pulseInNotebook: true,
      peopleInNotebook: true,
      extraNavItems: [
        { href: '/entities',     label: 'Entities',        icon: 'Network',      group: 'analysis'    },
        { href: '/network',      label: 'Entity Network',  icon: 'GitFork',      group: 'analysis'    },
        { href: '/claims',       label: 'Claims',          icon: 'CheckSquare',  group: 'analysis'    },
        { href: '/foia',         label: 'FOIA',            icon: 'FileSearch',   group: 'analysis'    },
        { href: '/risks',        label: 'Risk Register',   icon: 'ShieldAlert',  group: 'analysis'    },
        { href: '/actions',      label: 'Actions',         icon: 'ListChecks',   group: 'analysis'    },
        { href: '/analysis',     label: 'Image Analysis',  icon: 'ScanSearch',   group: 'investigate' },
        { href: '/research',     label: 'Research Tools',  icon: 'History',      group: 'investigate' },
        { href: '/map',          label: 'Photo Map',       icon: 'MapPin',       group: 'investigate' },
        { href: '/speakers',     label: 'Speakers',        icon: 'AudioLines',   group: 'investigate' },
        { href: '/monitors',    label: 'Web Monitor',     icon: 'Eye',          group: 'investigate' },
        { href: '/file-cleaner', label: 'File Cleaner',    icon: 'ShieldCheck',  group: 'intake'      },
      ],
    },
  },

  team_lead: {
    id: 'team_lead',
    label: 'Team Lead',
    tagline: 'Team updates, blockers & sprint tracking',
    icon: '👥',
    personLabel: 'Team Member',
    personLabelPlural: 'Team Members',
    documentLabel: 'Update',
    documentLabelPlural: 'Updates',
    collectionLabel: 'Team',
    collectionLabelPlural: 'Teams',
    projectLabel: 'Project',
    projectLabelPlural: 'Projects',
    navPeople: 'Team',
    navDocuments: 'Add Update',
    navLibrary: 'Library',
    navJournal: 'Notebook',
    uploadTitle: 'Add Team Update',
    uploadDescription: 'Upload status updates, retrospectives, sprint notes, or team documents.',
    uploadAreaLabel: 'Team',
    defaultAreas: ['Engineering', 'Design', 'Product', 'QA', 'DevOps', 'Data', 'Marketing', 'Sales', 'Support'],
    acceptedFileTypes: `${BASE_FILE_TYPES},${AUDIO_FILE_TYPES}`,
    defaultJournalFolders: ['Team Notes', 'Sprint Notes', 'Retrospectives', 'Ideas', 'General'],
    emptyStateTitle: 'No updates yet',
    emptyStateBody: 'Upload your first team update to track progress and surface blockers.',
    emptyStateCta: 'Add first update',
    aiContext: 'You are assisting a team lead. Focus on delivery progress, blockers, team health, sprint velocity, and commitment tracking.',
    analysisFraming: 'Surface what is blocking progress, morale signals, and recurring patterns. A risk is burnout, knowledge concentration, or unaddressed friction — frame without blame and assume good intent. An opportunity is a quick win, an underused capability, or a process improvement the team hasn\'t named. Metrics should capture delivery pace and commitment accuracy. Questions should focus on unblocking: is this a skill gap or a process gap? Who has capacity to help? What would reduce friction this sprint?',
    features: {
      ...DEFAULT_FEATURES,
      documentComparison: true,
      riskRegister: true,
      pulseInNotebook: true,
      peopleInNotebook: true,
      journalDescription: 'Team notes organised by sprint — retrospectives, blockers, decisions',
      extraNavItems: [
        { href: '/risks',     label: 'Risk Register',  icon: 'ShieldAlert' },
        { href: '/actions',   label: 'Blockers',       icon: 'Ban'         },
      ],
    },
  },

  market_research: {
    id: 'market_research',
    label: 'Market Research',
    tagline: 'Interviews, surveys & pattern discovery',
    icon: '🔍',
    personLabel: 'Respondent',
    personLabelPlural: 'Respondents',
    documentLabel: 'Interview',
    documentLabelPlural: 'Interviews',
    collectionLabel: 'Project',
    collectionLabelPlural: 'Projects',
    projectLabel: 'Project',
    projectLabelPlural: 'Projects',
    navPeople: 'Respondents',
    navDocuments: 'Add Interview',
    navLibrary: 'Library',
    navJournal: 'Notebook',
    uploadTitle: 'Add Interview or Data',
    uploadDescription: 'Upload interview transcripts, survey responses, or research documents to identify themes and patterns.',
    uploadAreaLabel: 'Project',
    defaultAreas: ['Consumer Insights', 'Market Analysis', 'Competitor Research', 'Product Research', 'Brand Research', 'UX Research', 'Strategy', 'Pricing'],
    acceptedFileTypes: `${BASE_FILE_TYPES},${AUDIO_FILE_TYPES}`,
    defaultJournalFolders: ['Project Notes', 'Insights', 'Hypotheses', 'Literature Review', 'General'],
    emptyStateTitle: 'No research yet',
    emptyStateBody: 'Upload your first interview or dataset to start identifying themes and patterns.',
    emptyStateCta: 'Add first interview',
    aiContext: 'You are assisting a market researcher. Focus on identifying recurring themes, patterns, outliers, and actionable insights across multiple data sources.',
    analysisFraming: 'Identify distinct respondent segments and their motivations separately — resist aggregating across groups. A risk is missing the real objection beneath the stated one, or treating all respondents as uniform. An opportunity is an unmet need, an underserved segment, or a messaging angle that resonates with a specific group. Surface verbatim quotes as direct evidence; label them separately from inferred themes. Questions should probe willingness-to-pay gaps, missing use cases, and what would change respondent behaviour.',
    features: {
      ...DEFAULT_FEATURES,
      entities: true,
      verification: true,
      documentComparison: true,
      pulseInNotebook: true,
      peopleInNotebook: true,
      journalDescription: 'Research notes organised by project — hypotheses, insights, literature',
      extraNavItems: [
        { href: '/entities',  label: 'Entities',       icon: 'Network'     },
        { href: '/actions',   label: 'Actions',        icon: 'ListChecks'  },
        { href: '/quotes',    label: 'Quote Bank',     icon: 'Quote'       },
        { href: '/themes',    label: 'Themes Board',   icon: 'Layers'      },
      ],
    },
  },

  legal: {
    id: 'legal',
    label: 'Legal',
    tagline: 'Case files, evidence & matter management',
    icon: '⚖️',
    personLabel: 'Client',
    personLabelPlural: 'Clients',
    documentLabel: 'Case File',
    documentLabelPlural: 'Case Files',
    collectionLabel: 'Matter',
    collectionLabelPlural: 'Matters',
    projectLabel: 'Project',
    projectLabelPlural: 'Projects',
    navPeople: 'Clients',
    navDocuments: 'Add Case File',
    navLibrary: 'Library',
    navJournal: 'Notebook',
    uploadTitle: 'Add Case File',
    uploadDescription: 'Upload case documents, evidence, court filings, or correspondence.',
    uploadAreaLabel: 'Matter / Practice Area',
    defaultAreas: ['Criminal', 'Civil', 'Contract', 'Family', 'Property', 'Employment', 'Immigration', 'Corporate', 'Litigation', 'Regulatory'],
    acceptedFileTypes: `${BASE_FILE_TYPES},${IMAGE_FILE_TYPES},${AUDIO_FILE_TYPES}`,
    defaultJournalFolders: ['Case Notes', 'Client Calls', 'Research', 'Evidence', 'Hearings', 'General'],
    emptyStateTitle: 'No case files yet',
    emptyStateBody: 'Upload your first document to start building your case archive.',
    emptyStateCta: 'Add first case file',
    aiContext: 'You are assisting a legal professional. Prioritise accuracy, chronological consistency, evidence chain integrity, and factual precision. Never speculate beyond what the documents contain.',
    analysisFraming: 'Frame every finding as exposure: if X is disputed, this document shows Y, creating Z risk. A risk is financial liability, unenforceable language, missing protections, or precedent against your position. An opportunity is a protective clause, favourable precedent, or appropriate risk allocation to the other party. Distinguish between likely interpretation and possible interpretation; never speculate about untested law. Questions should clarify ambiguity: which party bears this if disputed? What is not in this document that should be?',
    features: {
      ...DEFAULT_FEATURES,
      entities: true,
      timeline: true,
      redactions: true,
      verification: true,
      documentComparison: true,
      investigationTemplate: true,
      riskRegister: true,
      claims: true,
      pulseInNotebook: true,
      peopleInNotebook: true,
      journalDescription: 'Case notes organised by matter — hearings, evidence, client calls',
      extraNavItems: [
        { href: '/entities',     label: 'Parties',        icon: 'Users'        },
        { href: '/network',      label: 'Entity Network', icon: 'GitFork',    group: 'analysis' },
        { href: '/claims',       label: 'Claims',         icon: 'CheckSquare' },
        { href: '/risks',        label: 'Risk Register',  icon: 'ShieldAlert' },
        { href: '/actions',      label: 'Actions',        icon: 'ListChecks'  },
        { href: '/deadlines',    label: 'Deadlines',      icon: 'CalendarClock'},
      ],
    },
  },

  human_resources: {
    id: 'human_resources',
    label: 'Human Resources',
    tagline: 'People operations, talent & workforce analytics',
    icon: '🫂',
    personLabel: 'Employee',
    personLabelPlural: 'Employees',
    documentLabel: 'Report',
    documentLabelPlural: 'Reports',
    collectionLabel: 'Area',
    collectionLabelPlural: 'Areas',
    projectLabel: 'Project',
    projectLabelPlural: 'Projects',
    navPeople: 'Employees',
    navDocuments: 'Add Report',
    navLibrary: 'Library',
    navJournal: 'Notebook',
    uploadTitle: 'Add HR Report',
    uploadDescription: 'Upload HR reports, survey results, workforce analytics, or policy documents.',
    uploadAreaLabel: 'HR Area',
    defaultAreas: ['Recruitment', 'Onboarding', 'L&D', 'Compensation & Benefits', 'Employee Relations', 'HR Operations', 'Workforce Planning', 'DEI', 'Performance Management', 'Payroll', 'Engagement', 'Offboarding'],
    acceptedFileTypes: `${BASE_FILE_TYPES},${AUDIO_FILE_TYPES}`,
    defaultJournalFolders: ['HR Notes', 'Policy Drafts', 'Interview Notes', 'Team Feedback', 'General'],
    emptyStateTitle: 'No reports yet',
    emptyStateBody: 'Upload your first HR report to track workforce health and surface people insights.',
    emptyStateCta: 'Add first report',
    aiContext: 'You are assisting an HR professional. Focus on workforce health, talent trends, employee engagement, compliance risks, and organisational effectiveness. Treat all employee data with sensitivity.',
    analysisFraming: 'Prioritise early-warning signals: flight risk patterns, cultural health drivers, equity gaps, and engagement predictors. A risk is turnover spike potential, legal exposure (harassment patterns, equity violations), or a disengagement cascade that could spread. An opportunity is a retention intervention before departure, untapped talent development, or a root-cause fix — which is usually culture, not compensation. Distinguish one-off complaints from systemic patterns. Questions should target intervention: is this a pay issue or a culture issue? Which groups are at highest risk and what would meaningful improvement look like to them?',
    features: {
      ...DEFAULT_FEATURES,
      documentComparison: true,
      metricsBoard: true,
      riskRegister: true,
      pulseInNotebook: true,
      peopleInNotebook: true,
      journalDescription: 'HR notes organised by area — policy, interviews, team feedback',
      extraNavItems: [
        { href: '/metrics',   label: 'Metrics',           icon: 'BarChart2'    },
        { href: '/risks',     label: 'Risk Register',     icon: 'ShieldAlert'  },
        { href: '/actions',   label: 'Action Tracker',    icon: 'ListChecks'   },
        { href: '/policies',  label: 'Policy Register',   icon: 'ScrollText'   },
        { href: '/deadlines', label: 'Deadlines',         icon: 'CalendarClock'},
        { href: '/capacity',  label: 'Capacity Planning', icon: 'Users2'       },
      ],
    },
  },
}

export const MODE_LIST = Object.values(MODES)
export const DEFAULT_MODE: AppMode = 'executive'

export function getModeConfig(mode: string | undefined | null): ModeConfig {
  return MODES[(mode as AppMode) ?? DEFAULT_MODE] ?? MODES[DEFAULT_MODE]
}

export function isImageFileType(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext.toLowerCase())
}
