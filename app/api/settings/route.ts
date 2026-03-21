import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const settings = await prisma.setting.findMany()
  const map: Record<string, string> = {}
  for (const s of settings) map[s.key] = s.value
  return NextResponse.json({ settings: map })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { key, value } = body
  if (!key) return NextResponse.json({ error: 'Key required' }, { status: 400 })

  const setting = await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { id: crypto.randomUUID(), key, value },
  })
  return NextResponse.json({ setting })
}
