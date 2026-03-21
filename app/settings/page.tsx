'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Loader2, AlertCircle, Circle } from 'lucide-react'

const SUGGESTED_MODELS = [
  { id: 'llama3.2:3b', label: 'Llama 3.2 3B', note: 'Recommended — fast, good quality' },
  { id: 'llama3.2:1b', label: 'Llama 3.2 1B', note: 'Fastest, lighter output' },
  { id: 'qwen2.5:3b', label: 'Qwen 2.5 3B', note: 'Good at structured output' },
  { id: 'gemma2:2b', label: 'Gemma 2 2B', note: 'Small and capable' },
  { id: 'mistral:7b', label: 'Mistral 7B', note: 'Best quality, needs more RAM' },
  { id: 'phi3.5', label: 'Phi 3.5', note: 'Microsoft small model' },
]

export default function SettingsPage() {
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2:3b')
  const [customModel, setCustomModel] = useState('')
  const [ceoName, setCeoName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'ok' | 'error' | 'idle'>('idle')
  const [availableModels, setAvailableModels] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      const s = data.settings ?? {}
      setOllamaHost(s.ollama_host ?? 'http://localhost:11434')
      setOllamaModel(s.ollama_model ?? 'llama3.2:3b')
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
      if (res.ok) {
        setOllamaStatus('ok')
        setAvailableModels(data.models ?? [])
      } else {
        setOllamaStatus('error')
      }
    } catch {
      setOllamaStatus('error')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const model = customModel.trim() || ollamaModel

    await Promise.all([
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ollama_host', value: ollamaHost }) }),
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ollama_model', value: model }) }),
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'ceo_name', value: ceoName }) }),
      fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'company_name', value: companyName }) }),
    ])

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
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
              className="text-xs text-gray-400 hover:text-gray-600 underline">
              Get Ollama →
            </a>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            Operator runs analysis locally using Ollama. No data leaves your machine. Install Ollama, pull a model, and you're set.
          </p>

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
                <CheckCircle size={12} /> Connected — {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} available
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
            <label className="block text-xs font-medium text-gray-600 mb-2">Model</label>
            <div className="space-y-1.5">
              {SUGGESTED_MODELS.map(m => (
                <label key={m.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${ollamaModel === m.id && !customModel ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="mt-0.5">
                    {ollamaModel === m.id && !customModel
                      ? <div className="w-3.5 h-3.5 rounded-full bg-gray-900 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-white" /></div>
                      : <Circle size={14} className="text-gray-300" />
                    }
                  </div>
                  <input type="radio" name="model" value={m.id} checked={ollamaModel === m.id && !customModel}
                    onChange={() => { setOllamaModel(m.id); setCustomModel('') }} className="sr-only" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-900">{m.label}</span>
                      <code className="text-xs text-gray-400 font-mono">{m.id}</code>
                    </div>
                    <p className="text-xs text-gray-400">{m.note}</p>
                  </div>
                  {availableModels.some(am => am.startsWith(m.id.split(':')[0])) && (
                    <span className="shrink-0 text-xs text-green-600 font-medium">pulled</span>
                  )}
                </label>
              ))}
            </div>

            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Or enter any model name</label>
              <input type="text" value={customModel} onChange={e => setCustomModel(e.target.value)}
                placeholder="e.g. deepseek-r1:1.5b"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>

          {/* Pull command hint */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">To pull a model, run in your terminal:</p>
            <code className="text-xs font-mono text-gray-700">
              ollama pull {customModel.trim() || ollamaModel}
            </code>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" />
            : saved ? <><CheckCircle size={14} /> Saved</>
            : 'Save settings'}
        </button>
      </form>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">About Operator</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Operator is fully local — reports and analysis stay on your machine. Ollama runs the model locally, so no data is sent to any external service.
        </p>
      </div>
    </div>
  )
}
