'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, AlertCircle, Loader2, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { getModelCapsClient, modelRamWarning, formatContextWindow } from '@/lib/model-caps-shared'

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
 { id: 'phi4-mini', label: 'phi4-mini', role: 'Text analysis · fast, structured output', size: '2.5 GB', fallbacks: ['qwen3:4b', 'llama3.2:3b', 'gemma2:2b'] },
 { id: 'gemma4:e2b', label: 'gemma4:e2b', role: 'Text + vision + audio · 128K context', size: '7.2 GB', fallbacks: ['gemma4:e4b', 'llava-phi3'] },
 { id: 'gemma4:e4b', label: 'gemma4:e4b', role: 'Text + vision + audio · higher quality', size: '9.6 GB', fallbacks: ['gemma4:e2b'] },
 { id: 'llava', label: 'llava', role: 'Image & document vision', size: '4.7 GB', fallbacks: ['llava-llama3', 'moondream'] },
 { id: 'qwen3:4b', label: 'qwen3:4b', role: 'Text analysis', size: '2.6 GB' },
 { id: 'llama3.2:3b', label: 'llama3.2:3b', role: 'Text analysis (fallback)', size: '2.0 GB' },
 { id: 'gemma2:2b', label: 'gemma2:2b', role: 'Text analysis (fallback)', size: '1.6 GB' },
 { id: 'llava-llama3', label: 'llava-llama3', role: 'Vision (fallback)', size: '4.7 GB' },
 { id: 'moondream', label: 'moondream', role: 'Vision (lightweight)', size: '1.8 GB' },
]

const PRESETS = {
 recommended: ['phi4-mini', 'llava'],
 multimodal: ['gemma4:e2b'], // single model — text + vision + audio
 textonly: ['phi4-mini'],
}

type Preset = 'recommended' | 'multimodal' | 'textonly' | 'custom'

function modelById(id: string): ModelDef {
 return ALL_MODELS.find(m => m.id === id) ?? { id, label: id, role: '', size: '?' }
}

// Ollama may store tagless names as 'name:latest' (e.g. 'phi4-mini:latest').
// Exact match first; fall back to checking ':latest' suffix for tagless ids.
function isModelInstalled(installed: string[], modelId: string): boolean {
 if (installed.includes(modelId)) return true
 if (!modelId.includes(':') && installed.includes(modelId + ':latest')) return true
 return false
}

export default function StepModels({ onNext, onBack, onSkip }: Props) {
 const [ollamaOk, setOllamaOk] = useState<boolean | null>(null)
 const [installed, setInstalled] = useState<string[]>([])
 const [preset, setPreset] = useState<Preset>('recommended')
 const [selected, setSelected] = useState<string[]>(PRESETS.recommended)
 const [systemRamGb, setSystemRamGb] = useState<number | null>(null)

 useEffect(() => {
 fetch('/api/health').then(r => r.json()).then((d: { machine?: { ramGb: number } }) => {
 if (d.machine?.ramGb) setSystemRamGb(d.machine.ramGb)
 }).catch(() => {})
 }, [])
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

 // Auto-mark done when all selected models are already installed
 useEffect(() => {
 if (installed.length > 0 && selected.length > 0 && selected.every(id => isModelInstalled(installed, id))) {
 saveModelSettings(selected).catch(() => {})
 setAllDone(true)
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [installed, selected])

 const setPresetChoice = (p: Preset) => {
 setPreset(p)
 if (p === 'recommended') setSelected(PRESETS.recommended)
 else if (p === 'multimodal') setSelected(PRESETS.multimodal)
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

 const saveModelSettings = async (models: string[]) => {
 const save = (key: string, value: string) =>
 fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })

 if (models.length === 1) {
 const caps = getModelCapsClient(models[0])
 await save('ollama_model', models[0])
 await save('model_setup_mode', caps.vision ? 'all-in-one' : 'text-vision')
 } else {
 // Multiple models: assign text model vs vision model by capability
 const visionModel = models.find(id => getModelCapsClient(id).vision)
 const textModel = models.find(id => !getModelCapsClient(id).vision) ?? models[0]
 await save('ollama_model', textModel)
 if (visionModel && visionModel !== textModel) await save('ollama_vision_model', visionModel)
 await save('model_setup_mode', visionModel ? 'text-vision' : 'text-vision')
 }
 }

 const startDownloads = async () => {
 setRunning(true)
 const toDownload = selected.filter(id => !isModelInstalled(installed, id))
 setStatuses(prev => {
 const next = { ...prev }
 for (const id of toDownload) next[id] = { state: 'pending', progress: 0 }
 for (const id of selected.filter(id => isModelInstalled(installed, id))) next[id] = { state: 'done', progress: 100 }
 return next
 })

 for (const modelId of toDownload) {
 await pullModel(modelId)
 }

 // Persist the user's model selection to settings
 await saveModelSettings(selected)

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
 .filter(id => !isModelInstalled(installed, id))
 .reduce((sum, id) => {
 const s = modelById(id).size.replace(' GB', '')
 return sum + parseFloat(s)
 }, 0)

 if (ollamaOk === null) {
 return (
 <div className="flex flex-col items-center justify-center py-16 gap-3">
 <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
 <p className="text-sm text-[var(--text-muted)]">Checking Ollama…</p>
 </div>
 )
 }

 if (!ollamaOk) {
 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-xl font-semibold text-[var(--text-bright)] mb-1">AI models</h2>
 <p className="text-sm text-[var(--text-muted)]">
 Ollama isn't running. Local AI models require Ollama to be installed and running on your machine.
 </p>
 </div>
 <div className="p-4 bg-[var(--amber-dim)]/40 border border-[var(--amber)] rounded-xl text-sm text-amber-800">
 Start Ollama, then come back to this step — or skip and configure AI later in Settings.
 </div>
 <div className="flex gap-3">
 <button onClick={onBack} className="flex-1 py-3 bg-[var(--surface-2)] text-[var(--text-body)] text-sm font-medium rounded-xl hover:bg-[var(--surface-3)] transition-colors">
 ← Back
 </button>
 <button onClick={onSkip} className="flex-[3] py-3 bg-[var(--ink)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-colors">
 Skip — configure AI later →
 </button>
 </div>
 </div>
 )
 }

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-xl font-semibold text-[var(--text-bright)] mb-1">AI models</h2>
 <p className="text-sm text-[var(--text-muted)]">
 Choose which local models to install. These run entirely on your machine — no data leaves your device.
 </p>
 </div>

 {/* Preset picker */}
 {!running && !allDone && (
 <div className="grid grid-cols-2 gap-2">
 {([
 { id: 'recommended', label: 'Recommended', sub: 'Text + vision · 7 GB' },
 { id: 'multimodal', label: 'All-in-one', sub: 'Text + vision + audio · 7.2 GB' },
 { id: 'textonly', label: 'Text only', sub: 'Lightest · 2.5 GB' },
 { id: 'custom', label: 'Custom', sub: 'Pick your own' },
 ] as { id: Preset; label: string; sub: string }[]).map(p => (
 <button
 key={p.id}
 onClick={() => setPresetChoice(p.id)}
 className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors text-left ${
 preset === p.id
 ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
 : 'bg-[var(--surface)] text-[var(--text-body)] border-[var(--border)] hover:border-[var(--border-mid)]'
 }`}
 >
 {p.label}
 <div className={`text-[10px] mt-0.5 font-normal ${preset === p.id ? 'text-[var(--border)]' : 'text-[var(--text-muted)]'}`}>
 {p.sub}
 </div>
 </button>
 ))}
 </div>
 )}

 {/* Custom model picker */}
 {!running && !allDone && preset === 'custom' && (
 <div className="border border-[var(--border)] rounded-xl overflow-hidden">
 <button
 onClick={() => setShowCustomPicker(v => !v)}
 className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-[var(--text-body)] bg-[var(--surface-2)] hover:bg-[var(--surface-2)] transition-colors"
 >
 <span>{selected.length} model{selected.length !== 1 ? 's' : ''} selected</span>
 {showCustomPicker ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
 </button>
 {showCustomPicker && (
 <div className="divide-y divide-[var(--border)]">
 {ALL_MODELS.filter(m => !m.id.includes(':') || m.id === 'qwen3:4b' || m.id === 'llama3.2:3b').map(m => (
 <label key={m.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-2)]/50 transition-colors">
 <input
 type="checkbox"
 checked={selected.includes(m.id)}
 onChange={() => toggleCustomModel(m.id)}
 className="rounded border-[var(--border-mid)]"
 />
 <div className="flex-1 min-w-0">
 <p className="text-xs font-medium text-[var(--text-bright)]">{m.label}</p>
 <p className="text-[11px] text-[var(--text-muted)]">{m.role}</p>
 </div>
 <span className={`text-[11px] shrink-0 ${installed.includes(m.id) ? 'text-[var(--green)]' : 'text-[var(--text-muted)]'}`}>
 {isModelInstalled(installed, m.id) ? 'Installed' : m.size}
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
 const isInstalled = isModelInstalled(installed, id)
 const fb = fallbackFor[id]
 const caps = getModelCapsClient(id)
 const ramWarn = systemRamGb ? modelRamWarning(id, systemRamGb) : null

 return (
 <div key={id} className="border border-[var(--border)] rounded-xl px-4 py-3">
 <div className="flex items-center gap-3">
 {st?.state === 'done' || (!st && isInstalled)
 ? <CheckCircle size={14} className="text-[var(--green)] shrink-0" />
 : st?.state === 'error'
 ? <AlertCircle size={14} className="text-[var(--red)] shrink-0" />
 : st?.state === 'downloading'
 ? <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
 : <Download size={14} className="text-[var(--border)] shrink-0" />
 }
 <div className="flex-1 min-w-0">
 <div className="flex items-center justify-between gap-2">
 <p className="text-xs font-medium text-[var(--text-bright)]">{m.label}</p>
 <span className={`text-[11px] shrink-0 ${
 st?.state === 'done' || (!st && isInstalled) ? 'text-[var(--green)]' :
 st?.state === 'error' ? 'text-[var(--red)]' :
 st?.state === 'downloading' ? 'text-blue-500' :
 'text-[var(--text-muted)]'
 }`}>
 {st?.state === 'done' || (!st && isInstalled) ? 'Ready' :
 st?.state === 'error' ? 'Failed' :
 st?.state === 'downloading' ? `${st.progress}%` :
 st?.state === 'pending' ? 'Queued…' :
 isInstalled ? 'Installed' : m.size}
 </span>
 </div>
 <p className="text-[11px] text-[var(--text-muted)] mb-1">{m.role}</p>
 {/* Capability badges */}
 <div className="flex items-center gap-1">
 <span title="Text" className="text-[10px] px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)] font-mono">T</span>
 {caps.vision && <span title="Vision" className="text-[10px] px-1 py-0.5 rounded bg-blue-50/50 text-blue-600 font-mono">V</span>}
 {caps.audio && <span title="Audio" className="text-[10px] px-1 py-0.5 rounded bg-purple-50/50 text-purple-600 font-mono">A</span>}
 <span className="text-[10px] text-[var(--text-muted)]">{formatContextWindow(caps.contextWindow)}</span>
 </div>
 {/* RAM warning */}
 {ramWarn && (
 <p className={`text-[11px] mt-1 ${ramWarn.level === 'error' ? 'text-[var(--red)]' : 'text-amber-500'}`}>
 ⚠ {ramWarn.message}
 </p>
 )}
 {st?.state === 'downloading' && (
 <div className="h-1 bg-[var(--surface-2)] rounded-full mt-1.5 overflow-hidden">
 <div
 className="h-full bg-blue-500 rounded-full transition-all"
 style={{ width: `${st.progress}%` }}
 />
 </div>
 )}
 {st?.state === 'error' && st.error && (
 <p className="text-[11px] text-[var(--red)] mt-0.5">{st.error}</p>
 )}
 {fb && (
 <div className="mt-1.5 flex items-center gap-1.5">
 <span className="text-[11px] text-[var(--text-muted)]">Try instead:</span>
 <button
 onClick={() => useFallback(id, fb)}
 className="text-[11px] text-[var(--blue)] hover:underline"
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
 <p className="text-xs text-[var(--text-muted)] text-center">
 ~{totalSize.toFixed(1)} GB to download
 </p>
 )}

 {/* Actions */}
 {!running && !allDone && (
 <div className="flex gap-3">
 <button onClick={onBack} className="flex-1 py-3 bg-[var(--surface-2)] text-[var(--text-body)] text-sm font-medium rounded-xl hover:bg-[var(--surface-3)] transition-colors">
 ← Back
 </button>
 {selected.length > 0 && totalSize > 0 ? (
 <button
 onClick={startDownloads}
 className="flex-[3] py-3 bg-[var(--ink)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-colors"
 >
 Download {selected.filter(id => !installed.includes(id)).length} model{selected.filter(id => !installed.includes(id)).length !== 1 ? 's' : ''} →
 </button>
 ) : (
 <button
 onClick={onNext}
 className="flex-[3] py-3 bg-[var(--ink)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-colors"
 >
 Continue →
 </button>
 )}
 </div>
 )}

 {running && (
 <div className="flex gap-3">
 <button onClick={onSkip} className="flex-1 py-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors">
 Skip remaining
 </button>
 </div>
 )}

 {allDone && (
 <div className="flex gap-3">
 <button
 onClick={onNext}
 className="w-full py-3 bg-[var(--ink)] text-white text-sm font-medium rounded-xl hover:opacity-90 transition-colors"
 >
 Continue →
 </button>
 </div>
 )}

 {/* Skip link */}
 {!running && !allDone && (
 <p className="text-center">
 <button onClick={onSkip} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-subtle)] transition-colors">
 Skip — configure AI later
 </button>
 </p>
 )}
 </div>
 )
}
