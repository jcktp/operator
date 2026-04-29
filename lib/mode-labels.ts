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
}

export function getReportLabels(modeId?: string): ModeReportLabels {
  return LABELS[(modeId as AppMode) ?? 'journalism'] ?? LABELS.journalism
}
