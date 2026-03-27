import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'user_memory' } })
    return NextResponse.json({ memory: row?.value ?? '' })
  } catch (e) {
    console.error('dispatch/memory GET error:', e)
    return NextResponse.json({ error: 'Failed to load memory' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { memory } = await req.json() as { memory?: string }
    await prisma.setting.upsert({
      where: { key: 'user_memory' },
      update: { value: memory ?? '' },
      create: { id: crypto.randomUUID(), key: 'user_memory', value: memory ?? '' },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('dispatch/memory POST error:', e)
    return NextResponse.json({ error: 'Failed to save memory' }, { status: 500 })
  }
}
