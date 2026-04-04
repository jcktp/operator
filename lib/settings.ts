import { prisma } from './db'
import { decrypt } from './encryption'

const KEY_MAP: Record<string, string> = {
  ollama_host:            'OLLAMA_HOST',
  ollama_model:           'OLLAMA_MODEL',
  ollama_vision_model:    'OLLAMA_VISION_MODEL',
  ollama_audio_model:     'OLLAMA_AUDIO_MODEL',
  ollama_web_access:      'OLLAMA_WEB_ACCESS',
  air_gap_mode:           'AIR_GAP_MODE',
  ai_provider:            'AI_PROVIDER',
  app_mode:               'APP_MODE',
  ceo_name:               'CEO_NAME',
  user_role:              'USER_ROLE',
  last_backup:            'LAST_BACKUP',
  backup_path:            'BACKUP_PATH',
  anthropic_key:          'ANTHROPIC_API_KEY',
  openai_key:             'OPENAI_API_KEY',
  google_key:             'GOOGLE_API_KEY',
  groq_key:               'GROQ_API_KEY',
  xai_key:                'XAI_API_KEY',
  perplexity_key:         'PERPLEXITY_API_KEY',
  mistral_key:            'MISTRAL_API_KEY',
  anthropic_model:        'ANTHROPIC_MODEL',
  bluesky_identifier:     'BLUESKY_IDENTIFIER',
  bluesky_app_password:   'BLUESKY_APP_PASSWORD',
  mastodon_access_token:  'MASTODON_ACCESS_TOKEN',
  openai_model:           'OPENAI_MODEL',
  google_model:           'GOOGLE_MODEL',
  groq_model:             'GROQ_MODEL',
  xai_model:              'XAI_MODEL',
  perplexity_model:       'PERPLEXITY_MODEL',
  mistral_model:          'MISTRAL_MODEL',
}

// AI provider API keys — decrypted values go into the in-memory cache only,
// never into process.env, to reduce the exposure window. (fix #10)
const AI_API_KEYS = new Set([
  'anthropic_key', 'openai_key', 'google_key', 'groq_key',
  'xai_key', 'perplexity_key', 'mistral_key',
])

// All keys stored encrypted in the DB
const ALL_ENCRYPTED = new Set([
  ...AI_API_KEYS,
  'bluesky_app_password',
  'mastodon_access_token',
])

// In-memory secrets cache — keeps AI API keys out of process.env
const _secrets = new Map<string, string>()

/**
 * Retrieve a decrypted secret by its ENV key name (e.g. 'ANTHROPIC_API_KEY').
 * Only AI provider API keys are stored here; other settings remain in process.env.
 */
export function getSecret(envKey: string): string | undefined {
  return _secrets.get(envKey)
}

/**
 * Loads settings from the database.
 * - Non-sensitive settings → process.env
 * - Bluesky/Mastodon credentials → process.env (decrypted; needed by pulse.ts)
 * - AI provider API keys → in-memory secrets cache ONLY (never process.env)
 */
export async function loadAiSettings(): Promise<void> {
  const settings = await prisma.setting.findMany()
  _secrets.clear()
  for (const s of settings) {
    const envKey = KEY_MAP[s.key]
    if (!envKey) continue
    if (AI_API_KEYS.has(s.key)) {
      const decrypted = decrypt(s.value)
      if (decrypted) _secrets.set(envKey, decrypted)
    } else if (ALL_ENCRYPTED.has(s.key)) {
      // Encrypted but not an AI key (Bluesky, Mastodon) — decrypt into process.env
      process.env[envKey] = decrypt(s.value)
    } else {
      process.env[envKey] = s.value
    }
  }
}
