'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSetMode } from '@/components/ModeContext'
import { CheckCircle, Loader2, Download, Server, Trash2, AlertTriangle, X, Plus } from 'lucide-react'
import AuditLogPanel from './AuditLogPanel'
import { cn } from '@/lib/utils'
import { CLOUD_PROVIDERS, type AIProvider, type CloudProviderId, type PullState, type TestState } from './settingsTypes'
import ModelPullOverlay from './ModelPullOverlay'
import OllamaConfig from './OllamaConfig'
import CloudProviderConfig from './CloudProviderConfig'
import { ProviderLogo } from './ProviderLogo'
import { MODE_LIST, getModeConfig, type AppMode } from '@/lib/mode'
import SettingsRemoteTab from './SettingsRemoteTab'
import SettingsBackupTab from './SettingsBackupTab'
import SettingsPulseTab from './SettingsPulseTab'
import SettingsKnowledgeTab from './SettingsKnowledgeTab'

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
  const [apiKeys, setApiKeys] = useState<Record<CloudProviderId, string>>({ anthropic: '', openai: '', groq: '', google: '', xai: '', perplexity: '', mistral: '' })
  const [testState, setTestState] = useState<Record<CloudProviderId, TestState>>({ anthropic: 'idle', openai: 'idle', groq: 'idle', google: 'idle', xai: 'idle', perplexity: 'idle', mistral: 'idle' })
  const [testError, setTestError] = useState<Record<CloudProviderId, string>>({ anthropic: '', openai: '', groq: '', google: '', xai: '', perplexity: '', mistral: '' })
  const [availableModels, setAvailableModels] = useState<Record<CloudProviderId, string[]>>({ anthropic: [], openai: [], groq: [], google: [], xai: [], perplexity: [], mistral: [] })
  const [selectedModels, setSelectedModels] = useState<Record<CloudProviderId, string>>({ anthropic: '', openai: '', groq: '', google: '', xai: '', perplexity: '', mistral: '' })
  const [bskyIdentifier, setBskyIdentifier] = useState('')
  const [bskyAppPassword, setBskyAppPassword] = useState('')
  const [mastodonToken, setMastodonToken] = useState('')
  // Mode
  const [appMode, setAppMode] = useState<AppMode>('executive')
  const [savedMode, setSavedMode] = useState<AppMode>('executive')
  // Backup (lastBackup and backupPath are loaded from settings, passed to SettingsBackupTab)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [backupPath, setBackupPath] = useState('')
  // Sound
  const [soundEnabled, setSoundEnabled] = useState(true)
  // Custom areas
  const [customAreas, setCustomAreas] = useState<string[]>([])
  const [areasCustomized, setAreasCustomized] = useState(false)
  const [newArea, setNewArea] = useState('')
  // Security
  const [autoLockMinutes, setAutoLockMinutes] = useState(0)
  const [airGapMode, setAirGapMode] = useState(false)
  // Tabs
  type Tab = 'profile' | 'ai' | 'pulse' | 'remote' | 'backup' | 'knowledge' | 'danger'
  const [tab, setTab] = useState<Tab>('profile')

  useEffect(() => {
    if (window.location.hash === '#danger') setTab('danger')
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
      setApiKeys({ anthropic: s.anthropic_key ?? '', openai: s.openai_key ?? '', groq: s.groq_key ?? '', google: s.google_key ?? '', xai: s.xai_key ?? '', perplexity: s.perplexity_key ?? '', mistral: s.mistral_key ?? '' })
      setBskyIdentifier(s.bluesky_identifier ?? '')
      setBskyAppPassword(s.bluesky_app_password ?? '')
      setMastodonToken(s.mastodon_access_token ?? '')
      setSelectedModels({ anthropic: s.anthropic_model ?? '', openai: s.openai_model ?? '', groq: s.groq_model ?? '', google: s.google_model ?? '', xai: s.xai_model ?? '', perplexity: s.perplexity_model ?? '', mistral: s.mistral_model ?? '' })
      const savedAreas = s.custom_areas ? JSON.parse(s.custom_areas) as string[] : null
      setCustomAreas(savedAreas ?? getModeConfig(s.app_mode ?? 'executive').defaultAreas)
      setAreasCustomized(!!s.custom_areas)
      setAutoLockMinutes(parseInt(s.auto_lock_minutes ?? '0') || 0)
      setAirGapMode(s.air_gap_mode === 'true')
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

  const handleSave = async () => {
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

    // Note: local model is intentionally kept on disk when switching to a cloud provider
    // so it's still available if the user switches back.

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
      saveSetting('mistral_key', apiKeys.mistral),
      saveSetting('anthropic_model', selectedModels.anthropic),
      saveSetting('openai_model', selectedModels.openai),
      saveSetting('groq_model', selectedModels.groq),
      saveSetting('google_model', selectedModels.google),
      saveSetting('xai_model', selectedModels.xai),
      saveSetting('perplexity_model', selectedModels.perplexity),
      saveSetting('mistral_model', selectedModels.mistral),
      saveSetting('bluesky_identifier', bskyIdentifier),
      saveSetting('bluesky_app_password', bskyAppPassword),
      saveSetting('mastodon_access_token', mastodonToken),
      saveSetting('sound_enabled', soundEnabled ? 'true' : 'false'),
      saveSetting('custom_areas', areasCustomized ? JSON.stringify(customAreas) : ''),
      saveSetting('auto_lock_minutes', String(autoLockMinutes)),
      saveSetting('air_gap_mode', airGapMode ? 'true' : 'false'),
    ])
    localStorage.setItem('sound_enabled', soundEnabled ? 'true' : 'false')

    setSavedModel(selectedModel)
    setSavedProvider(aiProvider)
    setSavedMode(appMode)
    setMode(appMode)

    // Auto-create Bluesky timeline feed if credentials are present and feed doesn't exist yet
    if (bskyIdentifier.trim() && bskyAppPassword.trim()) {
      try {
        const feedsRes = await fetch('/api/pulse')
        const feedsData = await feedsRes.json() as { feeds?: Array<{ type: string; url: string }> }
        const hasTimeline = feedsData.feeds?.some(f => f.type === 'bluesky' && f.url === 'timeline')
        if (!hasTimeline) {
          await fetch('/api/pulse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Bluesky Timeline', url: 'timeline', type: 'bluesky' }),
          })
        }
      } catch { /* non-blocking */ }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-gray-400" /></div>

  const TABS: { id: Tab; label: string }[] = [
    { id: 'profile',   label: 'Profile' },
    { id: 'ai',        label: 'AI' },
    { id: 'pulse',     label: 'Pulse' },
    { id: 'remote',    label: 'Remote' },
    { id: 'backup',    label: 'Backup' },
    { id: 'knowledge', label: 'AI Context' },
    { id: 'danger',    label: 'Danger' },
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

      <div className="space-y-5">
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
                  <button key={m.id} type="button" onClick={() => {
                    setAppMode(m.id)
                    if (!areasCustomized) setCustomAreas(getModeConfig(m.id).defaultAreas)
                  }}
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
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Areas</h2>
                {areasCustomized && (
                  <button type="button"
                    onClick={() => { setCustomAreas(getModeConfig(appMode).defaultAreas); setAreasCustomized(false) }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Reset to {getModeConfig(appMode).label} defaults
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400">Areas appear when uploading {getModeConfig(appMode).documentLabelPlural.toLowerCase()} and creating request links. Switching modes resets to that mode&apos;s defaults unless you&apos;ve customised them.</p>
              <div className="flex flex-wrap gap-2">
                {customAreas.map(area => (
                  <span key={area} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 text-xs text-gray-700 rounded-md">
                    {area}
                    <button type="button" onClick={() => { setCustomAreas(a => a.filter(x => x !== area)); setAreasCustomized(true) }}
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
                      if (v && !customAreas.includes(v)) { setCustomAreas(a => [...a, v]); setNewArea(''); setAreasCustomized(true) }
                    }
                  }}
                  placeholder="Add area…"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = newArea.trim()
                    if (v && !customAreas.includes(v)) { setCustomAreas(a => [...a, v]); setNewArea(''); setAreasCustomized(true) }
                  }}
                  className="px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Security</h2>

              {/* Auto-lock */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Auto-lock</p>
                  <p className="text-xs text-gray-400 mt-0.5">Lock after inactivity and require password</p>
                </div>
                <select
                  value={autoLockMinutes}
                  onChange={e => setAutoLockMinutes(parseInt(e.target.value))}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value={0}>Never</option>
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>

              {/* Air-gap mode */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Air-gap mode</p>
                  <p className="text-xs text-gray-400 mt-0.5">Block all outbound network calls (cloud AI, web search, feeds)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAirGapMode(v => !v)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                    airGapMode ? 'bg-red-500' : 'bg-gray-200'
                  )}
                >
                  <span className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                    airGapMode ? 'translate-x-4' : 'translate-x-0'
                  )} />
                </button>
              </div>
              {airGapMode && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  Air-gap active — only Ollama (local) analysis works. Cloud providers and Pulse feeds are disabled.
                </p>
              )}
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

        {tab === 'pulse' && (
          <SettingsPulseTab
            bskyIdentifier={bskyIdentifier} setBskyIdentifier={setBskyIdentifier}
            bskyAppPassword={bskyAppPassword} setBskyAppPassword={setBskyAppPassword}
            mastodonToken={mastodonToken} setMastodonToken={setMastodonToken}
            saving={saving} onSave={handleSave}
          />
        )}

        {(tab === 'profile' || tab === 'ai') && (
          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> {needsPull ? 'Pulling model…' : 'Saving…'}</>
              : saved ? <><CheckCircle size={14} /> Saved</>
              : switchingToOllama ? <><Download size={14} /> Save & pull local model</>
              : modelChanged ? <><Download size={14} /> Save & switch model</>
              : 'Save settings'}
          </button>
        )}
      </div>

      {/* Remote tab */}
      {tab === 'remote' && <SettingsRemoteTab />}

      {/* Backup tab */}
      {tab === 'backup' && (
        <SettingsBackupTab
          lastBackup={lastBackup}
          onBackupDone={setLastBackup}
          initialBackupPath={backupPath}
        />
      )}

      {/* AI Context (knowledge base) tab */}
      {tab === 'knowledge' && <SettingsKnowledgeTab />}

      {/* Danger tab */}
      {tab === 'danger' && <div className="space-y-5">
        <AuditLogPanel />

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
        <p className="text-xs text-gray-400 mb-4">These actions are permanent and cannot be undone.</p>

        {uninstallPhase === 'idle' && (
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Uninstall Operator</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                Permanently deletes all your reports, journal entries, contacts, Pulse feeds, settings, and AI analysis data. Also removes the local AI model downloaded by this app and the entire application folder. <strong>Nothing is recoverable after this.</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUninstallPhase('confirming')}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} /> Uninstall
            </button>
          </div>
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
