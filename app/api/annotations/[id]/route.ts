import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  const body = await req.json() as { note?: string; color?: string }

  const annotation = await prisma.annotation.update({
    where: { id },
    data: {
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
    },
  })
  return NextResponse.json({ annotation })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const { id } = await params
  await prisma.annotation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
