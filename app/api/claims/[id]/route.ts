import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const allowed = ['text', 'source', 'sourceType', 'status', 'notes', 'reportId', 'projectId']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  const claim = await prisma.claim.update({
    where: { id },
    data,
    include: { report: { select: { id: true, title: true } } },
  })
  return NextResponse.json({ claim })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  await prisma.claim.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
