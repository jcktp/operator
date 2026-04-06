import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const allowed = ['title', 'description', 'category', 'probability', 'impact', 'owner', 'status', 'notes', 'dueAt', 'projectId']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === 'dueAt' && body[key] ? new Date(body[key] as string) : body[key]
    }
  }

  const risk = await prisma.risk.update({ where: { id }, data })
  return NextResponse.json({ risk })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  await prisma.risk.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
