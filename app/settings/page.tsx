'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, Loader2, AlertCircle, Circle, Download, Trash2 } from 'lucide-react'

const SUGGESTED_MODELS = [
  { id: 'llama3.2:3b', label: 'Llama 3.2 3B', note: 'Recommended — fast, good quality' },
  { id: 'llama3.2:1b', label: 'Llama 3.2 1B', note: 'Fastest, lightest' },
  { id: 'qwen2.5:3b', label: 'Qwen 2.5 3B', note: 'Great at structured output' },
  { id: 'gemma2:2b', label: 'Gemma 2 2B', note: 'Small and capable' },
  { id: 'mistral:7b', label: 'Mistral 7B', note: 'Best quality, needs more RAM' },
  { id: 'phi3.5', label: 'Phi 3.5', note: 'Microsoft small model' },
]

interface PullState {
  active: boolean
  status: string
  progress: number
  error?: string
  done: boolean
}

export default function SettingsPage() {
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2:3b')
  const [savedModel, setSavedModel] = useState('llama3.2:3b')
  const [customModel, setCustomModel] = useState('')
  const [ceoName, setCeoName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'ok' | 'error' | 'idle'>('idle')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [pull, setPull] = useState<PullState>({ active: false, status: '', progress: 0, done: false })
  const pullRef = useRef<EventSource | null>(null)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      const s = data.settings ?? {}
      setOllamaHost(s.ollama_host ?? 'http://localhost:11434')
      setOllamaModel(s.ollama_model ?? 'llama3.2:3b')
      setSavedModel(s.ollama_model ?? 'llama3.2:3b')
      setCeoName(s.ceo_name ?? '')
      setCompanyName(s.company_name ?? '')
      setLoading(false)
    })
  }, [])

  const checkOllama = async () => {
    setOllamaStatus('checking')
    try {
      const res = await fetch('/api/ollama-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: ollamaHost }),
      })
      const data = await res.json()
      if (res.ok) { setOllamaStatus('ok'); setAvailableModels(data.models ?? []) }
      else setOllamaStatus('error')
    } catch { setOllamaStatus('error') }
  }

  const selectedModel = customModel.trim() || ollamaModel
  const modelChanged = selectedModel !== savedModel

  const pullModel = (model: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setPull({ active: true, status: 'Starting…', progress: 0, done: false })

      fetch('/api/model-pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      }).then(async res => {
        if (!res.body) { reject(new Error('No stream')); return }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.error) { reject(new Error(data.error)); return }
              setPull(p => ({ ...p, status: data.status ?? p.status, progress: data.progress ?? p.progress }))
              if (data.progress === 100 || data.status === 'success') {
                setPull(p => ({ ...p, progress: 100, status: 'Done', done: true }))
                setTimeout(() => setPull(p => ({ ...p, active: false })), 1500)
                resolve()
                return
              }
            } catch {}
          }
        }
        resolve()
      }).catch(reject)
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    // If model changed, pull new model first, then remove old
    if (modelChanged) {
      try {
        await pullModel(selectedModel)
        // Remove old model after successful pull
        if (savedModel) {
          await fetch('/api/model-remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: savedModel }),
          }).catch(() => {})
        }
      } catch (err) {
        setPull(p => ({ ...p, active: true, error: String(err), status: 'Failed' }))
        setSaving(false)
        return
      }
    }

    await Promise.all([
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ollama_host', value: ollamaHost }) }),
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ollama_model', value: selectedModel }) }),
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ceo_name', value: ceoName }) }),
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'company_name', value: companyName }) }),
    ])

    setSavedModel(selectedModel)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Model pull overlay */}
      {pull.active && (
        <div className="fixed inset-0 z-50 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-5">
            <div className="flex items-center gap-3">
              {pull.done
                ? <CheckCircle size={20} className="text-green-600 shrink-0" />
                : pull.error
                ? <AlertCircle size={20} className="text-red-500 shrink-0" />
                : <Download size={20} className="text-gray-600 shrink-0 animate-bounce" />
              }
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {pull.done ? 'Model ready' : pull.error ? 'Pull failed' : `Pulling ${selectedModel}`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{pull.error ?? pull.status}</p>
              </div>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gray-900 rounded-full transition-all duration-500"
                style={{ width: `${pull.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{pull.progress}%</span>
              {!pull.done && !pull.error && (
                <span>This may take a few minutes on first run</span>
              )}
              {(pull.done || pull.error) && (
                <button onClick={() => setPull(p => ({ ...p, active: false }))} className="text-gray-500 hover:text-gray-700 font-medium">
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Configure your Operator workspace.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Profile */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Your name</label>
            <input type="text" value={ceoName} onChange={e => setCeoName(e.target.value)} placeholder="Alex Chen"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Company name</label>
            <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
        </div>

        {/* Ollama config */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Ollama</h2>
            <a href="https://ollama.com" target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 underline">Get Ollama →</a>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            All analysis runs locally — no data leaves your machine.
          </p>

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

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Model
              {savedModel && <span className="ml-2 text-gray-400 font-normal">current: <code className="font-mono">{savedModel}</code></span>}
            </label>
            <div className="space-y-1.5">
              {SUGGESTED_MODELS.map(m => {
                const isPulled = availableModels.some(am => am.startsWith(m.id.split(':')[0]))
                const isSelected = ollamaModel === m.id && !customModel
                const isCurrent = m.id === savedModel
                return (
                  <label key={m.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="mt-0.5 shrink-0">
                      {isSelected
                        ? <div className="w-3.5 h-3.5 rounded-full bg-gray-900 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>
                        : <Circle size={14} className="text-gray-300" />
                      }
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

          {modelChanged && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700 flex items-start gap-2">
              <Download size={13} className="shrink-0 mt-0.5" />
              <span>
                Saving will pull <strong>{selectedModel}</strong> and remove <strong>{savedModel}</strong>.
                This may take a few minutes.
              </span>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Pull a model manually:</p>
            <code className="text-xs font-mono text-gray-700">ollama pull {selectedModel}</code>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving
            ? <><Loader2 size={14} className="animate-spin" /> {modelChanged ? 'Pulling model…' : 'Saving…'}</>
            : saved
            ? <><CheckCircle size={14} /> Saved</>
            : modelChanged
            ? <><Download size={14} /> Save & switch model</>
            : 'Save settings'
          }
        </button>
      </form>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">About Operator</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Operator is fully local. Reports are saved to <code className="font-mono">~/Documents/Operator Reports/</code>.
          All analysis runs via Ollama on your machine — no data is sent externally.
        </p>
      </div>
    </div>
  )
}
