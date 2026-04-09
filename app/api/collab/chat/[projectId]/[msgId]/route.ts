import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { getOrCreateIdentity } from '@/lib/collab/identity'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; msgId: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { projectId, msgId } = await params
  const body = await req.json() as { content: string; references?: string }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const identity = await getOrCreateIdentity()
  const existing = await prisma.chatMessage.findUnique({ where: { id: msgId } })

  if (!existing || existing.projectId !== projectId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (existing.authorId !== identity.id) {
    return NextResponse.json({ error: 'cannot edit others\' messages' }, { status: 403 })
  }
  if (existing.deletedAt) {
    return NextResponse.json({ error: 'message deleted' }, { status: 410 })
  }

  const updated = await prisma.chatMessage.update({
    where: { id: msgId },
    data: {
      content: body.content.trim(),
      references: body.references ?? existing.references,
      editedAt: new Date(),
      syncClock: existing.syncClock + 1,
    },
  })

  return NextResponse.json({ message: updated })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; msgId: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { projectId, msgId } = await params
  const identity = await getOrCreateIdentity()
  const existing = await prisma.chatMessage.findUnique({ where: { id: msgId } })

  if (!existing || existing.projectId !== projectId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (existing.authorId !== identity.id) {
    return NextResponse.json({ error: 'cannot delete others\' messages' }, { status: 403 })
  }

  const updated = await prisma.chatMessage.update({
    where: { id: msgId },
    data: { deletedAt: new Date(), syncClock: existing.syncClock + 1 },
  })

  return NextResponse.json({ message: updated })
}
