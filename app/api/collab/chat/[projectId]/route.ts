import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { getOrCreateIdentity } from '@/lib/collab/identity'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { projectId } = await params
  const { searchParams } = new URL(req.url)
  const before = searchParams.get('before')   // createdAt cursor for pagination
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  const messages = await prisma.chatMessage.findMany({
    where: {
      projectId,
      threadId: null,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  // Attach reply counts
  const ids = messages.map(m => m.id)
  const counts = await prisma.chatMessage.groupBy({
    by: ['threadId'],
    where: { threadId: { in: ids } },
    _count: { id: true },
  })
  const replyCountMap: Record<string, number> = {}
  for (const c of counts) {
    if (c.threadId) replyCountMap[c.threadId] = c._count.id
  }

  return NextResponse.json({
    messages: messages.map(m => ({
      ...m,
      replyCount: replyCountMap[m.id] ?? 0,
    })),
    hasMore: messages.length === limit,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { projectId } = await params
  const body = await req.json() as { content: string; references?: string }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const identity = await getOrCreateIdentity()

  // Monotonic syncClock within project
  const agg = await prisma.chatMessage.aggregate({
    where: { projectId },
    _max: { syncClock: true },
  })
  const syncClock = (agg._max.syncClock ?? 0) + 1

  const message = await prisma.chatMessage.create({
    data: {
      projectId,
      content: body.content.trim(),
      authorId: identity.id,
      authorName: identity.displayName,
      references: body.references ?? null,
      syncClock,
    },
  })

  return NextResponse.json({ message }, { status: 201 })
}
