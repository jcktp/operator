'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, Loader2, Circle, Download, RefreshCw, Globe, GlobeLock } from 'lucide-react'
import { DEFAULT_MODELS } from './settingsTypes'

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
}

export default function OllamaConfig({
  ollamaHost, setOllamaHost,
  ollamaModel, setOllamaModel,
  customModel, setCustomModel,
  savedModel, savedProvider,
  modelChanged, switchingToOllama, selectedModel,
  webAccess, setWebAccess,
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
    <div className="space-y-4 pt-1 border-t border-gray-100">
      {/* Host */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Ollama host</label>
        <div className="flex gap-2">
          <input type="text" value={ollamaHost} onChange={e => setOllamaHost(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button type="button" onClick={checkOllama}
            className="shrink-0 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
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
          <label className="text-xs font-medium text-gray-600">
            Model
            {savedModel && savedProvider === 'ollama' && (
              <span className="ml-2 text-gray-400 font-normal">current: <code className="font-mono">{savedModel}</code></span>
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
              <label key={m.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="mt-0.5 shrink-0">
                  {isSelected
                    ? <div className="w-3.5 h-3.5 rounded-full bg-gray-900 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>
                    : <Circle size={14} className="text-gray-300" />}
                </div>
                <input type="radio" name="model" value={m.id} checked={isSelected}
                  onChange={() => { setOllamaModel(m.id); setCustomModel('') }} className="sr-only" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{m.label}</span>
                    <code className="text-xs text-gray-400 font-mono">{m.id}</code>
                  </div>
                  <p className="text-xs text-gray-400">{m.note}</p>
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
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Or enter any model name</label>
          <input type="text" value={customModel} onChange={e => setCustomModel(e.target.value)}
            placeholder="e.g. deepseek-r1:1.5b"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900" />
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

      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-500 mb-1">Pull a model manually:</p>
        <code className="text-xs font-mono text-gray-700">ollama pull {selectedModel}</code>
      </div>

      {/* Web access toggle */}
      <div className="flex items-center justify-between py-1">
        <div className="flex items-center gap-2">
          {webAccess ? <Globe size={14} className="text-gray-500" /> : <GlobeLock size={14} className="text-gray-400" />}
          <div>
            <p className="text-xs font-medium text-gray-700">Online access</p>
            <p className="text-xs text-gray-400">Allow AI to fetch URLs and check weather</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWebAccess(!webAccess)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${webAccess ? 'bg-gray-900' : 'bg-gray-200'}`}
          role="switch"
          aria-checked={webAccess}
        >
          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${webAccess ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )
}
