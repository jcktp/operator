import { prisma } from './db'
import { decrypt } from './encryption'

const KEY_MAP: Record<string, string> = {
  ollama_host:        'OLLAMA_HOST',
  ollama_model:       'OLLAMA_MODEL',
  ollama_web_access:  'OLLAMA_WEB_ACCESS',
  ai_provider:        'AI_PROVIDER',
  anthropic_key:      'ANTHROPIC_API_KEY',
  openai_key:         'OPENAI_API_KEY',
  google_key:         'GOOGLE_API_KEY',
  groq_key:           'GROQ_API_KEY',
  anthropic_model:    'ANTHROPIC_MODEL',
  openai_model:       'OPENAI_MODEL',
  google_model:       'GOOGLE_MODEL',
  groq_model:         'GROQ_MODEL',
}

const ENCRYPTED_KEYS = new Set(['anthropic_key', 'openai_key', 'google_key', 'groq_key'])

/**
 * Loads AI provider settings from the database into process.env.
 * Sensitive keys are decrypted before being set.
 * Call this at the start of any API route that invokes lib/ai.
 */
export async function loadAiSettings(): Promise<void> {
  const settings = await prisma.setting.findMany()
  for (const s of settings) {
    const envKey = KEY_MAP[s.key]
    if (envKey) {
      process.env[envKey] = ENCRYPTED_KEYS.has(s.key) ? decrypt(s.value) : s.value
    }
  }
}
