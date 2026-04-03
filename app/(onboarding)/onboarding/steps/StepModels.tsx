'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, AlertCircle, Loader2, Download, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

interface ModelDef {
  id: string
  label: string
  role: string
  size: string
  fallbacks?: string[]
}

type DownloadState = 'idle' | 'pending' | 'downloading' | 'done' | 'error'

interface ModelStatus {
  state: DownloadState
  progress: number
  error?: string
}

// Curated model list
const ALL_MODELS: ModelDef[] = [
  { id: 'phi4-mini',    label: 'phi4-mini',    role: 'Text analysis & reports',  size: '2.5 GB', fallbacks: ['qwen3:4b', 'llama3.2:3b', 'gemma2:2b'] },
  { id: 'llava',        label: 'llava',        role: 'Image & document vision',  size: '4.7 GB', fallbacks: ['llava-llama3', 'moondream'] },
  { id: 'qwen3:4b',     label: 'qwen3:4b',     role: 'Text analysis (smaller)',  size: '2.6 GB' },
  { id: 'llama3.2:3b',  label: 'llama3.2:3b',  role: 'Text analysis (fallback)', size: '2.0 GB' },
  { id: 'gemma2:2b',    label: 'gemma2:2b',    role: 'Text analysis (fallback)', size: '1.6 GB' },
  { id: 'llava-llama3', label: 'llava-llama3',  role: 'Vision (fallback)',        size: '4.7 GB' },
  { id: 'moondream',    label: 'moondream',    role: 'Vision (lightweight)',      size: '1.8 GB' },
]

const PRESETS = {
  recommended: ['phi4-mini', 'llava'],
  textonly:    ['phi4-mini'],
}

type Preset = 'recommended' | 'textonly' | 'custom'

function modelById(id: string): ModelDef {
  return ALL_MODELS.find(m => m.id === id) ?? { id, label: id, role: '', size: '?' }
}

export default function StepModels({ onNext, onBack, onSkip }: Props) {
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null)
  const [installed, setInstalled] = useState<string[]>([])
  const [preset, setPreset] = useState<Preset>('recommended')
  const [selected, setSelected] = useState<string[]>(PRESETS.recommended)
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({})
  const [running, setRunning] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  // Fallback suggestions: modelId → suggested fallback model id
  const [fallbackFor, setFallbackFor] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch('/api/ollama-status')
      .then(r => r.json())
      .then((d: { running: boolean; models: string[] }) => {
        setOllamaOk(d.running)
        setInstalled(d.models)
      })
      .catch(() => setOllamaOk(false))
  }, [])

  const setPresetChoice = (p: Preset) => {
    setPreset(p)
    if (p === 'recommended') setSelected(PRESETS.recommended)
    else if (p === 'textonly') setSelected(PRESETS.textonly)
    setShowCustomPicker(p === 'custom')
  }

  const toggleCustomModel = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const pullModel = async (modelId: string): Promise<boolean> => {
    setStatuses(prev => ({ ...prev, [modelId]: { state: 'downloading', progress: 0 } }))
    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/model-pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId }),
        signal: abort.signal,
      })
      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6)) as { status?: string; progress?: number; error?: string }
            if (data.error) {
              setStatuses(prev => ({ ...prev, [modelId]: { state: 'error', progress: 0, error: data.error } }))
              // Suggest first available fallback
              const def = modelById(modelId)
              if (def.fallbacks?.length) {
                setFallbackFor(prev => ({ ...prev, [modelId]: def.fallbacks![0] }))
              }
              return false
            }
            setStatuses(prev => ({
              ...prev,
              [modelId]: { state: data.status === 'success' ? 'done' : 'downloading', progress: data.progress ?? prev[modelId]?.progress ?? 0 },
            }))
          } catch {}
        }
      }

      setStatuses(prev => ({ ...prev, [modelId]: { state: 'done', progress: 100 } }))
      return true
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return false
      setStatuses(prev => ({ ...prev, [modelId]: { state: 'error', progress: 0, error: 'Download interrupted' } }))
      return false
    }
  }

  const startDownloads = async () => {
    setRunning(true)
    // Mark all selected as pending
    const toDownload = selected.filter(id => !installed.includes(id))
    setStatuses(prev => {
      const next = { ...prev }
      for (const id of toDownload) next[id] = { state: 'pending', progress: 0 }
      for (const id of selected.filter(id => installed.includes(id))) next[id] = { state: 'done', progress: 100 }
      return next
    })

    for (const modelId of toDownload) {
      await pullModel(modelId)
    }

    setRunning(false)
    setAllDone(true)
  }

  const useFallback = (originalId: string, fallbackId: string) => {
    setSelected(prev => prev.map(id => id === originalId ? fallbackId : id))
    setStatuses(prev => {
      const next = { ...prev }
      delete next[originalId]
      return next
    })
    setFallbackFor(prev => { const n = { ...prev }; delete n[originalId]; return n })
  }

  const totalSize = selected
    .filter(id => !installed.includes(id))
    .reduce((sum, id) => {
      const s = modelById(id).size.replace(' GB', '')
      return sum + parseFloat(s)
    }, 0)

  if (ollamaOk === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 size={24} className="animate-spin text-gray-400" />
        <p className="text-sm text-gray-500 dark:text-zinc-400">Checking Ollama…</p>
      </div>
    )
  }

  if (!ollamaOk) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-50 mb-1">AI models</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Ollama isn't running. Local AI models require Ollama to be installed and running on your machine.
          </p>
        </div>
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          Start Ollama, then come back to this step — or skip and configure AI later in Settings.
        </div>
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
            ← Back
          </button>
          <button onClick={onSkip} className="flex-[3] py-3 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors">
            Skip — configure AI later →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-50 mb-1">AI models</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Choose which local models to install. These run entirely on your machine — no data leaves your device.
        </p>
      </div>

      {/* Preset picker */}
      {!running && !allDone && (
        <div className="grid grid-cols-3 gap-2">
          {(['recommended', 'textonly', 'custom'] as Preset[]).map(p => (
            <button
              key={p}
              onClick={() => setPresetChoice(p)}
              className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors text-left ${
                preset === p
                  ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-gray-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500'
              }`}
            >
              {p === 'recommended' ? 'Recommended' : p === 'textonly' ? 'Text only' : 'Custom'}
              <div className={`text-[10px] mt-0.5 font-normal ${preset === p ? 'text-gray-300 dark:text-zinc-600' : 'text-gray-400 dark:text-zinc-500'}`}>
                {p === 'recommended' ? 'Text + vision' : p === 'textonly' ? 'Text analysis only' : 'Pick your own'}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Custom model picker */}
      {!running && !allDone && preset === 'custom' && (
        <div className="border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowCustomPicker(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-gray-700 dark:text-zinc-200 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <span>{selected.length} model{selected.length !== 1 ? 's' : ''} selected</span>
            {showCustomPicker ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showCustomPicker && (
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {ALL_MODELS.filter(m => !m.id.includes(':') || m.id === 'qwen3:4b' || m.id === 'llama3.2:3b').map(m => (
                <label key={m.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.includes(m.id)}
                    onChange={() => toggleCustomModel(m.id)}
                    className="rounded border-gray-300 dark:border-zinc-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-zinc-50">{m.label}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500">{m.role}</p>
                  </div>
                  <span className={`text-[11px] shrink-0 ${installed.includes(m.id) ? 'text-green-500' : 'text-gray-400 dark:text-zinc-500'}`}>
                    {installed.includes(m.id) ? 'Installed' : m.size}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model list with statuses */}
      <div className="space-y-2">
        {selected.map(id => {
          const m = modelById(id)
          const st = statuses[id]
          const isInstalled = installed.includes(id)
          const fb = fallbackFor[id]

          return (
            <div key={id} className="border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                {st?.state === 'done' || (!st && isInstalled)
                  ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                  : st?.state === 'error'
                    ? <AlertCircle size={14} className="text-red-500 shrink-0" />
                    : st?.state === 'downloading'
                      ? <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
                      : st?.state === 'pending'
                        ? <Download size={14} className="text-gray-300 dark:text-zinc-600 shrink-0" />
                        : <Download size={14} className="text-gray-300 dark:text-zinc-600 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-900 dark:text-zinc-50">{m.label}</p>
                    <span className={`text-[11px] shrink-0 ${
                      st?.state === 'done' || (!st && isInstalled) ? 'text-green-500' :
                      st?.state === 'error' ? 'text-red-500' :
                      st?.state === 'downloading' ? 'text-blue-500' :
                      'text-gray-400 dark:text-zinc-500'
                    }`}>
                      {st?.state === 'done' || (!st && isInstalled) ? 'Ready' :
                       st?.state === 'error' ? 'Failed' :
                       st?.state === 'downloading' ? `${st.progress}%` :
                       st?.state === 'pending' ? 'Queued…' :
                       isInstalled ? 'Installed' : m.size}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500">{m.role}</p>
                  {st?.state === 'downloading' && (
                    <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${st.progress}%` }}
                      />
                    </div>
                  )}
                  {st?.state === 'error' && st.error && (
                    <p className="text-[11px] text-red-500 mt-0.5">{st.error}</p>
                  )}
                  {fb && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-400 dark:text-zinc-500">Try instead:</span>
                      <button
                        onClick={() => useFallback(id, fb)}
                        className="text-[11px] text-indigo-500 hover:underline"
                      >
                        {fb} ({modelById(fb).size})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Size summary */}
      {!running && !allDone && totalSize > 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 text-center">
          ~{totalSize.toFixed(1)} GB to download
        </p>
      )}

      {/* Actions */}
      {!running && !allDone && (
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-3 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors">
            ← Back
          </button>
          {selected.length > 0 && totalSize > 0 ? (
            <button
              onClick={startDownloads}
              className="flex-[3] py-3 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors"
            >
              Download {selected.filter(id => !installed.includes(id)).length} model{selected.filter(id => !installed.includes(id)).length !== 1 ? 's' : ''} →
            </button>
          ) : (
            <button
              onClick={onNext}
              className="flex-[3] py-3 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors"
            >
              Continue →
            </button>
          )}
        </div>
      )}

      {running && (
        <div className="flex gap-3">
          <button onClick={onSkip} className="flex-1 py-3 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
            Skip remaining
          </button>
        </div>
      )}

      {allDone && (
        <div className="flex gap-3">
          <button
            onClick={onNext}
            className="w-full py-3 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-xl hover:bg-gray-700 dark:hover:bg-zinc-200 transition-colors"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Skip link */}
      {!running && !allDone && (
        <p className="text-center">
          <button onClick={onSkip} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
            Skip — configure AI later
          </button>
        </p>
      )}
    </div>
  )
}
