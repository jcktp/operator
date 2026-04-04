import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'user_memory' } })
    return NextResponse.json({ memory: row?.value ?? '' })
  } catch (e) {
    console.error('dispatch/memory GET error:', e)
    return NextResponse.json({ error: 'Failed to load memory' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const body = await req.json() as { memory?: string; fact?: string }
    if ('fact' in body && typeof body.fact === 'string') {
      // Append a single fact
      const fact = body.fact.trim()
      if (!fact) return NextResponse.json({ ok: true })
      const row = await prisma.setting.findUnique({ where: { key: 'user_memory' } })
      const existing = row?.value ?? ''
      const updated = existing ? `${existing}\n${fact}` : fact
      await prisma.setting.upsert({
        where: { key: 'user_memory' },
        update: { value: updated },
        create: { id: crypto.randomUUID(), key: 'user_memory', value: updated },
      })
    } else {
      // Full replace (existing behaviour — keeps Dispatch AI auto-save working)
      const memory = typeof body.memory === 'string' ? body.memory : ''
      await prisma.setting.upsert({
        where: { key: 'user_memory' },
        update: { value: memory },
        create: { id: crypto.randomUUID(), key: 'user_memory', value: memory },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('dispatch/memory POST error:', e)
    return NextResponse.json({ error: 'Failed to save memory' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  try {
    const { fact } = await req.json() as { fact?: string }
    if (!fact?.trim()) {
      return NextResponse.json({ error: 'fact required' }, { status: 400 })
    }
    const row = await prisma.setting.findUnique({ where: { key: 'user_memory' } })
    const existing = row?.value ?? ''
    const updated = existing
      .split('\n')
      .filter(f => f.trim() !== fact.trim())
      .join('\n')
    await prisma.setting.upsert({
      where: { key: 'user_memory' },
      update: { value: updated },
      create: { id: crypto.randomUUID(), key: 'user_memory', value: updated },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('dispatch/memory DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete memory fact' }, { status: 500 })
  }
}
