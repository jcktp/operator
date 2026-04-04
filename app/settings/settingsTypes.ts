export const DEFAULT_MODELS = [
  { id: 'phi4-mini',   label: 'Phi 4 Mini',    note: 'Recommended — fast, high quality structured output · text only' },
  { id: 'gemma4:e2b',  label: 'Gemma 4 E2B',   note: 'Text + vision + audio · 7.2 GB · 128K context · edge-optimised' },
  { id: 'gemma4:e4b',  label: 'Gemma 4 E4B',   note: 'Text + vision + audio · 9.6 GB · 128K context · higher quality' },
  { id: 'qwen3:4b',    label: 'Qwen3 4B',       note: 'Strong instruction following and structured output · text only' },
  { id: 'llama3.2:3b', label: 'Llama 3.2 3B',  note: 'Fast and lightweight · 128K context · text only' },
  { id: 'llama3.2:1b', label: 'Llama 3.2 1B',  note: 'Fastest, lightest · text only' },
  { id: 'qwen2.5:3b',  label: 'Qwen 2.5 3B',   note: 'Great at structured output · text only' },
  { id: 'gemma2:2b',   label: 'Gemma 2 2B',     note: 'Small and capable · text only' },
  { id: 'mistral:7b',  label: 'Mistral 7B',     note: 'Best text quality, needs more RAM · text only' },
]

export const CLOUD_PROVIDERS = [
  { id: 'anthropic' as const, label: 'Anthropic', model: 'claude-haiku-4-5-20251001', placeholder: 'sk-ant-...', docsUrl: 'https://console.anthropic.com/', docsLabel: 'Get key at console.anthropic.com', note: 'Best reasoning quality. Fast Haiku model used.' },
  { id: 'openai' as const, label: 'OpenAI', model: 'gpt-4o-mini', placeholder: 'sk-...', docsUrl: 'https://platform.openai.com/api-keys', docsLabel: 'Get key at platform.openai.com', note: 'GPT-4o mini — fast and affordable.' },
  { id: 'groq' as const, label: 'Groq', model: 'llama-3.1-8b-instant', placeholder: 'gsk_...', docsUrl: 'https://console.groq.com/keys', docsLabel: 'Get key at console.groq.com', note: 'Extremely fast inference. Generous free tier.' },
  { id: 'google' as const, label: 'Google Gemini', model: 'gemini-2.5-flash', placeholder: 'AIza...', docsUrl: 'https://aistudio.google.com/app/apikey', docsLabel: 'Get key at aistudio.google.com', note: 'Gemini 2.5 Flash — large context window, fast.' },
  { id: 'xai' as const, label: 'Grok (xAI)', model: 'grok-3-mini', placeholder: 'xai-...', docsUrl: 'https://console.x.ai/', docsLabel: 'Get key at console.x.ai', note: 'Grok 3 Mini — fast reasoning model by xAI.' },
  { id: 'perplexity' as const, label: 'Perplexity', model: 'llama-3.1-sonar-small-128k-online', placeholder: 'pplx-...', docsUrl: 'https://www.perplexity.ai/settings/api', docsLabel: 'Get key at perplexity.ai', note: 'Sonar online — built-in live web search, no extra config.' },
  { id: 'mistral' as const, label: 'Mistral', model: 'mistral-small-latest', placeholder: '...', docsUrl: 'https://console.mistral.ai/api-keys', docsLabel: 'Get key at console.mistral.ai', note: 'Mistral Small — fast, efficient European model.' },
]

export type CloudProviderId = typeof CLOUD_PROVIDERS[number]['id']
export type AIProvider = 'ollama' | CloudProviderId

export interface PullState {
  active: boolean
  status: string
  progress: number
  error?: string
  done: boolean
}

export type TestState = 'idle' | 'testing' | 'ok' | 'error'
