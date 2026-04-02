'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, Loader2, Circle, Download, RefreshCw, Globe, GlobeLock } from 'lucide-react'
import { DEFAULT_MODELS } from './settingsTypes'

const MULTIMODAL_PATTERNS = ['llava', 'minicpm-v', 'bakllava', 'moondream', 'qwen2-vl', 'qwen-vl', 'cogvlm', 'internvl', 'phi3-vision', 'phi-3-vision', 'llava-phi3']

function isMultimodalModel(name: string): boolean {
  const lower = name.toLowerCase()
  return MULTIMODAL_PATTERNS.some(p => lower.includes(p))
}

const VISION_MODELS = [
  { id: 'llava-phi3',  label: 'LLaVA-Phi3',  note: '~2.9 GB · fast, good general vision' },
  { id: 'minicpm-v',   label: 'MiniCPM-V',   note: '~5.5 GB · strong at text in images' },
  { id: 'llava:7b',    label: 'LLaVA 7B',    note: '~4.7 GB · accurate, larger' },
  { id: 'llava:13b',   label: 'LLaVA 13B',   note: '~8 GB · most accurate, slowest' },
  { id: 'moondream',   label: 'Moondream',   note: '~1.7 GB · tiny but unreliable on some systems' },
]

interface Props {
  ollamaHost: string
  setOllamaHost: (v: string) => void
  ollamaModel: string
  setOllamaModel: (v: string) => void
  customModel: string
  setCustomModel: (v: string) => void
  savedModel: string
  savedProvider: string
  modelChanged: boolean
  switchingToOllama: boolean
  selectedModel: string
  webAccess: boolean
  setWebAccess: (v: boolean) => void
  ollamaVisionModel: string
  setOllamaVisionModel: (v: string) => void
  customVisionModel: string
  setCustomVisionModel: (v: string) => void
  savedVisionModel: string
}

export default function OllamaConfig({
  ollamaHost, setOllamaHost,
  ollamaModel, setOllamaModel,
  customModel, setCustomModel,
  savedModel, savedProvider,
  modelChanged, switchingToOllama, selectedModel,
  webAccess, setWebAccess,
  ollamaVisionModel, setOllamaVisionModel,
  customVisionModel, setCustomVisionModel,
  savedVisionModel,
}: Props) {
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'ok' | 'error' | 'idle'>('idle')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [suggestedModels, setSuggestedModels] = useState(DEFAULT_MODELS)
  const [refreshing, setRefreshing] = useState(false)

  const checkOllama = async () => {
    setOllamaStatus('checking')
    try {
      const res = await fetch('/api/ollama-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: ollamaHost }),
      })
      const data = await res.json() as { models?: string[] }
      if (res.ok) { setOllamaStatus('ok'); setAvailableModels(data.models ?? []) }
      else setOllamaStatus('error')
    } catch { setOllamaStatus('error') }
  }

  const refreshModels = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/models-refresh')
      const data = await res.json() as { models?: typeof DEFAULT_MODELS }
      if (data.models) setSuggestedModels(data.models)
    } catch {}
    setRefreshing(false)
  }

  return (
    <div className="space-y-4 pt-1 border-t border-gray-100 dark:border-zinc-800">
      {/* Host */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Ollama host</label>
        <div className="flex gap-2">
          <input type="text" value={ollamaHost} onChange={e => setOllamaHost(e.target.value)}
            className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100" />
          <button type="button" onClick={checkOllama}
            className="shrink-0 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 text-xs font-medium px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            {ollamaStatus === 'checking' ? <Loader2 size={13} className="animate-spin" /> : 'Test'}
          </button>
        </div>
        {ollamaStatus === 'ok' && (
          <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
            <CheckCircle size={12} /> Connected · {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} available
          </p>
        )}
        {ollamaStatus === 'error' && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} /> Can't reach Ollama. Is it running?
          </p>
        )}
      </div>

      {/* Model picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">
            Model
            {savedModel && savedProvider === 'ollama' && (
              <span className="ml-2 text-gray-400 dark:text-zinc-500 font-normal">current: <code className="font-mono">{savedModel}</code></span>
            )}
          </label>
          <button type="button" onClick={refreshModels} disabled={refreshing}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh list
          </button>
        </div>

        <div className="space-y-1.5">
          {suggestedModels.map(m => {
            const isPulled = availableModels.some(am => am.startsWith(m.id.split(':')[0]))
            const isSelected = ollamaModel === m.id && !customModel
            const isCurrent = m.id === savedModel && savedProvider === 'ollama'
            return (
              <label key={m.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-gray-900 dark:border-zinc-300 bg-gray-50 dark:bg-zinc-800' : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-500'}`}>
                <div className="mt-0.5 shrink-0">
                  {isSelected
                    ? <div className="w-3.5 h-3.5 rounded-full bg-gray-900 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>
                    : <Circle size={14} className="text-gray-300" />}
                </div>
                <input type="radio" name="model" value={m.id} checked={isSelected}
                  onChange={() => { setOllamaModel(m.id); setCustomModel('') }} className="sr-only" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-50">{m.label}</span>
                    <code className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{m.id}</code>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">{m.note}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isCurrent && <span className="text-xs text-blue-600 font-medium">active</span>}
                  {isPulled && !isCurrent && <span className="text-xs text-green-600 font-medium">pulled</span>}
                </div>
              </label>
            )
          })}
        </div>

        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Or enter any model name</label>
          <input type="text" value={customModel} onChange={e => setCustomModel(e.target.value)}
            placeholder="e.g. deepseek-r1:1.5b"
            className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
        </div>
      </div>

      {switchingToOllama && !modelChanged && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-700 flex items-start gap-2">
          <Download size={13} className="shrink-0 mt-0.5" />
          <span>Saving will pull <strong>{selectedModel}</strong> to your machine. Local AI won't be available until the download completes — this may take a few minutes.</span>
        </div>
      )}
      {modelChanged && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700 flex items-start gap-2">
          <Download size={13} className="shrink-0 mt-0.5" />
          <span>Saving will pull <strong>{selectedModel}</strong> and remove <strong>{savedModel}</strong>. This may take a few minutes.</span>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">Pull a model manually:</p>
        <code className="text-xs font-mono text-gray-700 dark:text-zinc-200">ollama pull {selectedModel}</code>
      </div>

      {/* Vision model picker */}
      {isMultimodalModel(selectedModel) ? (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2.5 text-xs text-blue-700 dark:text-blue-300">
          <strong>{selectedModel}</strong> handles both text and vision — no separate vision model needed.
        </div>
      ) : (
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">
          Vision model
          {savedVisionModel && savedProvider === 'ollama' && (
            <span className="ml-2 text-gray-400 dark:text-zinc-500 font-normal">current: <code className="font-mono">{savedVisionModel}</code></span>
          )}
        </label>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Used for image uploads. Text extraction uses Tesseract (no model needed).</p>
        <div className="space-y-1.5">
          {VISION_MODELS.map(m => {
            const isPulled = availableModels.some(am => am.startsWith(m.id.split(':')[0]))
            const isSelected = ollamaVisionModel === m.id && !customVisionModel
            const isCurrent = m.id === savedVisionModel && savedProvider === 'ollama'
            return (
              <label key={m.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-gray-900 dark:border-zinc-300 bg-gray-50 dark:bg-zinc-800' : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-500'}`}>
                <div className="mt-0.5 shrink-0">
                  {isSelected
                    ? <div className="w-3.5 h-3.5 rounded-full bg-gray-900 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>
                    : <Circle size={14} className="text-gray-300" />}
                </div>
                <input type="radio" name="vision-model" value={m.id} checked={isSelected}
                  onChange={() => { setOllamaVisionModel(m.id); setCustomVisionModel('') }} className="sr-only" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-50">{m.label}</span>
                    <code className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{m.id}</code>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">{m.note}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isCurrent && <span className="text-xs text-blue-600 font-medium">active</span>}
                  {isPulled && !isCurrent && <span className="text-xs text-green-600 font-medium">pulled</span>}
                </div>
              </label>
            )
          })}
        </div>
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Or enter any vision model name</label>
          <input type="text" value={customVisionModel} onChange={e => setCustomVisionModel(e.target.value)}
            placeholder="e.g. llava:34b"
            className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
        </div>
      </div>
      )}

      {/* Web access toggle */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-2">
          {webAccess ? <Globe size={14} className="text-gray-500" /> : <GlobeLock size={14} className="text-gray-400" />}
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-zinc-200">Online access</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Allow AI to fetch URLs and check weather</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWebAccess(!webAccess)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${webAccess ? 'bg-gray-900 dark:bg-zinc-100' : 'bg-gray-200 dark:bg-zinc-700'}`}
          role="switch"
          aria-checked={webAccess}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white dark:bg-zinc-900 shadow transition-transform ${webAccess ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )
}
