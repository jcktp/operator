import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encryption'

// Keys that contain sensitive credentials — never returned in plaintext
const SENSITIVE_KEYS = new Set([
  'anthropic_key', 'openai_key', 'groq_key', 'google_key',
])

// Only these keys are allowed to be written
const ALLOWED_KEYS = new Set([
  'ollama_host', 'ollama_model', 'ollama_web_access',
  'ai_provider',
  'anthropic_key', 'anthropic_model',
  'openai_key', 'openai_model',
  'groq_key', 'groq_model',
  'google_key', 'google_model',
  'ceo_name', 'company_name', 'user_role',
  'user_memory',
])

export async function GET() {
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
}

export async function POST(req: NextRequest) {
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
  return NextResponse.json({ ok: true })
}
