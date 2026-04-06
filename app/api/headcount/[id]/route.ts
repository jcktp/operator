import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const allowed = ['role', 'department', 'currentCount', 'targetCount', 'openPositions', 'attritionRate', 'status', 'targetDate', 'hiringManager', 'notes', 'projectId']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === 'targetDate' && body[key] ? new Date(body[key] as string) : body[key]
    }
  }

  const entry = await prisma.headcountEntry.update({ where: { id }, data })
  return NextResponse.json({ entry })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  await prisma.headcountEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
