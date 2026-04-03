import { NextResponse } from 'next/server'

export async function GET() {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  try {
    const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return NextResponse.json({ running: false, models: [] })
    const data = await res.json() as { models?: Array<{ name: string }> }
    const models = (data.models ?? []).map(m => m.name)
    return NextResponse.json({ running: true, models })
  } catch {
    return NextResponse.json({ running: false, models: [] })
  }
}
