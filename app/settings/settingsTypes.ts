export const DEFAULT_MODELS = [
  { id: 'llama3.2:3b', label: 'Llama 3.2 3B', note: 'Recommended — fast, good quality' },
  { id: 'llama3.2:1b', label: 'Llama 3.2 1B', note: 'Fastest, lightest' },
  { id: 'qwen2.5:3b', label: 'Qwen 2.5 3B', note: 'Great at structured output' },
  { id: 'gemma2:2b', label: 'Gemma 2 2B', note: 'Small and capable' },
  { id: 'mistral:7b', label: 'Mistral 7B', note: 'Best quality, needs more RAM' },
  { id: 'phi3.5', label: 'Phi 3.5', note: 'Microsoft small model' },
]

export const CLOUD_PROVIDERS = [
  { id: 'anthropic' as const, label: 'Anthropic', model: 'claude-haiku-4-5-20251001', placeholder: 'sk-ant-...', docsUrl: 'https://console.anthropic.com/', docsLabel: 'Get key at console.anthropic.com', note: 'Best reasoning quality. Fast Haiku model used.' },
  { id: 'openai' as const, label: 'OpenAI', model: 'gpt-4o-mini', placeholder: 'sk-...', docsUrl: 'https://platform.openai.com/api-keys', docsLabel: 'Get key at platform.openai.com', note: 'GPT-4o mini — fast and affordable.' },
  { id: 'groq' as const, label: 'Groq', model: 'llama-3.1-8b-instant', placeholder: 'gsk_...', docsUrl: 'https://console.groq.com/keys', docsLabel: 'Get key at console.groq.com', note: 'Extremely fast inference. Generous free tier.' },
  { id: 'google' as const, label: 'Google Gemini', model: 'gemini-1.5-flash', placeholder: 'AIza...', docsUrl: 'https://aistudio.google.com/app/apikey', docsLabel: 'Get key at aistudio.google.com', note: 'Gemini 1.5 Flash — large context window.' },
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
