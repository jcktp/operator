import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const briefings = await prisma.areaBriefing.findMany({ orderBy: [{ area: 'asc' }] })
  return NextResponse.json({ briefings })
}

export async function PATCH(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { area, notes } = await req.json() as { area?: string; notes?: string }
  if (!area) return NextResponse.json({ error: 'area required' }, { status: 400 })
  const updated = await prisma.areaBriefing.updateMany({
    where: { area },
    data: { userNotes: notes ?? null },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { area } = await req.json() as { area?: string }
  if (!area) return NextResponse.json({ error: 'area required' }, { status: 400 })
  await prisma.areaBriefing.deleteMany({ where: { area } })
  return NextResponse.json({ ok: true })
}
