import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { logAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const allowed = ['title', 'description', 'category', 'probability', 'impact', 'owner', 'status', 'notes', 'dueAt', 'resolvedAt', 'projectId']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      data[key] = (key === 'dueAt' || key === 'resolvedAt') && body[key]
        ? new Date(body[key] as string)
        : body[key]
    }
  }

  // Auto-set resolvedAt when status changes to closed or mitigated (if not already provided)
  if ('status' in body && !('resolvedAt' in body)) {
    const s = body.status as string
    if (s === 'closed' || s === 'mitigated') {
      const current = await prisma.risk.findUnique({ where: { id }, select: { resolvedAt: true } })
      if (!current?.resolvedAt) data.resolvedAt = new Date()
    } else if (s === 'open' || s === 'accepted') {
      data.resolvedAt = null
    }
  }

  const risk = await prisma.risk.update({ where: { id }, data })
  void logAction('risk.updated', risk.title)
  return NextResponse.json({ risk })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const risk = await prisma.risk.findUnique({ where: { id }, select: { title: true } })
  await prisma.risk.delete({ where: { id } })
  void logAction('risk.deleted', risk?.title ?? id)
  return NextResponse.json({ ok: true })
}
