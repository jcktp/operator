import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { host } = await req.json()
  const baseUrl = (host ?? 'http://localhost:11434').replace(/\/$/, '')

  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return NextResponse.json({ error: 'Ollama returned an error' }, { status: 502 })

    const data = await res.json()
    const models: string[] = (data.models ?? []).map((m: { name: string }) => m.name)

    return NextResponse.json({ ok: true, models })
  } catch {
    return NextResponse.json({ error: 'Could not connect to Ollama' }, { status: 503 })
  }
}
