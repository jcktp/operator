import type { AppMode } from './mode'

export interface ModeReportLabels {
  // Report page sections
  metrics: string
  flags: string
  questionsHeading: string
  questionsPersonPrefix: string  // "Ask", "Verify with", "Raise with" etc
  comparison: string
  content: string
  // Overview signal panels
  flagsPanel: string
  questionsPanel: string
  resolvedPanel: string
  // One pager sections
  onePagerMetrics: string
  onePagerFlags: string
  onePagerQuestions: string
}

const LABELS: Record<AppMode, ModeReportLabels> = {
  executive: {
    metrics: 'Key Metrics',
    flags: 'Observations & Flags',
    questionsHeading: 'Questions to ask',
    questionsPersonPrefix: 'Ask',
    comparison: 'What changed from last report',
    content: 'Report Content',
    flagsPanel: 'Flags & Risks',
    questionsPanel: 'Questions to ask',
    resolvedPanel: 'Resolved since last report',
    onePagerMetrics: 'Metrics',
    onePagerFlags: 'Flags',
    onePagerQuestions: 'Key questions',
  },
  journalism: {
    metrics: 'Key Facts & Claims',
    flags: 'Flags & Anomalies',
    questionsHeading: 'Claims to verify',
    questionsPersonPrefix: 'Verify with',
    comparison: 'Document comparison',
    content: 'Document Content',
    flagsPanel: 'Flags & Anomalies',
    questionsPanel: 'Claims to verify',
    resolvedPanel: 'Resolved since last document',
    onePagerMetrics: 'Key Data',
    onePagerFlags: 'Flags',
    onePagerQuestions: 'Claims to verify',
  },
  team_lead: {
    metrics: 'Delivery Metrics',
    flags: 'Blockers & Risks',
    questionsHeading: 'Questions for your team',
    questionsPersonPrefix: 'Raise with',
    comparison: 'What changed from last update',
    content: 'Update Content',
    flagsPanel: 'Blockers & Risks',
    questionsPanel: 'Open questions',
    resolvedPanel: 'Resolved since last update',
    onePagerMetrics: 'Metrics',
    onePagerFlags: 'Blockers',
    onePagerQuestions: 'Open questions',
  },
  market_research: {
    metrics: 'Key Findings',
    flags: 'Observations & Outliers',
    questionsHeading: 'Hypotheses to test',
    questionsPersonPrefix: 'Explore with',
    comparison: 'Changes from previous wave',
    content: 'Research Content',
    flagsPanel: 'Observations & Outliers',
    questionsPanel: 'Hypotheses to test',
    resolvedPanel: 'Addressed since last wave',
    onePagerMetrics: 'Findings',
    onePagerFlags: 'Observations',
    onePagerQuestions: 'Hypotheses',
  },
  legal: {
    metrics: 'Key Facts',
    flags: 'Issues & Inconsistencies',
    questionsHeading: 'Issues to investigate',
    questionsPersonPrefix: 'Raise with',
    comparison: 'Document changes',
    content: 'Case File Content',
    flagsPanel: 'Issues & Inconsistencies',
    questionsPanel: 'Issues to investigate',
    resolvedPanel: 'Resolved since last filing',
    onePagerMetrics: 'Key Facts',
    onePagerFlags: 'Issues',
    onePagerQuestions: 'Issues to investigate',
  },
  consulting: {
    metrics: 'Key Metrics',
    flags: 'Risks & Issues',
    questionsHeading: 'Questions for your client',
    questionsPersonPrefix: 'Raise with',
    comparison: 'What changed from last deliverable',
    content: 'Deliverable Content',
    flagsPanel: 'Engagement Risks',
    questionsPanel: 'Client questions',
    resolvedPanel: 'Resolved since last deliverable',
    onePagerMetrics: 'Metrics',
    onePagerFlags: 'Risks',
    onePagerQuestions: 'Client questions',
  },
}

export function getReportLabels(modeId?: string): ModeReportLabels {
  return LABELS[(modeId as AppMode) ?? 'executive'] ?? LABELS.executive
}
