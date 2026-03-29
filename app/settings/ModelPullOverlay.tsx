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
    <div className="fixed inset-0 z-50 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-5">
        <div className="flex items-center gap-3">
          {pull.done
            ? <CheckCircle size={20} className="text-green-600 shrink-0" />
            : pull.error
            ? <AlertCircle size={20} className="text-red-500 shrink-0" />
            : <Download size={20} className="text-gray-600 dark:text-zinc-300 shrink-0 animate-bounce" />
          }
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50">
              {pull.done ? 'Model ready' : pull.error ? 'Pull failed' : `Pulling ${selectedModel}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{pull.error ?? pull.status}</p>
          </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-gray-900 dark:bg-zinc-100 rounded-full transition-all duration-500" style={{ width: `${pull.progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-zinc-500">
          <span>{pull.progress}%</span>
          {!pull.done && !pull.error && <span>This may take a few minutes on first run</span>}
          {(pull.done || pull.error) && (
            <button onClick={onClose} className="text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 font-medium">Close</button>
          )}
        </div>
      </div>
    </div>
  )
}
