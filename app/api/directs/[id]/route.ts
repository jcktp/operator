import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  await prisma.directReport.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params
  const body = await req.json()
  const { name, title, email, phone, area, notes } = body
  // All fields are in the Prisma schema — use the safe typed update, no raw SQL needed
  const direct = await prisma.directReport.update({
    where: { id },
    data: {
      name,
      title,
      email,
      area,
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
  })
  return NextResponse.json({ direct })
}
