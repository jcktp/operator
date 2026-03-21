import { NextRequest, NextResponse } from 'next/server'

type Provider = 'anthropic' | 'openai' | 'groq' | 'google'

const TEST_PROMPT = 'Reply with exactly: {"ok":true}'

// ── Model listing ──────────────────────────────────────────────────────────

async function listAnthropic(key: string): Promise<string[]> {
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  })
  const data = await res.json() as { data?: Array<{ id: string }> }
  return (data.data ?? []).map(m => m.id).sort()
}

async function listOpenAI(key: string): Promise<string[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${key}` },
  })
  const data = await res.json() as { data?: Array<{ id: string }> }
  return (data.data ?? [])
    .map(m => m.id)
    .filter(id => /^(gpt-|o[0-9]|chatgpt)/.test(id) && !id.includes('instruct') && !id.includes('realtime'))
    .sort()
}

async function listGroq(key: string): Promise<string[]> {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { 'Authorization': `Bearer ${key}` },
  })
  const data = await res.json() as { data?: Array<{ id: string }> }
  return (data.data ?? []).map(m => m.id).sort()
}

async function listGoogle(key: string): Promise<string[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
  const data = await res.json() as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
  }
  return (data.models ?? [])
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .sort()
}

// ── Connection test ────────────────────────────────────────────────────────

async function testAnthropic(key: string, model: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 32, messages: [{ role: 'user', content: TEST_PROMPT }] }),
  })
  const data = await res.json() as { error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
}

async function testOpenAI(key: string, model: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 32, messages: [{ role: 'user', content: TEST_PROMPT }] }),
  })
  const data = await res.json() as { error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
}

async function testGroq(key: string, model: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 32, messages: [{ role: 'user', content: TEST_PROMPT }] }),
  })
  const data = await res.json() as { error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
}

async function testGoogle(key: string, model: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: TEST_PROMPT }] }], generationConfig: { maxOutputTokens: 32 } }),
    }
  )
  const data = await res.json() as { error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`)
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { provider, key } = await req.json() as { provider: Provider; key: string }
    if (!key?.trim()) return NextResponse.json({ error: 'API key is required' }, { status: 400 })

    // First fetch available models
    let models: string[] = []
    try {
      switch (provider) {
        case 'anthropic': models = await listAnthropic(key); break
        case 'openai':    models = await listOpenAI(key); break
        case 'groq':      models = await listGroq(key); break
        case 'google':    models = await listGoogle(key); break
      }
    } catch {
      // model listing failed — connection might still work
    }

    if (models.length === 0) {
      return NextResponse.json({ error: 'Could not connect or no models available' }, { status: 400 })
    }

    // Test with the first available model
    const testModel = models[0]
    switch (provider) {
      case 'anthropic': await testAnthropic(key, testModel); break
      case 'openai':    await testOpenAI(key, testModel); break
      case 'groq':      await testGroq(key, testModel); break
      case 'google':    await testGoogle(key, testModel); break
      default: return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, models, defaultModel: testModel })
  } catch (e) {
    return NextResponse.json({ error: String(e).replace('Error: ', '') }, { status: 400 })
  }
}
