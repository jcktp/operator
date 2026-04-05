import type { ModeConfig } from '@/lib/mode'
import ModeIcon from '@/app/settings/ModeIcons'

interface Props {
  modeConfig: ModeConfig
  onNext: () => void
  onBack: () => void
}

const FEATURE_DISPLAY: Record<string, { label: string; desc: (c: ModeConfig) => string }> = {
  entities:           { label: 'Entities',             desc: c => `Named people, organisations, and places extracted and cross-linked across your ${c.documentLabelPlural.toLowerCase()}.` },
  timeline:           { label: 'Timeline',             desc: c => `Events from your ${c.documentLabelPlural.toLowerCase()} assembled into a chronological view.` },
  redactions:         { label: 'Redaction detection',  desc: () => 'Redacted sections flagged and highlighted in uploaded documents.' },
  verification:       { label: 'Verification',         desc: () => 'Claims that need source verification flagged per document.' },
  documentComparison: { label: 'Document comparison',  desc: c => `Side-by-side AI comparison between two ${c.documentLabelPlural.toLowerCase()} to surface differences.` },
  keywordMonitoring:  { label: 'Keyword monitoring',   desc: () => 'Track keywords across Pulse feeds — highlighted when they appear in new items.' },
  metricsBoard:       { label: 'Metrics board',        desc: c => `Aggregated KPI tracking and time-series charts across all your ${c.documentLabelPlural.toLowerCase()}.` },
}

const UNIVERSAL: Array<{ label: string; desc: (c: ModeConfig) => string }> = [
  { label: 'Library',      desc: c => `Upload ${c.documentLabelPlural.toLowerCase()} and get AI-generated summaries, flags, and insights.` },
  { label: 'Dispatch AI',  desc: () => 'Ask anything about your documents, get cross-references, and draft outputs.' },
  { label: 'Journal',      desc: c => `Private notes with AI rewrite. Folders: ${c.defaultJournalFolders.slice(0, 3).join(', ')}, and more.` },
  { label: 'Files',        desc: () => 'Browse and manage files saved by Operator. Analyse documents directly from the folder view.' },
  { label: 'Pulse',        desc: () => 'RSS feeds for sources you follow. Save items to your Library in one click.' },
]

export default function StepMode({ modeConfig, onNext, onBack }: Props) {
  const features = modeConfig.features as unknown as Record<string, unknown>
  const enabledFeatures = Object.entries(FEATURE_DISPLAY)
    .filter(([key]) => features[key] === true)
    .map(([, def]) => ({ label: def.label, desc: def.desc(modeConfig) }))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 text-gray-700 dark:text-zinc-200 shrink-0">
            <ModeIcon modeId={modeConfig.id} className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-50">{modeConfig.label} mode</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400 ml-10">{modeConfig.tagline}</p>
      </div>

      {enabledFeatures.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-3">
            Features enabled for your mode
          </p>
          <div className="space-y-2">
            {enabledFeatures.map(f => (
              <div key={f.label} className="flex items-start gap-3 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg px-4 py-3">
                <span className="text-indigo-500 mt-0.5 shrink-0">✦</span>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">{f.label}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-3">
          Available in all modes
        </p>
        <div className="space-y-2">
          {UNIVERSAL.map(f => (
            <div key={f.label} className="flex items-start gap-3 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-lg px-4 py-3">
              <span className="text-gray-300 dark:text-zinc-600 mt-0.5 shrink-0">◆</span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">{f.label}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{f.desc(modeConfig)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-zinc-500 text-center">
        You can switch modes or customise labels in Settings at any time.
      </p>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
          ← Back
        </button>
        <button onClick={onNext} className="flex-[3] py-3 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors">
          Continue →
        </button>
      </div>
    </div>
  )
}
