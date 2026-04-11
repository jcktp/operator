'use client'

import { CheckCircle, AlertCircle, Download } from 'lucide-react'
import type { PullState } from './settingsTypes'

interface Props {
 pull: PullState
 selectedModel: string
 onClose: () => void
}

export default function ModelPullOverlay({ pull, selectedModel, onClose }: Props) {
 return (
 <div className="fixed inset-0 z-[200] bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-6">
 <div className="bg-[var(--surface)] rounded-[10px] p-6 w-full max-w-sm shadow-xl space-y-5">
 <div className="flex items-center gap-3">
 {pull.done
 ? <CheckCircle size={20} className="text-[var(--green)] shrink-0" />
 : pull.error
 ? <AlertCircle size={20} className="text-[var(--red)] shrink-0" />
 : <Download size={20} className="text-[var(--text-subtle)] shrink-0 animate-bounce" />
 }
 <div>
 <p className="text-sm font-semibold text-[var(--text-bright)]">
 {pull.done ? 'Model ready' : pull.error ? 'Pull failed' : `Pulling ${selectedModel}`}
 </p>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">{pull.error ?? pull.status}</p>
 </div>
 </div>
 <div className="w-full bg-[var(--surface-2)] rounded-full h-2 overflow-hidden">
 <div className="h-full bg-[var(--ink)] rounded-full transition-all duration-500" style={{ width: `${pull.progress}%` }} />
 </div>
 <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
 <span>{pull.progress}%</span>
 {!pull.done && !pull.error && <span>This may take a few minutes on first run</span>}
 {(pull.done || pull.error) && (
 <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-body)] font-medium">Close</button>
 )}
 </div>
 </div>
 </div>
 )
}
