import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.directReport.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, title, email, phone, area } = body
  const direct = await prisma.directReport.update({
    where: { id },
    data: { name, title, email, area },
  })
  if (phone !== undefined) {
    await prisma.$executeRawUnsafe('UPDATE "DirectReport" SET "phone" = ? WHERE "id" = ?', phone || null, id)
  }
  return NextResponse.json({ direct: { ...direct, phone: phone ?? null } })
}
