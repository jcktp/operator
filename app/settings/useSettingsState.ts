'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSetMode } from '@/components/ModeContext'
import { getModeConfig, type AppMode } from '@/lib/mode'
import { getModelCapsClient } from '@/lib/model-caps-shared'
import { CLOUD_PROVIDERS, type AIProvider, type CloudProviderId, type PullState, type TestState } from './settingsTypes'

export type ModelSetupMode = 'all-in-one' | 'text-vision' | 'full-split'

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
  const [ollamaModel, setOllamaModel] = useState('phi4-mini')
  const [savedModel, setSavedModel] = useState('phi4-mini')
  const [customModel, setCustomModel] = useState('')
  const [ollamaVisionModel, setOllamaVisionModel] = useState('llava-phi3')
  const [savedVisionModel, setSavedVisionModel] = useState('llava-phi3')
  const [customVisionModel, setCustomVisionModel] = useState('')
  const [ollamaAudioModel, setOllamaAudioModel] = useState('')
  const [customAudioModel, setCustomAudioModel] = useState('')
  const [savedAudioModel, setSavedAudioModel] = useState('')
  const [modelSetupMode, setModelSetupMode] = useState<ModelSetupMode>('text-vision')
  const [ceoName, setCeoName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pull, setPull] = useState<PullState>({ active: false, status: '', progress: 0, done: false })
  const [pullingModel, setPullingModel] = useState('')
  const pullDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const [removeOllamaModels, setRemoveOllamaModels] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((data: { settings?: Record<string, string> }) => {
      const s = data.settings ?? {}
      setOllamaHost(s.ollama_host ?? 'http://localhost:11434')
      setOllamaModel(s.ollama_model ?? 'phi4-mini')
      setSavedModel(s.ollama_model ?? 'phi4-mini')
      setOllamaVisionModel(s.ollama_vision_model ?? 'llava-phi3')
      setSavedVisionModel(s.ollama_vision_model ?? 'llava-phi3')
      const savedAudio = s.ollama_audio_model ?? ''
      const knownAudioIds = ['whisper:small', 'whisper:medium', 'gemma4:e2b', 'gemma4:e4b', 'phi4-multimodal']
      if (savedAudio && !knownAudioIds.includes(savedAudio)) {
        setOllamaAudioModel(''); setCustomAudioModel(savedAudio)
      } else {
        setOllamaAudioModel(savedAudio); setCustomAudioModel('')
      }
      setSavedAudioModel(savedAudio)
      // Load saved setup mode, fall back to deriving it for backwards compat
      if (s.model_setup_mode === 'all-in-one' || s.model_setup_mode === 'text-vision' || s.model_setup_mode === 'full-split') {
        setModelSetupMode(s.model_setup_mode as ModelSetupMode)
      } else {
        const primaryCaps = getModelCapsClient(s.ollama_model ?? 'phi4-mini')
        if (primaryCaps.vision) {
          setModelSetupMode('all-in-one')
        } else if (s.ollama_audio_model) {
          setModelSetupMode('full-split')
        } else {
          setModelSetupMode('text-vision')
        }
      }
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
      if (pullDoneTimerRef.current) { clearTimeout(pullDoneTimerRef.current); pullDoneTimerRef.current = null }
      setPullingModel(model)
      setPull({ active: true, status: 'Starting…', progress: 0, done: false })
      fetch('/api/model-pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
        .then(async res => {
          if (!res.body) { reject(new Error('No stream')); return }
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let succeeded = false
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
                  succeeded = true
                  setPull(p => ({ ...p, progress: 100, status: 'Done', done: true }))
                  pullDoneTimerRef.current = setTimeout(() => {
                    pullDoneTimerRef.current = null
                    setPull(p => ({ ...p, active: false }))
                  }, 1500)
                  resolve(); return
                }
              } catch {}
            }
          }
          if (!succeeded) reject(new Error('Pull ended without confirmation from Ollama'))
        })
        .catch(reject)
    })

  const MULTIMODAL_PATTERNS = ['llava', 'minicpm-v', 'bakllava', 'moondream', 'qwen2-vl', 'qwen-vl', 'cogvlm', 'internvl', 'phi3-vision', 'phi-3-vision', 'llava-phi3', 'gemma4']
  const isMultimodalModel = (name: string) => MULTIMODAL_PATTERNS.some(p => name.toLowerCase().includes(p))

  const selectedModel = customModel.trim() || ollamaModel
  const modelChanged = aiProvider === 'ollama' && selectedModel !== savedModel
  const switchingToOllama = aiProvider === 'ollama' && savedProvider !== 'ollama'
  const needsPull = modelChanged || switchingToOllama
  // In all-in-one mode the primary model handles vision; in split modes use the dedicated vision model
  const effectiveVisionModel = modelSetupMode === 'all-in-one'
    ? selectedModel
    : (customVisionModel.trim() || ollamaVisionModel)
  const visionModelChanged = aiProvider === 'ollama' && effectiveVisionModel !== savedVisionModel

  const handleSave = async () => {
    setSaving(true)

    if (needsPull) {
      try {
        await pullModel(selectedModel)
        // Only remove previous text model when switching between Ollama models (not when switching to cloud)
        if (modelChanged && !switchingToOllama && savedModel) {
          await fetch('/api/model-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: savedModel }) }).catch(() => {})
        }
      } catch (err) {
        setPull(p => ({ ...p, active: true, error: String(err), status: 'Failed' }))
        setSaving(false); return
      }
    }

    // Pull vision model if it changed and it's a dedicated model (not the same as primary)
    if (aiProvider === 'ollama' && visionModelChanged && modelSetupMode !== 'all-in-one' && effectiveVisionModel !== selectedModel) {
      try {
        await pullModel(effectiveVisionModel)
      } catch { /* non-critical — vision model pull failed, continue */ }
    }
    // Remove old vision model if it changed and it was a dedicated model (not same as old primary)
    if (aiProvider === 'ollama' && visionModelChanged && savedVisionModel && savedVisionModel !== savedModel) {
      await fetch('/api/model-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: savedVisionModel }) }).catch(() => {})
    }

    // Pull audio model if it changed OR if it's not locally present (full-split mode only)
    // Clear audio model when not in full-split so re-deriving setup mode stays correct
    const audioModel = modelSetupMode === 'full-split' ? (customAudioModel.trim() || ollamaAudioModel.trim()) : ''
    const audioModelChanged = modelSetupMode === 'full-split' && audioModel !== savedAudioModel
    let isAudioModelLocal = false
    if (aiProvider === 'ollama' && modelSetupMode === 'full-split' && audioModel) {
      try {
        const tagsRes = await fetch(`${ollamaHost}/api/tags`)
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json() as { models?: { name: string }[] }
          const localNames = tagsData.models?.map(m => m.name) ?? []
          isAudioModelLocal = localNames.some(lm => lm.split(':')[0] === audioModel.split(':')[0])
        }
      } catch {}
    }
    if (aiProvider === 'ollama' && modelSetupMode === 'full-split' && audioModel && (audioModelChanged || !isAudioModelLocal)) {
      try {
        await pullModel(audioModel)
      } catch (err) {
        setPull(p => ({ ...p, active: true, error: String(err), status: 'Failed' }))
        setSaving(false); return
      }
    }
    // Remove old audio model if it was replaced
    if (aiProvider === 'ollama' && audioModelChanged && savedAudioModel && savedAudioModel !== audioModel) {
      await fetch('/api/model-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: savedAudioModel }) }).catch(() => {})
    }

    // If switching from Ollama to cloud and user opted to remove local models, remove them
    const switchingToCloud = savedProvider === 'ollama' && aiProvider !== 'ollama'
    if (switchingToCloud && removeOllamaModels) {
      const modelsToRemove = [...new Set([savedModel, savedVisionModel, savedAudioModel].filter(Boolean))]
      await Promise.all(
        modelsToRemove.map(m => fetch('/api/model-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) }).catch(() => {}))
      )
    }

    await Promise.all([
      saveSetting('app_mode', appMode),
      saveSetting('model_setup_mode', modelSetupMode),
      saveSetting('ollama_host', ollamaHost),
      saveSetting('ollama_model', selectedModel),
      saveSetting('ollama_vision_model', effectiveVisionModel),
      saveSetting('ollama_audio_model', audioModel),
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
    setSavedVisionModel(effectiveVisionModel)
    setSavedAudioModel(audioModel)
    setSavedProvider(aiProvider)
    setSavedMode(appMode)
    setMode(appMode)
    setRemoveOllamaModels(false)

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
    saving, saved, pull, setPull, pullingModel,
    // Ollama vision model
    ollamaVisionModel, setOllamaVisionModel,
    savedVisionModel,
    customVisionModel, setCustomVisionModel,
    // Ollama audio model
    ollamaAudioModel, setOllamaAudioModel,
    customAudioModel, setCustomAudioModel,
    savedAudioModel,
    // Computed
    selectedModel, modelChanged, switchingToOllama, needsPull,
    effectiveVisionModel, visionModelChanged,
    // Model setup mode (all-in-one / text-vision / full-split)
    modelSetupMode, setModelSetupMode,
    // Ollama → cloud model removal
    removeOllamaModels, setRemoveOllamaModels,
    // Actions
    handleSave, testProvider,
    CLOUD_PROVIDERS,
  }
}
