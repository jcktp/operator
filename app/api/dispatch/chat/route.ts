import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { dispatchChatStream } from '@/lib/ai'
import { loadAiSettings } from '@/lib/settings'
import type { PersonaId } from '@/lib/personas'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const { messages, context, persona, userMemory } = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      context?: string
      persona?: PersonaId
      userMemory?: string
    }
    await loadAiSettings()
    const { prisma } = await import('@/lib/db')
    const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })

    const stream = dispatchChatStream(
      messages,
      context ?? '',
      persona ?? 'dispatch',
      userMemory ?? '',
      modeRow?.value,
    )

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
