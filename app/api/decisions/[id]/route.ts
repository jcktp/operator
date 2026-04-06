import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const allowed = ['title', 'context', 'rationale', 'outcome', 'status', 'madeBy', 'madeAt', 'notes', 'projectId']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === 'madeAt' && body[key] ? new Date(body[key] as string) : body[key]
    }
  }

  const decision = await prisma.decision.update({ where: { id }, data })
  return NextResponse.json({ decision })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  await prisma.decision.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
