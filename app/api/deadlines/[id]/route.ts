import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const dateCols = new Set(['dueAt', 'completedAt'])
  const allowed = ['title', 'description', 'kind', 'dueAt', 'completedAt', 'status', 'priority', 'context', 'notes', 'projectId']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      data[key] = dateCols.has(key) && body[key] ? new Date(body[key] as string) : body[key]
    }
  }

  const deadline = await prisma.deadline.update({ where: { id }, data })
  return NextResponse.json({ deadline })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  await prisma.deadline.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
