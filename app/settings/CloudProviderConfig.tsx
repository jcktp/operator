'use client'

import { CheckCircle, AlertCircle, Loader2, ExternalLink, Trash2 } from 'lucide-react'
import type { CloudProviderId, TestState } from './settingsTypes'
import { CLOUD_PROVIDERS } from './settingsTypes'

interface Props {
  activeProvider: CloudProviderId
  savedProvider: string
  savedModel: string
  apiKeys: Record<CloudProviderId, string>
  setApiKeys: (fn: (k: Record<CloudProviderId, string>) => Record<CloudProviderId, string>) => void
  testState: Record<CloudProviderId, TestState>
  testError: Record<CloudProviderId, string>
  availableModels: Record<CloudProviderId, string[]>
  selectedModels: Record<CloudProviderId, string>
  setSelectedModels: (fn: (m: Record<CloudProviderId, string>) => Record<CloudProviderId, string>) => void
  onTest: (provider: CloudProviderId) => void
}

export default function CloudProviderConfig({
  activeProvider, savedProvider, savedModel,
  apiKeys, setApiKeys,
  testState, testError,
  availableModels, selectedModels, setSelectedModels,
  onTest,
}: Props) {
  const p = CLOUD_PROVIDERS.find(x => x.id === activeProvider)!

  return (
    <div className="space-y-4 pt-1 border-t border-gray-100 dark:border-zinc-800">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300">API Key</label>
          <a href={p.docsUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 flex items-center gap-1">
            {p.docsLabel} <ExternalLink size={10} />
          </a>
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKeys[activeProvider] === '__saved__' ? '' : apiKeys[activeProvider]}
            onChange={e => setApiKeys(k => ({ ...k, [activeProvider]: e.target.value }))}
            placeholder={apiKeys[activeProvider] === '__saved__' ? 'API key saved — enter new key to replace' : p.placeholder}
            className="flex-1 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
          <button
            type="button"
            onClick={() => onTest(activeProvider)}
            disabled={!apiKeys[activeProvider].trim() || apiKeys[activeProvider] === '__saved__' || testState[activeProvider] === 'testing'}
            className="shrink-0 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 text-xs font-medium px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
          >
            {testState[activeProvider] === 'testing' ? <Loader2 size={13} className="animate-spin" /> : 'Test'}
          </button>
        </div>

        {testState[activeProvider] === 'ok' && (
          <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
            <CheckCircle size={12} /> Connected · {availableModels[activeProvider].length} model{availableModels[activeProvider].length !== 1 ? 's' : ''} available
          </p>
        )}
        {testState[activeProvider] === 'error' && (
          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
            <AlertCircle size={12} /> {testError[activeProvider]}
          </p>
        )}
      </div>

      {availableModels[activeProvider].length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1.5">Model</label>
          <select
            value={selectedModels[activeProvider]}
            onChange={e => setSelectedModels(m => ({ ...m, [activeProvider]: e.target.value }))}
            className="w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-zinc-400 bg-white dark:bg-zinc-800"
          >
            {availableModels[activeProvider].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-3 space-y-1.5">
        <p className="text-xs font-medium text-gray-600 dark:text-zinc-300">About this provider</p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">{p.note}</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500">Model used: <code className="font-mono">{p.model}</code></p>
      </div>

      {savedProvider === 'ollama' && savedModel && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <Trash2 size={13} className="shrink-0 mt-0.5" />
          <span>Saving will switch to {p.label} and remove local model <strong>{savedModel}</strong>.</span>
        </div>
      )}
    </div>
  )
}
