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
  const { name, title, email, phone, area, notes } = body
  const direct = await prisma.directReport.update({
    where: { id },
    data: { name, title, email, area },
  })
  const extraUpdates: string[] = []
  const extraParams: (string | null)[] = []
  if (phone !== undefined) { extraUpdates.push('"phone" = ?'); extraParams.push(phone || null) }
  if (notes !== undefined) { extraUpdates.push('"notes" = ?'); extraParams.push(notes || null) }
  if (extraUpdates.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "DirectReport" SET ${extraUpdates.join(', ')} WHERE "id" = ?`,
      ...extraParams, id
    )
  }
  return NextResponse.json({ direct: { ...direct, phone: phone ?? null, notes: notes ?? null } })
}
