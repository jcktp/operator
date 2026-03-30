import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// DELETE /api/storyline/[id]/evidence/[eid]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  const { eid } = await params
  await prisma.evidenceItem.delete({ where: { id: eid } })
  return NextResponse.json({ ok: true })
}
