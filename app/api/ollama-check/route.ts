import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { host } = await req.json()
  const raw = (host ?? 'http://localhost:11434').replace(/\/$/, '')
  // Validate URL and block dangerous targets (metadata endpoints, link-local)
  let baseUrl: string
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only HTTP/HTTPS hosts are allowed' }, { status: 400 })
    }
    const h = parsed.hostname.toLowerCase()
    // Block cloud metadata and link-local endpoints
    if (h === '169.254.169.254' || h === 'metadata.google.internal' || h.startsWith('169.254.')) {
      return NextResponse.json({ error: 'Metadata endpoints are not allowed' }, { status: 403 })
    }
    baseUrl = raw
  } catch {
    return NextResponse.json({ error: 'Invalid host URL' }, { status: 400 })
  }

  try {
    const [tagsRes, versionRes] = await Promise.all([
      fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(5000) }).catch(() => null),
    ])

    if (!tagsRes.ok) return NextResponse.json({ error: 'Ollama returned an error' }, { status: 502 })

    const data = await tagsRes.json()
    const models: string[] = (data.models ?? []).map((m: { name: string }) => m.name)

    let version: string | null = null
    if (versionRes?.ok) {
      const vd = await versionRes.json() as { version?: string }
      version = vd.version ?? null
    }

    return NextResponse.json({ ok: true, models, version })
  } catch {
    return NextResponse.json({ error: 'Could not connect to Ollama' }, { status: 503 })
  }
}
