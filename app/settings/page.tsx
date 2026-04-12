'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { CheckCircle, Loader2, Download, Server, Trash2, AlertTriangle } from 'lucide-react'
import AuditLogPanel from './AuditLogPanel'
import { cn } from '@/lib/utils'
import { CLOUD_PROVIDERS } from './settingsTypes'
import ModelPullOverlay from './ModelPullOverlay'
import OllamaConfig from './OllamaConfig'
import CloudProviderConfig from './CloudProviderConfig'
import { ProviderLogo } from './ProviderLogo'
import SettingsRemoteTab from './SettingsRemoteTab'
import SettingsBackupTab from './SettingsBackupTab'
import SettingsPulseTab from './SettingsPulseTab'
import SettingsKnowledgeTab from './SettingsKnowledgeTab'
import SettingsCollabTab from './SettingsCollabTab'
import SettingsProfileTab from './SettingsProfileTab'
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

 if (s.loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-[var(--text-muted)]" /></div>

 const TABS: { id: Tab; label: string }[] = [
 { id: 'profile', label: 'Profile' },
 { id: 'ai', label: 'AI' },
 { id: 'pulse', label: 'Pulse' },
 { id: 'remote', label: 'Remote' },
 { id: 'backup', label: 'Backup' },
 { id: 'knowledge', label: 'AI Context' },
 { id: 'collab', label: 'Collab' },
 { id: 'danger', label: 'Danger' },
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
 <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Settings</h1>
 <p className="text-[var(--text-muted)] text-sm mt-0.5">Configure your Operator workspace.</p>
 </div>

 {/* Tab bar */}
 <div className="flex gap-5 border-b border-[var(--border)]">
 {TABS.map(t => (
 <button
 key={t.id}
 type="button"
 onClick={() => setTab(t.id)}
 className={cn(
 'pb-2 text-xs font-medium transition-colors border-b-2 -mb-px',
 tab === t.id ? 'border-[var(--ink)] text-[var(--text-bright)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-subtle)]'
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
 <SettingsProfileTab s={s} theme={theme} mode={mode} setMode={setMode} />
 )}

 {/* AI tab */}
 {tab === 'ai' && (
 <>
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
 <h2 className="text-sm font-semibold text-[var(--text-bright)]">AI Provider</h2>
 <div className="grid grid-cols-2 gap-2">
 <button type="button" onClick={() => s.setAiProvider('ollama')}
 className={cn('flex items-center gap-2 h-7 px-2.5 rounded-[4px] border text-xs font-medium transition-colors text-left',
 s.aiProvider === 'ollama' ? 'border-[var(--ink)] bg-[var(--surface-2)] text-[var(--text-bright)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border)]')}>
 <Server size={13} className="shrink-0" />
 <span>Local (Ollama)</span>
 {s.savedProvider === 'ollama' && <span className="ml-auto text-xs text-blue-600 font-medium">active</span>}
 </button>
 {CLOUD_PROVIDERS.map(p => (
 <button key={p.id} type="button" onClick={() => s.setAiProvider(p.id)}
 className={cn('flex items-center gap-2 h-7 px-2.5 rounded-[4px] border text-xs font-medium transition-colors text-left',
 s.aiProvider === p.id ? 'border-[var(--ink)] bg-[var(--surface-2)] text-[var(--text-bright)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border)]')}>
 <ProviderLogo id={p.id} size={13} />
 <span>{p.label}</span>
 {s.savedProvider === p.id && <span className="ml-auto text-xs text-blue-600 font-medium">active</span>}
 </button>
 ))}
 </div>
 </div>
 {s.aiProvider === 'ollama' && (
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
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
 <div key={p.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
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
 <label className="flex items-start gap-3 bg-[var(--amber-dim)] border border-[var(--amber)] rounded-[10px] px-4 py-3 cursor-pointer">
 <input
 type="checkbox"
 checked={s.removeOllamaModels}
 onChange={e => s.setRemoveOllamaModels(e.target.checked)}
 className="mt-0.5 shrink-0 accent-amber-600"
 />
 <div>
 <p className="text-sm font-medium text-amber-800">Remove local Ollama models to free storage</p>
 <p className="text-xs text-[var(--amber)] mt-0.5">
 Removes <strong>{s.savedModel}</strong>{s.savedVisionModel && s.savedVisionModel !== s.savedModel ? <> and <strong>{s.savedVisionModel}</strong></> : null} from Ollama after saving. Ollama itself stays installed — you can always re-pull models later if you switch back.
 </p>
 </div>
 </label>
 )}

 {(tab === 'profile' || tab === 'ai') && (
 <button type="button" onClick={s.handleSave} disabled={s.saving}
 className="w-full bg-[var(--ink)] text-white text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
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

 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5">
 <h2 className="text-sm font-semibold text-[var(--text-bright)] mb-1">About Operator</h2>
 <p className="text-xs text-[var(--text-muted)] leading-relaxed">
 Operator is fully local. Reports are saved to <code className="font-mono">~/Documents/Operator Reports/</code>.
 {s.savedProvider === 'ollama'
 ? ' All analysis runs via Ollama on your machine — no data is sent externally.'
 : ` Analysis is sent to ${CLOUD_PROVIDERS.find(p => p.id === s.savedProvider)?.label ?? s.savedProvider} via their API.`}
 </p>
 </div>

 <div ref={dangerRef} id="danger" className="bg-[var(--surface)] border border-red-100 rounded-[10px] p-5">
 <h2 className="text-sm font-semibold text-[var(--red)] mb-1">Danger zone</h2>
 <p className="text-xs text-[var(--text-muted)] mb-4">These actions are permanent and cannot be undone.</p>

 {uninstallPhase === 'idle' && (
 <div className="flex items-start gap-4">
 <div className="flex-1">
 <p className="text-sm font-medium text-[var(--text-body)]">Uninstall Operator</p>
 <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
 Permanently deletes all your reports, journal entries, contacts, Pulse feeds, settings, and AI analysis data. Also removes the local AI model downloaded by this app and the entire application folder. <strong>Nothing is recoverable after this.</strong>
 </p>
 </div>
 <button
 type="button"
 onClick={() => setUninstallPhase('confirming')}
 className="shrink-0 flex items-center gap-2 h-7 px-3 rounded-[4px] border border-[var(--red)] text-[var(--red)] text-xs font-medium hover:bg-red-50 transition-colors"
 >
 <Trash2 size={14} /> Uninstall
 </button>
 </div>
 )}

 {uninstallPhase === 'confirming' && (
 <div className="bg-[var(--red-dim)] border border-[var(--red)] rounded-[10px] p-4 space-y-3">
 <div className="flex items-start gap-2">
 <AlertTriangle size={16} className="text-[var(--red)] shrink-0 mt-0.5" />
 <div>
 <p className="text-sm font-semibold text-[var(--red)]">This cannot be undone</p>
 <p className="text-xs text-[var(--red)] mt-1 leading-relaxed">
 This will permanently delete:
 </p>
 <ul className="text-xs text-[var(--red)] mt-1 space-y-0.5 list-disc list-inside">
 <li>All your reports and analysis data</li>
 <li>The local Ollama AI model pulled for this app</li>
 <li>The entire Operator application folder</li>
 </ul>
 <p className="text-xs text-[var(--red)] mt-2">
 Ollama itself will <strong>not</strong> be uninstalled. Only the model this app downloaded will be removed.
 </p>
 </div>
 </div>
 <div className="flex gap-2 pt-1">
 <button
 type="button"
 onClick={() => setUninstallPhase('idle')}
 className="flex-1 border border-[var(--border)] text-[var(--text-body)] text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--surface-2)] transition-colors"
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
 className="flex-1 bg-red-600 text-white text-sm font-medium h-7 px-3 rounded-[4px] hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
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
 className="shrink-0 block text-[10px] text-[var(--border)] hover:text-[var(--text-muted)] text-right select-none py-2 transition-colors"
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
 <p className="text-[var(--border)] text-sm font-medium">Uninstalling Operator…</p>
 <p className="text-[var(--text-muted)] text-xs">Removing models and data</p>
 </>
 ) : (
 <>
 <div className="w-10 h-10 mx-auto rounded-full bg-[var(--ink)] flex items-center justify-center">
 <Trash2 size={16} className="text-[var(--text-muted)]" />
 </div>
 <p className="text-[var(--border)] text-sm font-medium">Operator uninstalled</p>
 <p className="text-[var(--text-muted)] text-xs leading-relaxed">
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
