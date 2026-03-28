export type AppMode =
  | 'executive'
  | 'journalism'
  | 'team_lead'
  | 'market_research'
  | 'legal'
  | 'consulting'

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
  /** Extra nav items inserted after the library link (icon: lucide icon name) */
  extraNavItems: Array<{ href: string; label: string; icon: string }>
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
  journalDescription: null,
  extraNavItems: [] as Array<{ href: string; label: string; icon: string }>,
}

const BASE_FILE_TYPES = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md'
const IMAGE_FILE_TYPES = '.jpg,.jpeg,.png,.webp,.heic,.gif'

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
    navPeople: 'Directs',
    navDocuments: 'Add Report',
    navLibrary: 'Library',
    navJournal: 'Journal',
    uploadTitle: 'Add Report',
    uploadDescription: 'Upload reports from your team to get AI-powered insights across your business.',
    uploadAreaLabel: 'Business Area',
    defaultAreas: ['Finance', 'HR & People', 'Sales', 'Marketing', 'Operations', 'Product', 'Engineering', 'Legal', 'Customer Success', 'Recruitment', 'Strategy', 'Other'],
    acceptedFileTypes: BASE_FILE_TYPES,
    defaultJournalFolders: ['Weekly Reflections', 'Ideas', 'Decisions', 'General'],
    emptyStateTitle: 'No reports yet',
    emptyStateBody: 'Upload your first report to get a unified view of your business.',
    emptyStateCta: 'Add first report',
    aiContext: 'You are advising a business executive. Focus on operational performance, financial health, team effectiveness, and strategic opportunities.',
    analysisFraming: 'Extract business metrics, operational insights, risks, and opportunities. Identify trends and anomalies relative to targets or prior periods.',
    features: { ...DEFAULT_FEATURES },
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
    navPeople: 'Sources',
    navDocuments: 'Add Notes',
    navLibrary: 'Story Archive',
    navJournal: 'Notebook',
    uploadTitle: 'Add Notes or Photo',
    uploadDescription: 'Add field notes, documents, photos, or source materials to your story archive.',
    uploadAreaLabel: 'Beat / Story',
    defaultAreas: ['Politics', 'Crime', 'Business', 'Culture', 'Sport', 'Technology', 'International', 'Environment', 'Health', 'Education'],
    acceptedFileTypes: `${BASE_FILE_TYPES},${IMAGE_FILE_TYPES}`,
    defaultJournalFolders: ['Current Story', 'Sources', 'Raw Notes', 'Background', 'Research'],
    emptyStateTitle: 'No stories yet',
    emptyStateBody: 'Add your first notes or photos to start building your story archive.',
    emptyStateCta: 'Add first notes',
    aiContext: 'You are assisting an investigative journalist. Prioritise verifiable claims, source attribution, factual consistency, and contradictions across notes. Never fabricate quotes or sources.',
    analysisFraming: 'Extract factual claims with source attribution where present. Flag any inconsistencies or contradictions between sources. Surface direct quotes separately from paraphrase. Note any claims that require verification or lack a named source.',
    features: {
      ...DEFAULT_FEATURES,
      entities: true,
      timeline: true,
      redactions: true,
      verification: true,
      documentComparison: true,
      keywordMonitoring: true,
      investigationTemplate: true,
      defaultFeeds: true,
      journalDescription: 'Investigation notes organised by folder — sources, timelines, claims',
      extraNavItems: [{ href: '/entities', label: 'Entities', icon: 'Network' }],
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
    navPeople: 'Team',
    navDocuments: 'Add Update',
    navLibrary: 'Updates',
    navJournal: 'Journal',
    uploadTitle: 'Add Team Update',
    uploadDescription: 'Upload status updates, retrospectives, sprint notes, or team documents.',
    uploadAreaLabel: 'Team',
    defaultAreas: ['Engineering', 'Design', 'Product', 'QA', 'DevOps', 'Data', 'Marketing', 'Sales', 'Support'],
    acceptedFileTypes: BASE_FILE_TYPES,
    defaultJournalFolders: ['Team Notes', 'Sprint Notes', 'Retrospectives', 'Ideas', 'General'],
    emptyStateTitle: 'No updates yet',
    emptyStateBody: 'Upload your first team update to track progress and surface blockers.',
    emptyStateCta: 'Add first update',
    aiContext: 'You are assisting a team lead. Focus on delivery progress, blockers, team health, sprint velocity, and commitment tracking.',
    analysisFraming: 'Extract team progress, completed work, blockers, and upcoming commitments. Flag risks to delivery timelines and recurring issues across updates.',
    features: { ...DEFAULT_FEATURES },
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
    navPeople: 'Respondents',
    navDocuments: 'Add Interview',
    navLibrary: 'Research Archive',
    navJournal: 'Research Notes',
    uploadTitle: 'Add Interview or Data',
    uploadDescription: 'Upload interview transcripts, survey responses, or research documents to identify themes and patterns.',
    uploadAreaLabel: 'Project',
    defaultAreas: ['Consumer Insights', 'Market Analysis', 'Competitor Research', 'Product Research', 'Brand Research', 'UX Research', 'Strategy', 'Pricing'],
    acceptedFileTypes: BASE_FILE_TYPES,
    defaultJournalFolders: ['Project Notes', 'Insights', 'Hypotheses', 'Literature Review', 'General'],
    emptyStateTitle: 'No research yet',
    emptyStateBody: 'Upload your first interview or dataset to start identifying themes and patterns.',
    emptyStateCta: 'Add first interview',
    aiContext: 'You are assisting a market researcher. Focus on identifying recurring themes, patterns, outliers, and actionable insights across multiple data sources.',
    analysisFraming: 'Extract key themes, verbatim quotes from respondents, and emerging patterns. Identify areas of consensus and divergence. Flag notable outliers or contradictions worth exploring further.',
    features: { ...DEFAULT_FEATURES },
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
    navPeople: 'Clients',
    navDocuments: 'Add Case File',
    navLibrary: 'Case Archive',
    navJournal: 'Case Notes',
    uploadTitle: 'Add Case File',
    uploadDescription: 'Upload case documents, evidence, court filings, or correspondence.',
    uploadAreaLabel: 'Matter / Practice Area',
    defaultAreas: ['Criminal', 'Civil', 'Contract', 'Family', 'Property', 'Employment', 'Immigration', 'Corporate', 'Litigation', 'Regulatory'],
    acceptedFileTypes: `${BASE_FILE_TYPES},${IMAGE_FILE_TYPES}`,
    defaultJournalFolders: ['Case Notes', 'Client Calls', 'Research', 'Evidence', 'Hearings', 'General'],
    emptyStateTitle: 'No case files yet',
    emptyStateBody: 'Upload your first document to start building your case archive.',
    emptyStateCta: 'Add first case file',
    aiContext: 'You are assisting a legal professional. Prioritise accuracy, chronological consistency, evidence chain integrity, and factual precision. Never speculate beyond what the documents contain.',
    analysisFraming: 'Extract key dates, parties, and legal claims. Flag any factual inconsistencies or contradictions. Surface evidence references and note any apparent gaps in the record or missing documentation.',
    features: { ...DEFAULT_FEATURES },
  },

  consulting: {
    id: 'consulting',
    label: 'Consulting',
    tagline: 'Client engagements, deliverables & progress',
    icon: '💼',
    personLabel: 'Client',
    personLabelPlural: 'Clients',
    documentLabel: 'Deliverable',
    documentLabelPlural: 'Deliverables',
    collectionLabel: 'Engagement',
    collectionLabelPlural: 'Engagements',
    navPeople: 'Clients',
    navDocuments: 'Add Deliverable',
    navLibrary: 'Deliverables',
    navJournal: 'Journal',
    uploadTitle: 'Add Deliverable or Document',
    uploadDescription: 'Upload client documents, deliverables, meeting notes, or status reports.',
    uploadAreaLabel: 'Engagement',
    defaultAreas: ['Strategy', 'Operations', 'Digital Transformation', 'Finance', 'HR & Org', 'Technology', 'Marketing', 'Risk & Compliance', 'Change Management'],
    acceptedFileTypes: BASE_FILE_TYPES,
    defaultJournalFolders: ['Client Notes', 'Meeting Notes', 'Ideas', 'Research', 'General'],
    emptyStateTitle: 'No deliverables yet',
    emptyStateBody: 'Upload your first document to start tracking your engagement work.',
    emptyStateCta: 'Add first deliverable',
    aiContext: 'You are assisting a consultant. Focus on client value delivery, project progress, risks, and actionable recommendations. Frame insights in terms of client impact.',
    analysisFraming: 'Extract project progress, deliverable status, risks, and key recommendations. Identify milestones achieved, outstanding commitments, and any scope or timeline concerns.',
    features: { ...DEFAULT_FEATURES },
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
