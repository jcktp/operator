// Barrel re-export — all existing imports from '@/lib/ai' continue to work unchanged.

export type { AIProvider } from './ai-providers'

// Re-export journalism and vision functions
export { describeImage, transcribeAudio } from './ai-vision'
export {
  extractEntities, extractTimeline, detectRedactions,
  compareDocumentsJournalism, generateVerificationChecklist,
  extractMerged,
  type NamedEntity, type JournalismTimelineEvent, type RedactionEntry,
  type JournalismPassage, type JournalismFigureChange, type JournalismComparison,
  type VerificationItem, type MergedExtractionResult,
} from './ai-journalism'

export * from './ai/analyze'
export * from './ai/dispatch'
export * from './ai/knowledge'
export * from './ai/catch-up'
