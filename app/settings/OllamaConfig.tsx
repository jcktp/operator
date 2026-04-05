'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Loader2, Circle, Download, RefreshCw, Globe, GlobeLock } from 'lucide-react'
import { DEFAULT_MODELS } from './settingsTypes'
import type { ModelSetupMode } from './useSettingsState'
import { getModelCapsClient, modelRamWarning, formatContextWindow } from '@/lib/model-caps-shared'

const ALL_IN_ONE_MODELS = [
  { id: 'gemma4:e2b',       label: 'Gemma 4 E2B',        note: '7.2 GB · text + vision + audio · slow on 16 GB machines' },
  { id: 'gemma4:e4b',       label: 'Gemma 4 E4B',        note: '9.6 GB · text + vision + audio · requires 16 GB+ RAM' },
  { id: 'phi4-multimodal',  label: 'Phi 4 Multimodal',   note: '~8.5 GB · text + vision + audio · Microsoft, generally faster than gemma4' },
]

const VISION_MODELS = [
  { id: 'llava-phi3',  label: 'LLaVA-Phi3',  note: '~2.9 GB · fast, good general vision' },
  { id: 'moondream',   label: 'Moondream',    note: '~1.7 GB · tiny, low RAM' },
  { id: 'minicpm-v',   label: 'MiniCPM-V',   note: '~5.5 GB · strong at text in images' },
  { id: 'llava:7b',    label: 'LLaVA 7B',    note: '~4.7 GB · accurate, larger' },
  { id: 'llava:13b',   label: 'LLaVA 13B',   note: '~8 GB · most accurate, slowest' },
]

const AUDIO_MODELS = [
  { id: 'gemma4:e2b',        label: 'Gemma 4 E2B',        note: '7.2 GB · text + vision + audio · recommended for most machines' },
  { id: 'gemma4:e4b',        label: 'Gemma 4 E4B',        note: '9.6 GB · higher quality · requires 16 GB+ RAM' },
  { id: 'phi4-multimodal',   label: 'Phi 4 Multimodal',   note: '~8.5 GB · text + vision + audio · Microsoft, generally faster than gemma4' },
]

// Text-only models for use in split modes
const TEXT_MODELS = DEFAULT_MODELS.filter(m => !getModelCapsClient(m.id).vision)

function CapBadges({ modelId }: { modelId: string }) {
  const caps = getModelCapsClient(modelId)
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span title="Text" className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 font-mono">T</span>
      {caps.vision && <span title="Vision" className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-mono">V</span>}
      {caps.audio  && <span title="Audio" className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-mono">A</span>}
      <span className="text-[10px] text-gray-400 dark:text-zinc-500">{formatContextWindow(caps.contextWindow)}</span>
      {caps.sizeGB > 0 && <span className="text-[10px] text-gray-400 dark:text-zinc-500">{caps.sizeGB} GB</span>}
    </div>
  )
}

function ModelRadioList({
  models,
  selected,
  onSelect,
  availableModels,
  savedId,
  savedProvider,
  systemRamGb,
  customValue,
  onCustomChange,
  customPlaceholder,
  radioName,
}: {
  models: { id: string; label: string; note: string }[]
  selected: string
  onSelect: (id: string) => void
  availableModels: string[]
  savedId: string
  savedProvider: string
  systemRamGb: number | null
  customValue?: string
  onCustomChange?: (v: string) => void
  customPlaceholder?: string
  radioName: string
}) {
  return (
    <div className="space-y-1.5">
      {models.map(m => {
        const modelBase = m.id.split(':')[0]
        const isPulled = availableModels.some(am => am.split(':')[0] === modelBase)
        const isSelected = selected === m.id && !customValue
        const isCurrent = m.id === savedId && savedProvider === 'ollama'
        const warn = systemRamGb ? modelRamWarning(m.id, systemRamGb) : null
        return (
          <label key={m.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-gray-900 dark:border-zinc-300 bg-gray-50 dark:bg-zinc-800' : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-500'}`}>
            <div className="mt-0.5 shrink-0">
              {isSelected
                ? <div className="w-3.5 h-3.5 rounded-full bg-gray-900 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>
                : <Circle size={14} className="text-gray-300" />}
            </div>
            <input type="radio" name={radioName} value={m.id} checked={isSelected}
              onChange={() => { onSelect(m.id); onCustomChange?.('') }} className="sr-only" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900 dark:text-zinc-50">{m.label}</span>
                <code className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{m.id}</code>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">{m.note}</p>
              <CapBadges modelId={m.id} />
              {isSelected && warn && (
                <p className={`text-[11px] mt-1 ${warn.level === 'error' ? 'text-red-500' : 'text-amber-500'}`}>⚠ {warn.message}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isCurrent && <span className="text-xs text-blue-600 font-medium">active</span>}
              {isPulled && <span className="text-xs text-green-600 font-medium">downloaded</span>}
            </div>
          </label>
        )
      })}
      {onCustomChange !== undefined && (
        <div className="mt-2">
          <input type="text" value={customValue ?? ''} onChange={e => { onCustomChange(e.target.value); if (e.target.value) onSelect('') }}
            placeholder={customPlaceholder ?? 'Custom model name'}
            className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
        </div>
      )}
    </div>
  )
}

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
  effectiveVisionModel: string
  visionModelChanged: boolean
  webAccess: boolean
  setWebAccess: (v: boolean) => void
  ollamaVisionModel: string
  setOllamaVisionModel: (v: string) => void
  customVisionModel: string
  setCustomVisionModel: (v: string) => void
  savedVisionModel: string
  ollamaAudioModel: string
  setOllamaAudioModel: (v: string) => void
  customAudioModel: string
  setCustomAudioModel: (v: string) => void
  savedAudioModel: string
  modelSetupMode: ModelSetupMode
  setModelSetupMode: (m: ModelSetupMode) => void
}

export default function OllamaConfig({
  ollamaHost, setOllamaHost,
  ollamaModel, setOllamaModel,
  customModel, setCustomModel,
  savedModel, savedProvider,
  modelChanged, switchingToOllama, selectedModel,
  effectiveVisionModel, visionModelChanged,
  webAccess, setWebAccess,
  ollamaVisionModel, setOllamaVisionModel,
  customVisionModel, setCustomVisionModel,
  savedVisionModel,
  ollamaAudioModel, setOllamaAudioModel,
  customAudioModel, setCustomAudioModel,
  savedAudioModel,
  modelSetupMode, setModelSetupMode,
}: Props) {
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'ok' | 'error' | 'idle'>('idle')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [ollamaVersion, setOllamaVersion] = useState<string | null>(null)
  const [suggestedTextModels, setSuggestedTextModels] = useState(TEXT_MODELS)
  const [refreshing, setRefreshing] = useState(false)
  const [modelSource, setModelSource] = useState<'live' | 'fallback' | null>(null)
  const [systemRamGb, setSystemRamGb] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then((d: { machine?: { ramGb: number }; ai?: { ollamaVersion?: string | null } }) => {
      if (d.machine?.ramGb) setSystemRamGb(d.machine.ramGb)
      if (d.ai?.ollamaVersion) setOllamaVersion(d.ai.ollamaVersion)
    }).catch(() => {})
    // Auto-check local Ollama on mount so downloaded badges appear immediately
    checkOllama()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkOllama = async () => {
    setOllamaStatus('checking')
    try {
      const res = await fetch('/api/ollama-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: ollamaHost }),
      })
      const data = await res.json() as { models?: string[]; version?: string | null }
      if (res.ok) {
        setOllamaStatus('ok')
        setAvailableModels(data.models ?? [])
        if (data.version) setOllamaVersion(data.version)
      } else {
        setOllamaStatus('error')
      }
    } catch { setOllamaStatus('error') }
  }

  const refreshModels = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/models-refresh')
      const data = await res.json() as { models?: typeof TEXT_MODELS; source?: 'live' | 'fallback' }
      if (data.models) {
        setSuggestedTextModels(data.models.filter(m => {
          const caps = getModelCapsClient(m.id)
          return !caps.vision && !caps.audio
        }))
      }
      if (data.source) setModelSource(data.source)
    } catch {}
    setRefreshing(false)
  }

  // Compute which models will be pulled/removed for the change banner
  const savedSet = new Set([savedModel, savedVisionModel, savedAudioModel].filter(Boolean))
  const newSet = new Set([
    selectedModel,
    modelSetupMode !== 'all-in-one' ? effectiveVisionModel : null,
    modelSetupMode === 'full-split' ? ollamaAudioModel.trim() : null,
  ].filter(Boolean) as string[])
  const willRemove = [...savedSet].filter(m => !newSet.has(m))
  const willPull = [...newSet].filter(m => !savedSet.has(m) && !availableModels.some(am => am.startsWith(m.split(':')[0])))
  const anyChange = modelChanged || visionModelChanged || (modelSetupMode === 'full-split' && ollamaAudioModel.trim() !== savedAudioModel) || switchingToOllama

  const SETUP_MODES: { id: ModelSetupMode; label: string; sub: string; badges: string }[] = [
    { id: 'all-in-one',   label: 'All-in-one',    sub: 'One model for text, vision & audio',   badges: 'T + V + A' },
    { id: 'text-vision',  label: 'Text + Vision',  sub: 'Small text model + dedicated vision',  badges: 'T  |  V'   },
    { id: 'full-split',   label: 'Full split',     sub: 'Three dedicated models, minimal RAM',  badges: 'T | V | A' },
  ]

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
          <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1.5">
            <CheckCircle size={12} /> Connected · {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} available
            {ollamaVersion && <span className="text-gray-400 dark:text-zinc-500">· v{ollamaVersion}</span>}
          </p>
        )}
        {ollamaStatus === 'error' && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} /> Can't reach Ollama. Is it running?
          </p>
        )}
      </div>

      {/* Setup mode selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-2">Model setup</label>
        <div className="grid grid-cols-3 gap-2">
          {SETUP_MODES.map(m => (
            <button key={m.id} type="button" onClick={() => setModelSetupMode(m.id)}
              className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors ${modelSetupMode === m.id ? 'border-gray-900 dark:border-zinc-300 bg-gray-50 dark:bg-zinc-800' : 'border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-500'}`}>
              <span className="text-xs font-semibold text-gray-900 dark:text-zinc-50">{m.label}</span>
              <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5 leading-tight">{m.sub}</span>
              <code className={`text-[10px] font-mono mt-1.5 ${modelSetupMode === m.id ? 'text-gray-700 dark:text-zinc-200' : 'text-gray-400 dark:text-zinc-500'}`}>{m.badges}</code>
            </button>
          ))}
        </div>
      </div>

      {/* ── All-in-one mode ── */}
      {modelSetupMode === 'all-in-one' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">
            Model
            {savedModel && savedProvider === 'ollama' && (
              <span className="ml-2 text-gray-400 dark:text-zinc-500 font-normal">active: <code className="font-mono">{savedModel}</code></span>
            )}
          </label>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Handles text, vision, and audio — one model for everything. Requires more RAM.</p>
          <ModelRadioList
            models={ALL_IN_ONE_MODELS}
            selected={ollamaModel}
            onSelect={setOllamaModel}
            availableModels={availableModels}
            savedId={savedModel}
            savedProvider={savedProvider}
            systemRamGb={systemRamGb}
            customValue={customModel}
            onCustomChange={setCustomModel}
            customPlaceholder="e.g. llava:13b"
            radioName="model"
          />
        </div>
      )}

      {/* ── Text + Vision / Full split: text model ── */}
      {(modelSetupMode === 'text-vision' || modelSetupMode === 'full-split') && (
        <>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">
                Text model
                {savedModel && savedProvider === 'ollama' && (
                  <span className="ml-2 text-gray-400 dark:text-zinc-500 font-normal">active: <code className="font-mono">{savedModel}</code></span>
                )}
              </label>
              <div className="flex items-center gap-2">
                {modelSource === 'live' && <span className="text-[10px] text-green-500">● live</span>}
                {modelSource === 'fallback' && <span className="text-[10px] text-amber-500">● cached</span>}
                <button type="button" onClick={refreshModels} disabled={refreshing}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh list
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Used for all text tasks. Vision and audio handled by dedicated models below.</p>
            <ModelRadioList
              models={suggestedTextModels}
              selected={ollamaModel}
              onSelect={setOllamaModel}
              availableModels={availableModels}
              savedId={savedModel}
              savedProvider={savedProvider}
              systemRamGb={systemRamGb}
              customValue={customModel}
              onCustomChange={setCustomModel}
              customPlaceholder="e.g. deepseek-r1:1.5b"
              radioName="model"
            />
          </div>

          {/* Vision model */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">
              Vision model
              {savedVisionModel && savedProvider === 'ollama' && (
                <span className="ml-2 text-gray-400 dark:text-zinc-500 font-normal">active: <code className="font-mono">{savedVisionModel}</code></span>
              )}
            </label>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Loaded on demand for image uploads only — text model stays in memory the rest of the time.</p>
            <ModelRadioList
              models={VISION_MODELS}
              selected={ollamaVisionModel}
              onSelect={setOllamaVisionModel}
              availableModels={availableModels}
              savedId={savedVisionModel}
              savedProvider={savedProvider}
              systemRamGb={systemRamGb}
              customValue={customVisionModel}
              onCustomChange={setCustomVisionModel}
              customPlaceholder="e.g. gemma4:e2b"
              radioName="vision-model"
            />
          </div>

          {/* Audio model — full split only */}
          {modelSetupMode === 'full-split' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">
                Audio model
                {savedAudioModel && savedProvider === 'ollama' && (
                  <span className="ml-2 text-gray-400 dark:text-zinc-500 font-normal">active: <code className="font-mono">{savedAudioModel}</code></span>
                )}
              </label>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">Loaded only for audio file uploads — unloaded immediately after transcription.</p>
              <ModelRadioList
                models={AUDIO_MODELS}
                selected={ollamaAudioModel}
                onSelect={v => { setOllamaAudioModel(v); setCustomAudioModel('') }}
                availableModels={availableModels}
                savedId={savedAudioModel}
                savedProvider={savedProvider}
                systemRamGb={systemRamGb}
                customValue={customAudioModel}
                onCustomChange={v => { setCustomAudioModel(v); if (v) setOllamaAudioModel('') }}
                customPlaceholder="Or enter any audio-capable model"
                radioName="audio-model"
              />
            </div>
          )}
        </>
      )}

      {/* Pull/remove banner */}
      {anyChange && (
        <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 rounded-lg px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <Download size={13} className="shrink-0 mt-0.5" />
          <span>
            {willPull.length > 0 && <>Saving will pull <strong>{willPull.join(', ')}</strong>{willRemove.length > 0 ? ' and ' : '.'}</>}
            {willRemove.length > 0 && <>remove <strong>{willRemove.join(', ')}</strong>.</>}
            {willPull.length === 0 && willRemove.length === 0 && <>Settings will be updated on save.</>}
            {willPull.length > 0 && <> This may take a few minutes.</>}
          </span>
        </div>
      )}
      {switchingToOllama && !modelChanged && (
        <div className="bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 rounded-lg px-3 py-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
          <Download size={13} className="shrink-0 mt-0.5" />
          <span>Saving will pull <strong>{selectedModel}</strong> to your machine. This may take a few minutes.</span>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">Pull a model manually:</p>
        <code className="text-xs font-mono text-gray-700 dark:text-zinc-200">ollama pull {selectedModel}</code>
      </div>

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
