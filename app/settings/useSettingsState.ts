'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSetMode } from '@/components/ModeContext'
import { getModeConfig, type AppMode } from '@/lib/mode'
import { CLOUD_PROVIDERS, type AIProvider, type CloudProviderId, type PullState, type TestState } from './settingsTypes'

async function saveSetting(key: string, value: string) {
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
}

export function useSettingsState() {
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
  const [appMode, setAppMode] = useState<AppMode>('executive')
  const [savedMode, setSavedMode] = useState<AppMode>('executive')
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [backupPath, setBackupPath] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [customAreas, setCustomAreas] = useState<string[]>([])
  const [areasCustomized, setAreasCustomized] = useState(false)
  const [newArea, setNewArea] = useState('')
  const [autoLockMinutes, setAutoLockMinutes] = useState(0)
  const [airGapMode, setAirGapMode] = useState(false)

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

  return {
    // Load state
    loading,
    // Profile
    ceoName, setCeoName,
    companyName, setCompanyName,
    userRole, setUserRole,
    // Mode
    appMode, setAppMode,
    savedMode,
    // Sound
    soundEnabled, setSoundEnabled,
    // Areas
    customAreas, setCustomAreas,
    areasCustomized, setAreasCustomized,
    newArea, setNewArea,
    // Security
    autoLockMinutes, setAutoLockMinutes,
    airGapMode, setAirGapMode,
    // AI / Ollama
    ollamaHost, setOllamaHost,
    ollamaModel, setOllamaModel,
    customModel, setCustomModel,
    savedModel,
    webAccess, setWebAccess,
    aiProvider, setAiProvider,
    savedProvider,
    // Cloud providers
    apiKeys, setApiKeys,
    testState, testError,
    availableModels,
    selectedModels, setSelectedModels,
    // Social
    bskyIdentifier, setBskyIdentifier,
    bskyAppPassword, setBskyAppPassword,
    mastodonToken, setMastodonToken,
    // Backup
    lastBackup, setLastBackup,
    backupPath,
    // Save state
    saving, saved, pull, setPull,
    // Computed
    selectedModel, modelChanged, switchingToOllama, needsPull,
    // Actions
    handleSave, testProvider,
    CLOUD_PROVIDERS,
  }
}
