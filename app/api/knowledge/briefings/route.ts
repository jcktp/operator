import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const briefings = await prisma.areaBriefing.findMany({ orderBy: [{ area: 'asc' }] })
  return NextResponse.json({ briefings })
}

export async function PATCH(req: NextRequest) {
  const { area, notes } = await req.json() as { area?: string; notes?: string }
  if (!area) return NextResponse.json({ error: 'area required' }, { status: 400 })
  const mode = process.env.APP_MODE ?? 'executive'
  // Only update userNotes; leave content and reportCount untouched
  const updated = await prisma.areaBriefing.updateMany({
    where: { area, mode },
    data: { userNotes: notes ?? null },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
