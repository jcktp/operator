import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encryption'
import { requireAuth } from '@/lib/api-auth'
import { loadAiSettings } from '@/lib/settings'

// Keys that contain sensitive credentials — never returned in plaintext
const SENSITIVE_KEYS = new Set([
  'anthropic_key', 'openai_key', 'groq_key', 'google_key', 'xai_key', 'perplexity_key', 'mistral_key',
  'bluesky_app_password', 'mastodon_access_token',
])

// Only these keys are allowed to be written
const ALLOWED_KEYS = new Set([
  'ollama_host', 'ollama_model', 'ollama_web_access',
  'ai_provider',
  'anthropic_key', 'anthropic_model',
  'openai_key', 'openai_model',
  'groq_key', 'groq_model',
  'google_key', 'google_model',
  'xai_key', 'xai_model',
  'perplexity_key', 'perplexity_model',
  'mistral_key', 'mistral_model',
  'app_mode',
  'ceo_name', 'company_name', 'user_role',
  'user_memory',
  'bluesky_identifier', 'bluesky_app_password', 'mastodon_access_token',
  'sound_enabled', 'custom_areas', 'auto_lock_minutes', 'air_gap_mode', 'dark_mode',
  'backup_path', 'last_backup',
  'onboarding_complete',
  'current_project_id',
  'ollama_vision_model',
  'ollama_audio_model',
  'model_setup_mode',
  'collab_enabled',
  'collab_display_name',
])

export async function GET(req: NextRequest) {
  try {
    const deny = await requireAuth(req)
    if (deny) return deny
    const settings = await prisma.setting.findMany()
    const map: Record<string, string> = {}
    for (const s of settings) {
      if (SENSITIVE_KEYS.has(s.key)) {
        // Decrypt to check if a value exists, but never return the plaintext
        const plaintext = decrypt(s.value)
        map[s.key] = plaintext ? '__saved__' : ''
      } else {
        map[s.key] = s.value
      }
    }
    return NextResponse.json({ settings: map })
  } catch (e) {
    console.error('settings GET error:', e)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const deny = await requireAuth(req)
    if (deny) return deny
    const body = await req.json() as { key?: string; value?: string }
    const { key, value } = body

    if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 })
    if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ error: 'Unknown setting key' }, { status: 400 })

    // If a sensitive key comes back as the sentinel (unchanged), skip writing it
    if (SENSITIVE_KEYS.has(key) && value === '__saved__') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const stored = SENSITIVE_KEYS.has(key) ? encrypt(value ?? '') : (value ?? '')
    await prisma.setting.upsert({
      where: { key },
      update: { value: stored },
      create: { id: crypto.randomUUID(), key, value: stored },
    })
    // Reload settings into process.env so AI providers pick up changes immediately
    await loadAiSettings()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('settings POST error:', e)
    return NextResponse.json({ error: 'Failed to save setting' }, { status: 500 })
  }
}
