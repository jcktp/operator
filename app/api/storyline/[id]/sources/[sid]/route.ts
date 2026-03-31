import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// PATCH /api/storyline/[id]/sources/[sid] — update tags/notes
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { sid } = await params
  const { tags, notes } = await req.json() as { tags?: string[]; notes?: string }
  const data: Record<string, unknown> = {}
  if (tags !== undefined) data.tags = JSON.stringify(tags)
  if (notes !== undefined) data.notes = notes
  const source = await prisma.storySource.update({
    where: { id: sid },
    data,
    include: { directReport: { select: { id: true, name: true, title: true, area: true, updatedAt: true } } },
  })
  return NextResponse.json({ source })
}

// DELETE /api/storyline/[id]/sources/[sid]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  const { sid } = await params
  await prisma.storySource.delete({ where: { id: sid } })
  return NextResponse.json({ ok: true })
}
