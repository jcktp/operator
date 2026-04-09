import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { getOrCreateIdentity } from '@/lib/collab/identity'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; threadId: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { projectId, threadId } = await params

  const [root, replies] = await Promise.all([
    prisma.chatMessage.findUnique({ where: { id: threadId } }),
    prisma.chatMessage.findMany({
      where: { projectId, threadId },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!root || root.projectId !== projectId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return NextResponse.json({ root, replies })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; threadId: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { projectId, threadId } = await params
  const body = await req.json() as { content: string; references?: string }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  // Verify root exists
  const root = await prisma.chatMessage.findUnique({ where: { id: threadId } })
  if (!root || root.projectId !== projectId || root.threadId !== null) {
    return NextResponse.json({ error: 'thread not found' }, { status: 404 })
  }

  const identity = await getOrCreateIdentity()

  const agg = await prisma.chatMessage.aggregate({
    where: { projectId },
    _max: { syncClock: true },
  })
  const syncClock = (agg._max.syncClock ?? 0) + 1

  const reply = await prisma.chatMessage.create({
    data: {
      projectId,
      threadId,
      content: body.content.trim(),
      authorId: identity.id,
      authorName: identity.displayName,
      references: body.references ?? null,
      syncClock,
    },
  })

  return NextResponse.json({ message: reply }, { status: 201 })
}
