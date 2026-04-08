import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { host } = await req.json()
  const baseUrl = (host ?? 'http://localhost:11434').replace(/\/$/, '')

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
