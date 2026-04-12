'use client'

import { Radio } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/components/ThemeProvider'
import { cn } from '@/lib/utils'

interface Props {
 userName: string
 onNext: () => void
}

const MODES: { value: ThemeMode; label: string; desc: string }[] = [
 { value: 'light', label: 'Light', desc: 'Always light' },
 { value: 'dark', label: 'Dark', desc: 'Always dark' },
 { value: 'system', label: 'Auto', desc: 'Follows your OS' },
]

export default function StepWelcome({ userName, onNext }: Props) {
 const { mode, setMode } = useTheme()

 return (
 <div className="space-y-8">
 <div className="text-center space-y-3">
 <div className="flex justify-center mb-2">
 <div className="w-12 h-12 bg-[var(--ink)] rounded-[10px] flex items-center justify-center">
 <Radio size={22} className="text-white" />
 </div>
 </div>
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">
 Welcome to Operator{userName ? `, ${userName}` : ''}
 </h1>
 <p className="text-sm text-[var(--text-muted)]">
 Let&apos;s get you set up in a couple of minutes.
 </p>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">What it is</p>
 <ul className="space-y-2.5 text-sm text-[var(--text-body)]">
 <li>A local intelligence layer for your documents, notes, and sources</li>
 <li>All data stored on your machine — nothing sent to the cloud without your AI key</li>
 <li>An AI assistant that works with what you upload, not general knowledge</li>
 </ul>
 </div>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">What it isn&apos;t</p>
 <ul className="space-y-2.5 text-sm text-[var(--text-body)]">
 <li>A search engine or general-purpose knowledge assistant</li>
 <li>A fact-checker — always verify AI outputs before acting on them</li>
 <li>A replacement for legal, financial, or medical professional judgment</li>
 </ul>
 </div>
 </div>

 <div className="bg-[var(--amber-dim)] border border-[var(--amber)] rounded-[10px] px-5 py-4 space-y-1.5">
 <p className="text-xs text-amber-800">
 <strong>AI outputs are probabilistic.</strong> They can be wrong, incomplete, or misleading. Always verify before acting on them.
 </p>
 <p className="text-xs text-amber-700">
 Open source under BSL 1.1 · free for personal and non-commercial use.
 </p>
 </div>

 {/* Appearance */}
 <div>
 <p className="text-xs font-medium text-[var(--text-muted)] mb-3">How would you like the app to look?</p>
 <div className="grid grid-cols-3 gap-2">
 {MODES.map(m => (
 <button
 key={m.value}
 type="button"
 onClick={() => setMode(m.value)}
 className={cn(
 'flex flex-col items-center gap-1.5 py-3 px-2 rounded-[10px] border text-center transition-colors',
 mode === m.value
 ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--ink-contrast)]'
 : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-subtle)] hover:border-[var(--border-mid)]'
 )}
 >
 <span className="text-sm font-medium">{m.label}</span>
 <span className={cn('text-xs', mode === m.value ? 'text-[var(--border)]' : 'text-[var(--text-muted)]')}>{m.desc}</span>
 </button>
 ))}
 </div>
 </div>

 <button
 onClick={onNext}
 className="w-full py-3 bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium rounded-[10px] hover:opacity-90 transition-colors"
 >
 Let&apos;s get you set up →
 </button>
 </div>
 )
}
