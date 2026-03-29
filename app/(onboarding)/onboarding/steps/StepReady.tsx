import type { ModeConfig } from '@/lib/mode'

interface Props {
  modeConfig: ModeConfig
  onComplete: () => void
  onUpload: () => void
}

export default function StepReady({ modeConfig, onComplete, onUpload }: Props) {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-4">
        <div className="w-16 h-16 bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-2xl">✓</span>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50 mb-2">You&apos;re all set.</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Operator is ready. Upload your first {modeConfig.documentLabel.toLowerCase()} to start getting AI insights, or explore the app first.
          </p>
        </div>
      </div>

      <div className="space-y-3 max-w-xs mx-auto">
        <button
          onClick={onUpload}
          className="w-full py-3 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors"
        >
          Upload your first {modeConfig.documentLabel.toLowerCase()} →
        </button>
        <button
          onClick={onComplete}
          className="w-full py-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Explore Operator →
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-zinc-500">
        You can update your AI provider, mode, and context in Settings at any time.
      </p>
    </div>
  )
}
