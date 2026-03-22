import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const row = await prisma.setting.findUnique({ where: { key: 'user_memory' } })
  return NextResponse.json({ memory: row?.value ?? '' })
}

export async function POST(req: NextRequest) {
  const { memory } = await req.json() as { memory?: string }
  await prisma.setting.upsert({
    where: { key: 'user_memory' },
    update: { value: memory ?? '' },
    create: { id: crypto.randomUUID(), key: 'user_memory', value: memory ?? '' },
  })
  return NextResponse.json({ ok: true })
}
