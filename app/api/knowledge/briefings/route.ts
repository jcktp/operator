import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const briefings = await prisma.areaBriefing.findMany({ orderBy: [{ area: 'asc' }] })
  return NextResponse.json({ briefings })
}

export async function PATCH(req: NextRequest) {
  const { area, notes } = await req.json() as { area?: string; notes?: string }
  if (!area) return NextResponse.json({ error: 'area required' }, { status: 400 })
  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const mode = modeRow?.value ?? 'executive'
  const updated = await prisma.areaBriefing.updateMany({
    where: { area, mode },
    data: { userNotes: notes ?? null },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { area } = await req.json() as { area?: string }
  if (!area) return NextResponse.json({ error: 'area required' }, { status: 400 })
  await prisma.areaBriefing.deleteMany({ where: { area } })
  return NextResponse.json({ ok: true })
}
