import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { chat } from '@/lib/ai-providers'
import { loadAiSettings } from '@/lib/settings'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const { text } = await req.json() as { text?: string }
    if (!text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })

    await loadAiSettings()

    const result = await chat([
      {
        role: 'user',
        content: `Fix the grammar, spelling, and improve the clarity of the following text. Preserve the original meaning, tone, and paragraph structure exactly. Return ONLY the corrected text with no preamble, commentary, or explanation.\n\n${text.trim()}`,
      },
    ], 0.2)

    return NextResponse.json({ content: result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
