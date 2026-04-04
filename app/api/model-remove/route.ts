import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { model } = await req.json()
  if (!model) return NextResponse.json({ error: 'model required' }, { status: 400 })

  const ollamaHost = process.env.OLLAMA_HOST ?? 'http://localhost:11434'

  try {
    await fetch(`${ollamaHost}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove model' }, { status: 500 })
  }
}
