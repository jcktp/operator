'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSetMode } from '@/components/ModeContext'
import { CheckCircle, Loader2, Download, Server, Trash2, AlertTriangle, Globe, Copy, Check, Database, FolderOpen, Upload as UploadIcon, RotateCcw, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CLOUD_PROVIDERS, type AIProvider, type CloudProviderId, type PullState, type TestState } from './settingsTypes'
import ModelPullOverlay from './ModelPullOverlay'
import OllamaConfig from './OllamaConfig'
import CloudProviderConfig from './CloudProviderConfig'
import { ProviderLogo } from './ProviderLogo'
import { MODE_LIST, getModeConfig, type AppMode } from '@/lib/mode'

async function saveSetting(key: string, value: string) {
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
}

export default function SettingsPage() {
  const router = useRouter()
  const setMode = useSetMode()
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
  // Mode
  const [appMode, setAppMode] = useState<AppMode>('executive')
  const [savedMode, setSavedMode] = useState<AppMode>('executive')
  // Backup
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [backupPath, setBackupPath] = useState('')
  const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [backupError, setBackupError] = useState('')
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [restoreConfirming, setRestoreConfirming] = useState(false)
  // Sound
  const [soundEnabled, setSoundEnabled] = useState(true)
  // Custom areas
  const [customAreas, setCustomAreas] = useState<string[]>([])
  const [newArea, setNewArea] = useState('')
  // Tabs
  type Tab = 'profile' | 'ai' | 'remote' | 'backup' | 'danger'
  const [tab, setTab] = useState<Tab>('profile')

  useEffect(() => {
    if (window.location.hash === '#danger') setTab('danger')
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
      setWebAccess(s.ollama_web_access === 'true')
      setSavedProvider(provider)
      const mode = (s.app_mode ?? 'executive') as AppMode
      setAppMode(mode)
      setSavedMode(mode)
      setLastBackup(s.last_backup ?? null)
      setBackupPath(s.backup_path ?? '')
      const sound = s.sound_enabled !== 'false'
      setSoundEnabled(sound)
      localStorage.setItem('sound_enabled', sound ? 'true' : 'false')
      setApiKeys({ anthropic: s.anthropic_key ?? '', openai: s.openai_key ?? '', groq: s.groq_key ?? '', google: s.google_key ?? '', xai: s.xai_key ?? '', perplexity: s.perplexity_key ?? '' })
      setSelectedModels({ anthropic: s.anthropic_model ?? '', openai: s.openai_model ?? '', groq: s.groq_model ?? '', google: s.google_model ?? '', xai: s.xai_model ?? '', perplexity: s.perplexity_model ?? '' })
      const savedAreas = s.custom_areas ? JSON.parse(s.custom_areas) as string[] : null
      setCustomAreas(savedAreas ?? getModeConfig(s.app_mode ?? 'executive').defaultAreas)
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
  const switchingToOllama = aiProvider === 'ollama' && savedProvider !== 'ollama'
  const needsPull = modelChanged || switchingToOllama

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    if (needsPull) {
      try {
        await pullModel(selectedModel)
        if (modelChanged && savedModel) await fetch('/api/model-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: savedModel }) }).catch(() => {})
      } catch (err) {
        setPull(p => ({ ...p, active: true, error: String(err), status: 'Failed' }))
        setSaving(false); return
      }
    }

    if (aiProvider !== 'ollama' && savedProvider === 'ollama' && savedModel) {
      await fetch('/api/model-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: savedModel }) }).catch(() => {})
    }

    await Promise.all([
      saveSetting('app_mode', appMode),
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
      saveSetting('sound_enabled', soundEnabled ? 'true' : 'false'),
      saveSetting('custom_areas', JSON.stringify(customAreas)),
    ])
    localStorage.setItem('sound_enabled', soundEnabled ? 'true' : 'false')

    setSavedModel(selectedModel)
    setSavedProvider(aiProvider)
    setSavedMode(appMode)
    setMode(appMode)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-gray-400" /></div>

  const TABS: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'ai', label: 'AI' },
    { id: 'remote', label: 'Remote' },
    { id: 'backup', label: 'Backup' },
    { id: 'danger', label: 'Danger' },
  ]

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

      {/* Tab bar */}
      <div className="flex gap-5 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'pb-2 text-xs font-medium transition-colors border-b-2 -mb-px',
              tab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Profile tab */}
        {tab === 'profile' && (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Your name</label>
                  <input type="text" value={ceoName} onChange={e => setCeoName(e.target.value)} placeholder="Alex Chen"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Company</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme Corp"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Your role</label>
                <input type="text" value={userRole} onChange={e => setUserRole(e.target.value)} placeholder="e.g. CEO, Head of Product, COO"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">App Mode</h2>
                {appMode !== savedMode && <span className="text-xs text-amber-600">Unsaved</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MODE_LIST.map(m => (
                  <button key={m.id} type="button" onClick={() => setAppMode(m.id)}
                    className={cn('text-left px-3 py-2.5 rounded-lg border-2 transition-all',
                      appMode === m.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
                    )}>
                    <span className="text-base">{m.icon}</span>
                    <div className="text-xs font-semibold mt-1">{m.label}</div>
                    {savedMode === m.id && appMode !== m.id && <div className="text-[10px] text-blue-400 mt-0.5">current</div>}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Sound effects</p>
                  <p className="text-xs text-gray-400 mt-0.5">Walkie-talkie chirp on startup and shutdown</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(v => !v)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                    soundEnabled ? 'bg-gray-900' : 'bg-gray-200'
                  )}
                >
                  <span className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                    soundEnabled ? 'translate-x-4' : 'translate-x-0'
                  )} />
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Business areas</h2>
              <p className="text-xs text-gray-400">These areas appear when uploading reports and creating request links. Defaults are set by your app mode.</p>
              <div className="flex flex-wrap gap-2">
                {customAreas.map(area => (
                  <span key={area} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-md">
                    {area}
                    <button type="button" onClick={() => setCustomAreas(a => a.filter(x => x !== area))}
                      className="text-gray-400 hover:text-gray-700 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newArea}
                  onChange={e => setNewArea(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const v = newArea.trim()
                      if (v && !customAreas.includes(v)) { setCustomAreas(a => [...a, v]); setNewArea('') }
                    }
                  }}
                  placeholder="Add area…"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = newArea.trim()
                    if (v && !customAreas.includes(v)) { setCustomAreas(a => [...a, v]); setNewArea('') }
                  }}
                  className="px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </>
        )}

        {/* AI tab */}
        {tab === 'ai' && (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">AI Provider</h2>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAiProvider('ollama')}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left',
                    aiProvider === 'ollama' ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
                  <Server size={13} className="shrink-0" />
                  <span>Local (Ollama)</span>
                  {savedProvider === 'ollama' && <span className="ml-auto text-xs text-blue-600 font-medium">active</span>}
                </button>
                {CLOUD_PROVIDERS.map(p => (
                  <button key={p.id} type="button" onClick={() => setAiProvider(p.id)}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left',
                      aiProvider === p.id ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-300')}>
                    <ProviderLogo id={p.id} size={13} />
                    <span>{p.label}</span>
                    {savedProvider === p.id && <span className="ml-auto text-xs text-blue-600 font-medium">active</span>}
                  </button>
                ))}
              </div>
            </div>
            {aiProvider === 'ollama' && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <OllamaConfig
                  ollamaHost={ollamaHost} setOllamaHost={setOllamaHost}
                  ollamaModel={ollamaModel} setOllamaModel={setOllamaModel}
                  customModel={customModel} setCustomModel={setCustomModel}
                  savedModel={savedModel} savedProvider={savedProvider}
                  modelChanged={modelChanged} selectedModel={selectedModel}
                  switchingToOllama={switchingToOllama}
                  webAccess={webAccess} setWebAccess={setWebAccess}
                />
              </div>
            )}
            {CLOUD_PROVIDERS.map(p => aiProvider === p.id && (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <CloudProviderConfig
                  activeProvider={p.id}
                  savedProvider={savedProvider}
                  savedModel={savedModel}
                  apiKeys={apiKeys} setApiKeys={setApiKeys}
                  testState={testState} testError={testError}
                  availableModels={availableModels}
                  selectedModels={selectedModels} setSelectedModels={setSelectedModels}
                  onTest={testProvider}
                />
              </div>
            ))}
          </>
        )}

        {(tab === 'profile' || tab === 'ai') && (
          <button type="submit" disabled={saving}
            className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> {needsPull ? 'Pulling model…' : 'Saving…'}</>
              : saved ? <><CheckCircle size={14} /> Saved</>
              : switchingToOllama ? <><Download size={14} /> Save & pull local model</>
              : modelChanged ? <><Download size={14} /> Save & switch model</>
              : 'Save settings'}
          </button>
        )}
      </form>

      {/* Remote tab */}
      {tab === 'remote' && <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
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
      </div>}

      {/* Backup tab */}
      {tab === 'backup' && <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Backup & Export</h2>
          <p className="text-xs text-gray-500 mt-0.5">Download a copy of your data or restore from a previous backup.</p>
        </div>

        {/* Last backup */}
        {lastBackup && (
          <p className="text-xs text-gray-400">
            Last backup: {new Date(lastBackup).toLocaleString()}
          </p>
        )}

        {/* Download buttons */}
        <div className="flex gap-2">
          <a
            href="/api/backup/export"
            download
            onClick={() => setLastBackup(new Date().toISOString())}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} /> Export JSON
          </a>
          <a
            href="/api/backup/export-db"
            download
            onClick={() => setLastBackup(new Date().toISOString())}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Database size={13} /> Export DB
          </a>
        </div>
        <p className="text-[11px] text-gray-400">JSON export includes all records. DB export is the raw SQLite file that can restore everything.</p>

        {/* Auto-backup to folder */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">Auto-backup folder</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={backupPath}
              onChange={e => setBackupPath(e.target.value)}
              placeholder="/Volumes/MyDrive/Backups"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="button"
              disabled={!backupPath.trim() || backupStatus === 'running'}
              onClick={async () => {
                setBackupStatus('running')
                setBackupError('')
                try {
                  const res = await fetch('/api/backup/path', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: backupPath }),
                  })
                  const d = await res.json() as { ok?: boolean; error?: string }
                  if (d.ok) {
                    setBackupStatus('done')
                    setLastBackup(new Date().toISOString())
                    setTimeout(() => setBackupStatus('idle'), 3000)
                  } else {
                    setBackupStatus('error')
                    setBackupError(d.error ?? 'Backup failed')
                  }
                } catch (e) {
                  setBackupStatus('error')
                  setBackupError(String(e))
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {backupStatus === 'running' ? <Loader2 size={13} className="animate-spin" /> : backupStatus === 'done' ? <CheckCircle size={13} className="text-green-500" /> : <FolderOpen size={13} />}
              {backupStatus === 'running' ? 'Backing up…' : backupStatus === 'done' ? 'Done' : 'Back up now'}
            </button>
          </div>
          {backupStatus === 'error' && <p className="text-xs text-red-600">{backupError}</p>}
          <p className="text-[11px] text-gray-400">Copies the database and all uploaded files to this path. Useful for external drives.</p>
        </div>

        {/* Restore */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <label className="block text-xs font-medium text-gray-600 pt-2">Restore from backup</label>
          <p className="text-[11px] text-gray-400">Upload a <code className="font-mono">.db</code> file to restore all data. Current data will be overwritten.</p>
          <input
            type="file"
            accept=".db"
            onChange={e => { setRestoreFile(e.target.files?.[0] ?? null); setRestoreConfirming(false); setRestoreStatus('idle') }}
            className="block text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-xs file:font-medium file:text-gray-700 file:bg-white hover:file:bg-gray-50 file:cursor-pointer"
          />
          {restoreFile && !restoreConfirming && restoreStatus === 'idle' && (
            <button
              type="button"
              onClick={() => setRestoreConfirming(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              <RotateCcw size={13} /> Restore {restoreFile.name}
            </button>
          )}
          {restoreConfirming && restoreStatus === 'idle' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">This will <strong>overwrite all current data</strong>. The page will reload after restore. This cannot be undone unless you have a separate backup.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRestoreConfirming(false)}
                  className="flex-1 border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!restoreFile) return
                    setRestoreStatus('running')
                    setRestoreConfirming(false)
                    try {
                      const form = new FormData()
                      form.append('file', restoreFile)
                      const res = await fetch('/api/backup/restore', { method: 'POST', body: form })
                      const d = await res.json() as { ok?: boolean; reload?: boolean; error?: string }
                      if (d.ok) {
                        setRestoreStatus('done')
                        if (d.reload) setTimeout(() => window.location.reload(), 1200)
                      } else {
                        setRestoreStatus('error')
                        setBackupError(d.error ?? 'Restore failed')
                      }
                    } catch (e) {
                      setRestoreStatus('error')
                      setBackupError(String(e))
                    }
                  }}
                  className="flex-1 bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={12} /> Yes, restore
                </button>
              </div>
            </div>
          )}
          {restoreStatus === 'running' && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={13} className="animate-spin" /> Restoring…
            </div>
          )}
          {restoreStatus === 'done' && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle size={13} /> Restored — reloading…
            </div>
          )}
          {restoreStatus === 'error' && (
            <p className="text-xs text-red-600">{backupError}</p>
          )}
        </div>
      </div>}

      {/* Danger tab */}
      {tab === 'danger' && <div className="space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">About Operator</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            Operator is fully local. Reports are saved to <code className="font-mono">~/Documents/Operator Reports/</code>.
            {savedProvider === 'ollama'
              ? ' All analysis runs via Ollama on your machine — no data is sent externally.'
              : ` Analysis is sent to ${CLOUD_PROVIDERS.find(p => p.id === savedProvider)?.label ?? savedProvider} via their API.`}
          </p>
        </div>

        <div ref={dangerRef} id="danger" className="bg-white border border-red-100 rounded-xl p-5">
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
      </div>}

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
