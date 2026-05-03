export type AppMode = 'journalism'

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
  /** Move the navPeople link (Contacts/Directs/etc.) from Analysis into the Notebook dropdown */
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
  journalism: {
    id: 'journalism',
    label: 'Journalism',
    tagline: 'Field notes, sources & story research',
    icon: '📰',
    personLabel: 'Contact',
    personLabelPlural: 'Contacts',
    documentLabel: 'Notes',
    documentLabelPlural: 'Notes',
    collectionLabel: 'Beat',
    collectionLabelPlural: 'Beats',
    projectLabel: 'Story',
    projectLabelPlural: 'Stories',
    navPeople: 'Contacts',
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
        { href: '/tracker',      label: 'Tracker',         icon: 'CheckSquare',  group: 'analysis'    },
        { href: '/knowledge',    label: 'Knowledge',       icon: 'GraduationCap', group: 'analysis'   },
        { href: '/analysis',     label: 'Image Analysis',  icon: 'ScanSearch',   group: 'analysis'    },
        { href: '/map',          label: 'Photo Map',       icon: 'MapPin',       group: 'analysis'    },
        { href: '/speakers',     label: 'Speakers',        icon: 'AudioLines',   group: 'analysis'    },
        { href: '/file-cleaner', label: 'File Cleaner',    icon: 'ShieldCheck',  group: 'intake'      },
      ],
    },
  },
}

export const MODE_LIST = Object.values(MODES)
export const DEFAULT_MODE: AppMode = 'journalism'

export function getModeConfig(mode: string | undefined | null): ModeConfig {
  return MODES[(mode as AppMode) ?? DEFAULT_MODE] ?? MODES[DEFAULT_MODE]
}

export function isImageFileType(ext: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext.toLowerCase())
}
