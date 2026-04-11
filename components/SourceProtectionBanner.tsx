'use client'

import { useEffect, useState } from 'react'
import { useMode } from '@/components/ModeContext'
import { AlertTriangle } from 'lucide-react'

const CLOUD_PROVIDERS: Record<string, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
  google: 'Google Gemini',
  groq: 'Groq',
  xai: 'xAI Grok',
  perplexity: 'Perplexity',
  mistral: 'Mistral',
}

export default function SourceProtectionBanner() {
  const config = useMode()
  const [providerLabel, setProviderLabel] = useState<string | null>(null)

  useEffect(() => {
    if (config.id !== 'journalism') return

    fetch('/api/settings')
      .then(r => r.json())
      .then((s: Record<string, unknown>) => {
        const provider = (s.ai_provider as string) ?? 'ollama'
        if (provider !== 'ollama') {
          setProviderLabel(CLOUD_PROVIDERS[provider] ?? provider)
        }
      })
      .catch(() => {})
  }, [config.id])

  if (config.id !== 'journalism' || !providerLabel) return null

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[10px] px-4 py-3 mb-6">
      <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">Source protection reminder</p>
        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
          You are using <strong>{providerLabel}</strong> (cloud AI). Documents you upload are sent to a third-party server for analysis.
          Do not upload documents that could identify confidential sources or contain sensitive unpublished information.
        </p>
      </div>
    </div>
  )
}
