import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'

// DELETE /api/journal/[id]/structure/evidence/[eid]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { eid } = await params
  await prisma.evidenceItem.delete({ where: { id: eid } })
  return NextResponse.json({ ok: true })
}
