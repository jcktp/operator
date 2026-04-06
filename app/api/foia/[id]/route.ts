import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const allowed = ['agency', 'subject', 'description', 'status', 'filedAt', 'dueAt', 'receivedAt', 'trackingNum', 'notes', 'projectId']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      if ((key === 'filedAt' || key === 'dueAt' || key === 'receivedAt') && typeof body[key] === 'string') {
        data[key] = body[key] ? new Date(body[key] as string) : null
      } else {
        data[key] = body[key]
      }
    }
  }

  const request = await prisma.foiaRequest.update({ where: { id }, data })
  return NextResponse.json({ request })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  await prisma.foiaRequest.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
