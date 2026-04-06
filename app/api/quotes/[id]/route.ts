import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const allowed = ['text', 'speaker', 'context', 'sourceType', 'tags', 'reportId', 'projectId']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === 'tags' ? JSON.stringify(body[key]) : body[key]
    }
  }

  const quote = await prisma.quote.update({ where: { id }, data })
  return NextResponse.json({ quote: { ...quote, tags: JSON.parse(quote.tags) } })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  await prisma.quote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
