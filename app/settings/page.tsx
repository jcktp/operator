'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, Loader2, Download, Server, Trash2, AlertTriangle, Globe, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CLOUD_PROVIDERS, type AIProvider, type CloudProviderId, type PullState, type TestState } from './settingsTypes'
import ModelPullOverlay from './ModelPullOverlay'
import OllamaConfig from './OllamaConfig'
import CloudProviderConfig from './CloudProviderConfig'
import { ProviderLogo } from './ProviderLogo'

async function saveSetting(key: string, value: string) {
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
}

export default function SettingsPage() {
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2:3b')
  const [savedModel, setSavedModel] = useState('llama3.2:3b')
  const [customModel, setCustomModel] = useState('')
  const [ceoName, setCeoName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pull, setPull] = useState<PullState>({ active: false, status: '', progress: 0, done: false })

  const [webAccess, setWebAccess] = useState(true)
  const [uninstallPhase, setUninstallPhase] = useState<'idle' | 'confirming' | 'running' | 'done'>('idle')
  const dangerRef = useRef<HTMLDivElement>(null)
  const [aiProvider, setAiProvider] = useState<AIProvider>('ollama')
  const [savedProvider, setSavedProvider] = useState<AIProvider>('ollama')
  const [apiKeys, setApiKeys] = useState<Record<CloudProviderId, string>>({ anthropic: '', openai: '', groq: '', google: '', xai: '', perplexity: '' })
  const [testState, setTestState] = useState<Record<CloudProviderId, TestState>>({ anthropic: 'idle', openai: 'idle', groq: 'idle', google: 'idle', xai: 'idle', perplexity: 'idle' })
  const [testError, setTestError] = useState<Record<CloudProviderId, string>>({ anthropic: '', openai: '', groq: '', google: '', xai: '', perplexity: '' })
  const [availableModels, setAvailableModels] = useState<Record<CloudProviderId, string[]>>({ anthropic: [], openai: [], groq: [], google: [], xai: [], perplexity: [] })
  const [selectedModels, setSelectedModels] = useState<Record<CloudProviderId, string>>({ anthropic: '', openai: '', groq: '', google: '', xai: '', perplexity: '' })
  const [tunnelRunning, setTunnelRunning] = useState(false)
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null)
  const [tunnelInstalled, setTunnelInstalled] = useState(true)
  const [tunnelStarting, setTunnelStarting] = useState(false)
  const [tunnelCopied, setTunnelCopied] = useState(false)

  useEffect(() => {
    if (window.location.hash === '#danger') {
      setTimeout(() => dangerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
    }
  }, [])

  useEffect(() => {
    const fetchTunnel = () =>
      fetch('/api/tunnel').then(r => r.json()).then((d: { running: boolean; url: string | null; installed: boolean }) => {
        setTunnelRunning(d.running)
        setTunnelUrl(d.url)
        setTunnelInstalled(d.installed)
      }).catch(() => {})
    fetchTunnel()
  }, [])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((data: { settings?: Record<string, string> }) => {
      const s = data.settings ?? {}
      setOllamaHost(s.ollama_host ?? 'http://localhost:11434')
      setOllamaModel(s.ollama_model ?? 'llama3.2:3b')
      setSavedModel(s.ollama_model ?? 'llama3.2:3b')
      setCeoName(s.ceo_name ?? '')
      setCompanyName(s.company_name ?? '')
      setUserRole(s.user_role ?? '')
      const provider = (s.ai_provider ?? 'ollama') as AIProvider
      setAiProvider(provider)
      setWebAccess(s.ollama_web_access !== 'false')
      setSavedProvider(provider)
      setApiKeys({ anthropic: s.anthropic_key ?? '', openai: s.openai_key ?? '', groq: s.groq_key ?? '', google: s.google_key ?? '', xai: s.xai_key ?? '', perplexity: s.perplexity_key ?? '' })
      setSelectedModels({ anthropic: s.anthropic_model ?? '', openai: s.openai_model ?? '', groq: s.groq_model ?? '', google: s.google_model ?? '', xai: s.xai_model ?? '', perplexity: s.perplexity_model ?? '' })
      setLoading(false)
    })
  }, [])

  const testProvider = async (provider: CloudProviderId) => {
    const key = apiKeys[provider]
    if (!key.trim()) return
    setTestState(s => ({ ...s, [provider]: 'testing' }))
    setTestError(s => ({ ...s, [provider]: '' }))
    try {
      const res = await fetch('/api/ai-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key }) })
      const data = await res.json() as { models?: string[]; defaultModel?: string; error?: string }
      if (res.ok) {
        setTestState(s => ({ ...s, [provider]: 'ok' }))
        setAvailableModels(m => ({ ...m, [provider]: data.models ?? [] }))
        if (data.defaultModel && !selectedModels[provider]) setSelectedModels(m => ({ ...m, [provider]: data.defaultModel! }))
        setAiProvider(provider)
      } else {
        setTestState(s => ({ ...s, [provider]: 'error' }))
        setTestError(s => ({ ...s, [provider]: data.error ?? 'Connection failed' }))
      }
    } catch (e) {
      setTestState(s => ({ ...s, [provider]: 'error' }))
      setTestError(s => ({ ...s, [provider]: String(e) }))
    }
  }

  const pullModel = (model: string): Promise<void> =>
    new Promise((resolve, reject) => {
      setPull({ active: true, status: 'Starting…', progress: 0, done: false })
      fetch('/api/model-pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
        .then(async res => {
          if (!res.body) { reject(new Error('No stream')); return }
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            for (const line of decoder.decode(value, { stream: true }).split('\n')) {
              if (!line.startsWith('data: ')) continue
              try {
                const data = JSON.parse(line.slice(6)) as { error?: string; status?: string; progress?: number }
                if (data.error) { reject(new Error(data.error)); return }
                setPull(p => ({ ...p, status: data.status ?? p.status, progress: data.progress ?? p.progress }))
                if (data.progress === 100 || data.status === 'success') {
                  setPull(p => ({ ...p, progress: 100, status: 'Done', done: true }))
                  setTimeout(() => setPull(p => ({ ...p, active: false })), 1500)
                  resolve(); return
                }
              } catch {}
            }
          }
          resolve()
        })
        .catch(reject)
    })

  const selectedModel = customModel.trim() || ollamaModel
  const modelChanged = aiProvider === 'ollama' && selectedModel !== savedModel

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    if (modelChanged) {
      try {
        await pullModel(selectedModel)
        if (savedModel) await fetch('/api/model-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: savedModel }) }).catch(() => {})
      } catch (err) {
        setPull(p => ({ ...p, active: true, error: String(err), status: 'Failed' }))
        setSaving(false); return
      }
    }

    if (aiProvider !== 'ollama' && savedProvider === 'ollama' && savedModel) {
      await fetch('/api/model-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: savedModel }) }).catch(() => {})
    }

    await Promise.all([
      saveSetting('ollama_host', ollamaHost),
      saveSetting('ollama_model', selectedModel),
      saveSetting('ollama_web_access', webAccess ? 'true' : 'false'),
      saveSetting('ceo_name', ceoName),
      saveSetting('company_name', companyName),
      saveSetting('user_role', userRole),
      saveSetting('ai_provider', aiProvider),
      saveSetting('anthropic_key', apiKeys.anthropic),
      saveSetting('openai_key', apiKeys.openai),
      saveSetting('groq_key', apiKeys.groq),
      saveSetting('google_key', apiKeys.google),
      saveSetting('xai_key', apiKeys.xai),
      saveSetting('perplexity_key', apiKeys.perplexity),
      saveSetting('anthropic_model', selectedModels.anthropic),
      saveSetting('openai_model', selectedModels.openai),
      saveSetting('groq_model', selectedModels.groq),
      saveSetting('google_model', selectedModels.google),
      saveSetting('xai_model', selectedModels.xai),
      saveSetting('perplexity_model', selectedModels.perplexity),
    ])

    setSavedModel(selectedModel)
    setSavedProvider(aiProvider)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-lg space-y-6">
      {pull.active && (
        <ModelPullOverlay
          pull={pull}
          selectedModel={selectedModel}
          onClose={() => setPull(p => ({ ...p, active: false }))}
        />
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Your role</label>
            <input type="text" value={userRole} onChange={e => setUserRole(e.target.value)} placeholder="e.g. CEO, Head of Product, COO"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            <p className="text-[11px] text-gray-400 mt-1">AI personas will tailor their tone and focus to your role.</p>
          </div>
        </div>

        {/* AI Provider */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Provider</h2>
            <p className="text-xs text-gray-500 mt-0.5">Local keeps data on your machine. Cloud providers offer better quality with your own API key.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAiProvider('ollama')}
              className={cn('flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left',
                aiProvider === 'ollama' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
              <Server size={14} className="shrink-0" />
              <span>Local (Ollama)</span>
              {savedProvider === 'ollama' && <span className="ml-auto text-xs text-blue-600 font-medium">active</span>}
            </button>
            {CLOUD_PROVIDERS.map(p => (
              <button key={p.id} type="button" onClick={() => setAiProvider(p.id)}
                className={cn('flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left',
                  aiProvider === p.id ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
                <ProviderLogo id={p.id} size={14} />
                <span>{p.label}</span>
                {savedProvider === p.id && <span className="ml-auto text-xs text-blue-600 font-medium">active</span>}
              </button>
            ))}
          </div>

          {aiProvider === 'ollama' && (
            <OllamaConfig
              ollamaHost={ollamaHost} setOllamaHost={setOllamaHost}
              ollamaModel={ollamaModel} setOllamaModel={setOllamaModel}
              customModel={customModel} setCustomModel={setCustomModel}
              savedModel={savedModel} savedProvider={savedProvider}
              modelChanged={modelChanged} selectedModel={selectedModel}
              webAccess={webAccess} setWebAccess={setWebAccess}
            />
          )}

          {CLOUD_PROVIDERS.map(p => aiProvider === p.id && (
            <CloudProviderConfig
              key={p.id}
              activeProvider={p.id}
              savedProvider={savedProvider}
              savedModel={savedModel}
              apiKeys={apiKeys} setApiKeys={setApiKeys}
              testState={testState} testError={testError}
              availableModels={availableModels}
              selectedModels={selectedModels} setSelectedModels={setSelectedModels}
              onTest={testProvider}
            />
          ))}
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {saving
            ? <><Loader2 size={14} className="animate-spin" /> {modelChanged ? 'Pulling model…' : 'Saving…'}</>
            : saved ? <><CheckCircle size={14} /> Saved</>
            : modelChanged ? <><Download size={14} /> Save & switch model</>
            : 'Save settings'}
        </button>
      </form>

      {/* Remote Submissions */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Remote Submissions</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Allow direct reports to submit reports via a secure public link, without installing Operator.
          </p>
        </div>

        {!tunnelInstalled ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1.5">
            <p className="font-medium">cloudflared not installed</p>
            <p>Remote submissions require Cloudflare Tunnel. Install it with:</p>
            <code className="block bg-amber-100 rounded px-2 py-1 font-mono text-amber-800">brew install cloudflared</code>
            <p className="text-amber-600">Then reload this page.</p>
          </div>
        ) : tunnelRunning && tunnelUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <span className="text-xs text-green-700 font-medium">Tunnel active</span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <Globe size={12} className="text-gray-400 shrink-0" />
              <span className="text-xs text-gray-700 font-mono truncate flex-1">{tunnelUrl}</span>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(tunnelUrl!); setTunnelCopied(true); setTimeout(() => setTunnelCopied(false), 2000) }}
                className="shrink-0 text-gray-400 hover:text-gray-600"
              >
                {tunnelCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">Report request links will use this URL while the tunnel is active. The URL changes each session.</p>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) })
                setTunnelRunning(false); setTunnelUrl(null)
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Disable tunnel
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
              <span className="text-xs text-gray-500">Inactive — links only work on this machine</span>
            </div>
            <button
              type="button"
              disabled={tunnelStarting}
              onClick={async () => {
                setTunnelStarting(true)
                try {
                  const res = await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) })
                  const d = await res.json() as { running: boolean; url: string | null; error?: string }
                  if (d.running && d.url) { setTunnelRunning(true); setTunnelUrl(d.url) }
                } finally {
                  setTunnelStarting(false)
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {tunnelStarting ? <><Loader2 size={13} className="animate-spin" /> Starting tunnel…</> : <><Globe size={13} /> Enable remote access</>}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">About Operator</h2>
        <p className="text-xs text-gray-400 leading-relaxed">
          Operator is fully local. Reports are saved to <code className="font-mono">~/Documents/Operator Reports/</code>.
          {savedProvider === 'ollama'
            ? ' All analysis runs via Ollama on your machine — no data is sent externally.'
            : ` Analysis is sent to ${CLOUD_PROVIDERS.find(p => p.id === savedProvider)?.label ?? savedProvider} via their API.`}
        </p>
      </div>

      {/* Danger zone */}
      <div ref={dangerRef} id="danger" className="border-t border-red-100 pt-6">
        <h2 className="text-sm font-semibold text-red-600 mb-1">Danger zone</h2>
        <p className="text-xs text-gray-400 mb-4">Irreversible actions. Proceed with caution.</p>

        {uninstallPhase === 'idle' && (
          <button
            type="button"
            onClick={() => setUninstallPhase('confirming')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Uninstall Operator
          </button>
        )}

        {uninstallPhase === 'confirming' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">This cannot be undone</p>
                <p className="text-xs text-red-600 mt-1 leading-relaxed">
                  This will permanently delete:
                </p>
                <ul className="text-xs text-red-600 mt-1 space-y-0.5 list-disc list-inside">
                  <li>All your reports and analysis data</li>
                  <li>The local Ollama AI model pulled for this app</li>
                  <li>The entire Operator application folder</li>
                </ul>
                <p className="text-xs text-red-500 mt-2">
                  Ollama itself will <strong>not</strong> be uninstalled. Only the model this app downloaded will be removed.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setUninstallPhase('idle')}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setUninstallPhase('running')
                  try { await fetch('/api/uninstall', { method: 'POST' }) } catch {}
                  setUninstallPhase('done')
                }}
                className="flex-1 bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={13} /> Yes, delete everything
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Uninstall overlay */}
      {(uninstallPhase === 'running' || uninstallPhase === 'done') && (
        <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col items-center justify-center">
          <div className="text-center space-y-6 max-w-sm w-full px-8">
            {uninstallPhase === 'running' ? (
              <>
                <div className="w-10 h-10 mx-auto rounded-full border-2 border-red-900 border-t-red-400 animate-spin" />
                <p className="text-gray-200 text-sm font-medium">Uninstalling Operator…</p>
                <p className="text-gray-500 text-xs">Removing models and data</p>
              </>
            ) : (
              <>
                <div className="w-10 h-10 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
                  <Trash2 size={16} className="text-gray-400" />
                </div>
                <p className="text-gray-200 text-sm font-medium">Operator uninstalled</p>
                <p className="text-gray-500 text-xs leading-relaxed">
                  All data and the app folder have been deleted.<br />You can close this tab.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
