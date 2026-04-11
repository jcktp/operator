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
 <div className="w-16 h-16 bg-[var(--green-dim)] border border-green-100 rounded-2xl flex items-center justify-center mx-auto">
 <span className="text-2xl">✓</span>
 </div>
 <div>
 <h2 className="text-2xl font-semibold text-[var(--text-bright)] mb-2">You&apos;re all set.</h2>
 <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
 Operator is ready. Upload your first {modeConfig.documentLabel.toLowerCase()} to start getting AI insights, or explore the app first.
 </p>
 </div>
 </div>

 <div className="space-y-3 max-w-xs mx-auto">
 <button
 onClick={onUpload}
 className="w-full py-3 bg-[var(--ink)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-colors"
 >
 Upload your first {modeConfig.documentLabel.toLowerCase()} →
 </button>
 <button
 onClick={onComplete}
 className="w-full py-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-body)] text-sm font-medium rounded-xl hover:bg-[var(--surface-2)] transition-colors"
 >
 Explore Operator →
 </button>
 </div>

 <p className="text-xs text-[var(--text-muted)]">
 You can update your AI provider, mode, and context in Settings at any time.
 </p>
 </div>
 )
}
