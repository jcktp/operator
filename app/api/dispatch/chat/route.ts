import { NextRequest, NextResponse } from 'next/server'
import { dispatchChat, extractMemoryFacts } from '@/lib/ai'
import { loadAiSettings } from '@/lib/settings'
import { prisma } from '@/lib/db'
import type { PersonaId } from '@/lib/personas'

export async function POST(req: NextRequest) {
  try {
    const { messages, context, persona, userMemory } = await req.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      context?: string
      persona?: PersonaId
      userMemory?: string
    }
    await loadAiSettings()

    const { content, noteSaved } = await dispatchChat(messages, context ?? '', persona ?? 'dispatch', userMemory ?? '')

    // Background: extract new memory facts from this conversation (non-blocking)
    extractMemoryFacts([...messages, { role: 'assistant', content }], userMemory ?? '')
      .then(async newFacts => {
        if (newFacts.length === 0) return
        const existing = userMemory ?? ''
        const updated = existing
          ? `${existing}\n${newFacts.join('\n')}`
          : newFacts.join('\n')
        await prisma.setting.upsert({
          where: { key: 'user_memory' },
          update: { value: updated },
          create: { id: crypto.randomUUID(), key: 'user_memory', value: updated },
        })
      })
      .catch(() => {}) // never let memory extraction break the response

    return NextResponse.json({ content, noteSaved: noteSaved ?? null })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
