import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// PATCH /api/storyline/[id] — update title, narrative, events, claimStatuses, reportIds
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json() as {
    title?: string
    description?: string
    status?: string
    narrative?: string
    events?: string
    claimStatuses?: string
    reportIds?: string[]
  }
  const data: Record<string, unknown> = {}
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description
  if (body.status !== undefined) data.status = body.status
  if (body.narrative !== undefined) data.narrative = body.narrative
  if (body.events !== undefined) data.events = body.events
  if (body.claimStatuses !== undefined) data.claimStatuses = body.claimStatuses
  if (body.reportIds !== undefined) data.reportIds = JSON.stringify(body.reportIds)

  const story = await prisma.story.update({
    where: { id },
    data,
    include: { evidence: { orderBy: { createdAt: 'asc' } } },
  })
  return NextResponse.json({ story })
}

// DELETE /api/storyline/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.story.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
