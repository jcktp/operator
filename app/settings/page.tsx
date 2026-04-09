'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { CheckCircle, Loader2, Download, Server, Trash2, AlertTriangle, X, Plus } from 'lucide-react'
import AuditLogPanel from './AuditLogPanel'
import RecoveryCodesPanel from './RecoveryCodesPanel'
import { cn } from '@/lib/utils'
import { CLOUD_PROVIDERS } from './settingsTypes'
import ModelPullOverlay from './ModelPullOverlay'
import OllamaConfig from './OllamaConfig'
import CloudProviderConfig from './CloudProviderConfig'
import { ProviderLogo } from './ProviderLogo'
import { MODE_LIST, getModeConfig } from '@/lib/mode'
import SettingsRemoteTab from './SettingsRemoteTab'
import SettingsBackupTab from './SettingsBackupTab'
import SettingsPulseTab from './SettingsPulseTab'
import SelectField from '@/components/SelectField'
import SettingsKnowledgeTab from './SettingsKnowledgeTab'
import SettingsCollabTab from './SettingsCollabTab'
import ModeIcon from './ModeIcons'
import { useSettingsState } from './useSettingsState'

export default function SettingsPage() {
  const { theme, mode, setMode } = useTheme()
  const dangerRef = useRef<HTMLDivElement>(null)
  const [uninstallPhase, setUninstallPhase] = useState<'idle' | 'confirming' | 'running' | 'done'>('idle')

  type Tab = 'profile' | 'ai' | 'pulse' | 'remote' | 'backup' | 'knowledge' | 'collab' | 'danger'
  const [tab, setTab] = useState<Tab>('profile')

  useEffect(() => {
    if (window.location.hash === '#danger') setTab('danger')
  }, [])

  const s = useSettingsState()

  if (s.loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-gray-400 dark:text-zinc-500" /></div>

  const TABS: { id: Tab; label: string }[] = [
    { id: 'profile',   label: 'Profile' },
    { id: 'ai',        label: 'AI' },
    { id: 'pulse',     label: 'Pulse' },
    { id: 'remote',    label: 'Remote' },
    { id: 'backup',    label: 'Backup' },
    { id: 'knowledge', label: 'AI Context' },
    { id: 'collab',    label: 'Collab' },
    { id: 'danger',    label: 'Danger' },
  ]

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      {s.pull.active && (
        <ModelPullOverlay
          pull={s.pull}
          selectedModel={s.pullingModel || s.selectedModel}
          onClose={() => s.setPull(p => ({ ...p, active: false }))}
        />
      )}

      {/* Fixed header */}
      <div className="shrink-0 space-y-4 pb-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Settings</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">Configure your Operator workspace.</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-5 border-b border-gray-200 dark:border-zinc-700">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'pb-2 text-xs font-medium transition-colors border-b-2 -mb-px',
                tab === t.id ? 'border-gray-900 dark:border-zinc-400 text-gray-900 dark:text-zinc-50' : 'border-transparent text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto py-5">
      <div className="space-y-5">
        {/* Profile tab */}
        {tab === 'profile' && (
          <>
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Profile</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Your name</label>
                  <input type="text" value={s.ceoName} onChange={e => s.setCeoName(e.target.value)} placeholder="Alex Chen"
                    className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Company</label>
                  <input type="text" value={s.companyName} onChange={e => s.setCompanyName(e.target.value)} placeholder="Acme Corp"
                    className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Your role</label>
                <input type="text" value={s.userRole} onChange={e => s.setUserRole(e.target.value)} placeholder="e.g. CEO, Head of Product, COO"
                  className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500" />
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">App Mode</h2>
                {s.appMode !== s.savedMode && <span className="text-xs text-amber-600 dark:text-amber-300">Unsaved</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MODE_LIST.map(m => (
                  <button key={m.id} type="button" onClick={() => {
                    s.setAppMode(m.id)
                    s.setCustomAreas(getModeConfig(m.id).defaultAreas)
                    s.setAreasCustomized(false)
                  }}
                    className={cn('text-left px-3 py-2.5 rounded-lg border-2 transition-all',
                      s.appMode === m.id ? 'border-gray-900 dark:border-zinc-400 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 hover:border-gray-300 dark:hover:border-zinc-500'
                    )}>
                    <ModeIcon modeId={m.id} className="w-6 h-6" />
                    <div className="text-xs font-semibold mt-1">{m.label}</div>
                    {s.savedMode === m.id && s.appMode !== m.id && <div className="text-[10px] text-blue-400 mt-0.5">current</div>}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Sound effects</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Walkie-talkie chirp on startup and shutdown</p>
                </div>
                <button
                  type="button"
                  onClick={() => s.setSoundEnabled(v => !v)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                    s.soundEnabled ? 'bg-gray-900 dark:bg-zinc-100' : 'bg-gray-200 dark:bg-zinc-700'
                  )}
                >
                  <span className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white dark:bg-zinc-900 shadow transform transition-transform',
                    s.soundEnabled ? 'translate-x-4' : 'translate-x-0'
                  )} />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Appearance</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                    {mode === 'system' ? `Auto — following system (${theme})` : mode === 'dark' ? 'Dark theme' : 'Light theme'}
                  </p>
                </div>
                <div className="flex rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden shrink-0">
                  {(['light', 'dark', 'system'] as const).map((m, i) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium transition-colors',
                        i > 0 && 'border-l border-gray-200 dark:border-zinc-700',
                        mode === m
                          ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                          : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                      )}
                    >
                      {m === 'system' ? 'Auto' : m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Areas</h2>
                {s.areasCustomized && (
                  <button type="button"
                    onClick={() => { s.setCustomAreas(getModeConfig(s.appMode).defaultAreas); s.setAreasCustomized(false) }}
                    className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">
                    Reset to {getModeConfig(s.appMode).label} defaults
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500">Areas appear when uploading {getModeConfig(s.appMode).documentLabelPlural.toLowerCase()} and creating request links. Switching modes resets to that mode&apos;s defaults unless you&apos;ve customised them.</p>
              <div className="flex flex-wrap gap-2">
                {s.customAreas.map(area => (
                  <span key={area} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-gray-100 dark:bg-zinc-800 text-xs text-gray-700 dark:text-zinc-200 rounded-md">
                    {area}
                    <button type="button" onClick={() => { s.setCustomAreas(a => a.filter(x => x !== area)); s.setAreasCustomized(true) }}
                      className="text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={s.newArea}
                  onChange={e => s.setNewArea(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const v = s.newArea.trim()
                      if (v && !s.customAreas.includes(v)) { s.setCustomAreas(a => [...a, v]); s.setNewArea(''); s.setAreasCustomized(true) }
                    }
                  }}
                  placeholder="Add area…"
                  className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = s.newArea.trim()
                    if (v && !s.customAreas.includes(v)) { s.setCustomAreas(a => [...a, v]); s.setNewArea(''); s.setAreasCustomized(true) }
                  }}
                  className="px-3 py-2 bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Security</h2>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-zinc-200">Auto-lock</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Lock after inactivity and require password</p>
                </div>
                <SelectField
                  value={String(s.autoLockMinutes)}
                  onChange={v => s.setAutoLockMinutes(parseInt(v))}
                  className="w-32"
                  options={[
                    { value: '0', label: 'Never' },
                    { value: '5', label: '5 min' },
                    { value: '10', label: '10 min' },
                    { value: '15', label: '15 min' },
                    { value: '30', label: '30 min' },
                    { value: '60', label: '1 hour' },
                  ]}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-zinc-200">Air-gap mode</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Block all outbound network calls (cloud AI, web search, feeds)</p>
                </div>
                <button
                  type="button"
                  onClick={() => s.setAirGapMode(v => !v)}
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                    s.airGapMode ? 'bg-red-500' : 'bg-gray-200 dark:bg-zinc-700'
                  )}
                >
                  <span className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white dark:bg-zinc-900 shadow transform transition-transform',
                    s.airGapMode ? 'translate-x-4' : 'translate-x-0'
                  )} />
                </button>
              </div>
              {s.airGapMode && (
                <p className="text-xs text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  Air-gap active — only Ollama (local) analysis works. Cloud providers and Pulse feeds are disabled.
                </p>
              )}
            </div>

            <RecoveryCodesPanel />
          </>
        )}

        {/* AI tab */}
        {tab === 'ai' && (
          <>
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">AI Provider</h2>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => s.setAiProvider('ollama')}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left',
                    s.aiProvider === 'ollama' ? 'border-gray-900 dark:border-zinc-400 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-50' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-500')}>
                  <Server size={13} className="shrink-0" />
                  <span>Local (Ollama)</span>
                  {s.savedProvider === 'ollama' && <span className="ml-auto text-xs text-blue-600 font-medium">active</span>}
                </button>
                {CLOUD_PROVIDERS.map(p => (
                  <button key={p.id} type="button" onClick={() => s.setAiProvider(p.id)}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left',
                      s.aiProvider === p.id ? 'border-gray-900 dark:border-zinc-400 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-50' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-500')}>
                    <ProviderLogo id={p.id} size={13} />
                    <span>{p.label}</span>
                    {s.savedProvider === p.id && <span className="ml-auto text-xs text-blue-600 font-medium">active</span>}
                  </button>
                ))}
              </div>
            </div>
            {s.aiProvider === 'ollama' && (
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5">
                <OllamaConfig
                  ollamaHost={s.ollamaHost} setOllamaHost={s.setOllamaHost}
                  ollamaModel={s.ollamaModel} setOllamaModel={s.setOllamaModel}
                  customModel={s.customModel} setCustomModel={s.setCustomModel}
                  savedModel={s.savedModel} savedProvider={s.savedProvider}
                  modelChanged={s.modelChanged} selectedModel={s.selectedModel}
                  switchingToOllama={s.switchingToOllama}
                  effectiveVisionModel={s.effectiveVisionModel}
                  visionModelChanged={s.visionModelChanged}
                  webAccess={s.webAccess} setWebAccess={s.setWebAccess}
                  ollamaVisionModel={s.ollamaVisionModel} setOllamaVisionModel={s.setOllamaVisionModel}
                  customVisionModel={s.customVisionModel} setCustomVisionModel={s.setCustomVisionModel}
                  savedVisionModel={s.savedVisionModel}
                  ollamaAudioModel={s.ollamaAudioModel} setOllamaAudioModel={s.setOllamaAudioModel}
                  customAudioModel={s.customAudioModel} setCustomAudioModel={s.setCustomAudioModel}
                  savedAudioModel={s.savedAudioModel}
                  modelSetupMode={s.modelSetupMode} setModelSetupMode={s.setModelSetupMode}
                />
              </div>
            )}
            {CLOUD_PROVIDERS.map(p => s.aiProvider === p.id && (
              <div key={p.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5">
                <CloudProviderConfig
                  activeProvider={p.id}
                  savedProvider={s.savedProvider}
                  savedModel={s.savedModel}
                  apiKeys={s.apiKeys} setApiKeys={s.setApiKeys}
                  testState={s.testState} testError={s.testError}
                  availableModels={s.availableModels}
                  selectedModels={s.selectedModels} setSelectedModels={s.setSelectedModels}
                  onTest={s.testProvider}
                />
              </div>
            ))}
          </>
        )}

        {tab === 'pulse' && (
          <SettingsPulseTab
            bskyIdentifier={s.bskyIdentifier} setBskyIdentifier={s.setBskyIdentifier}
            bskyAppPassword={s.bskyAppPassword} setBskyAppPassword={s.setBskyAppPassword}
            mastodonToken={s.mastodonToken} setMastodonToken={s.setMastodonToken}
            saving={s.saving} onSave={s.handleSave}
          />
        )}

        {/* Remove local models checkbox — only shown when switching from Ollama to a cloud provider */}
        {tab === 'ai' && s.savedProvider === 'ollama' && s.aiProvider !== 'ollama' && (
          <label className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={s.removeOllamaModels}
              onChange={e => s.setRemoveOllamaModels(e.target.checked)}
              className="mt-0.5 shrink-0 accent-amber-600"
            />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Remove local Ollama models to free storage</p>
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                Removes <strong>{s.savedModel}</strong>{s.savedVisionModel && s.savedVisionModel !== s.savedModel ? <> and <strong>{s.savedVisionModel}</strong></> : null} from Ollama after saving. Ollama itself stays installed — you can always re-pull models later if you switch back.
              </p>
            </div>
          </label>
        )}

        {(tab === 'profile' || tab === 'ai') && (
          <button type="button" onClick={s.handleSave} disabled={s.saving}
            className="w-full bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {s.saving
              ? <><Loader2 size={14} className="animate-spin" /> {s.needsPull ? 'Pulling model…' : 'Saving…'}</>
              : s.saved ? <><CheckCircle size={14} /> Saved</>
              : s.switchingToOllama ? <><Download size={14} /> Save & pull local model</>
              : s.modelChanged ? <><Download size={14} /> Save & switch model</>
              : 'Save settings'}
          </button>
        )}
      </div>

      {/* Remote tab */}
      {tab === 'remote' && <SettingsRemoteTab />}

      {/* Backup tab */}
      {tab === 'backup' && (
        <SettingsBackupTab
          lastBackup={s.lastBackup}
          onBackupDone={s.setLastBackup}
          initialBackupPath={s.backupPath}
        />
      )}

      {/* AI Context tab */}
      {tab === 'knowledge' && <SettingsKnowledgeTab appMode={s.appMode} />}

      {/* Collab tab */}
      {tab === 'collab' && <SettingsCollabTab />}

      {/* Danger tab */}
      {tab === 'danger' && <div className="space-y-5">
        <AuditLogPanel />

        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50 mb-1">About Operator</h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed">
            Operator is fully local. Reports are saved to <code className="font-mono">~/Documents/Operator Reports/</code>.
            {s.savedProvider === 'ollama'
              ? ' All analysis runs via Ollama on your machine — no data is sent externally.'
              : ` Analysis is sent to ${CLOUD_PROVIDERS.find(p => p.id === s.savedProvider)?.label ?? s.savedProvider} via their API.`}
          </p>
        </div>

        <div ref={dangerRef} id="danger" className="bg-white dark:bg-zinc-900 border border-red-100 dark:border-red-900 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Danger zone</h2>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">These actions are permanent and cannot be undone.</p>

          {uninstallPhase === 'idle' && (
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">Uninstall Operator</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Permanently deletes all your reports, journal entries, contacts, Pulse feeds, settings, and AI analysis data. Also removes the local AI model downloaded by this app and the entire application folder. <strong>Nothing is recoverable after this.</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUninstallPhase('confirming')}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              >
                <Trash2 size={14} /> Uninstall
              </button>
            </div>
          )}

          {uninstallPhase === 'confirming' && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">This cannot be undone</p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1 leading-relaxed">
                    This will permanently delete:
                  </p>
                  <ul className="text-xs text-red-600 dark:text-red-300 mt-1 space-y-0.5 list-disc list-inside">
                    <li>All your reports and analysis data</li>
                    <li>The local Ollama AI model pulled for this app</li>
                    <li>The entire Operator application folder</li>
                  </ul>
                  <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                    Ollama itself will <strong>not</strong> be uninstalled. Only the model this app downloaded will be removed.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setUninstallPhase('idle')}
                  className="flex-1 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
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

      </div>

      <a
        href="https://github.com/jcktp"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 block text-[10px] text-gray-300 dark:text-zinc-700 hover:text-gray-500 dark:hover:text-zinc-500 text-right select-none py-2 transition-colors"
      >
        Built with purpose by Jorick.
      </a>

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
