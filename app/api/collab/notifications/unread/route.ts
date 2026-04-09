import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { getOrCreateIdentity } from '@/lib/collab/identity'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Returns unread chat message counts per shared project.
 * A project is "shared" when it has at least one ProjectShare entry.
 */
export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const identity = await getOrCreateIdentity()

  // Get all projects that have shares
  const shares = await prisma.projectShare.findMany({
    select: { projectId: true },
    distinct: ['projectId'],
  })
  const sharedProjectIds = shares.map(s => s.projectId)

  if (sharedProjectIds.length === 0) {
    return NextResponse.json({ total: 0, perProject: {} })
  }

  // Get read state for this instance
  const readStates = await prisma.chatReadState.findMany({
    where: { instanceId: identity.id, projectId: { in: sharedProjectIds } },
  })
  const readMap: Record<string, Date> = {}
  for (const rs of readStates) readMap[rs.projectId] = rs.lastReadAt

  // Count unread messages per project
  const perProject: Record<string, number> = {}
  let total = 0

  await Promise.all(
    sharedProjectIds.map(async projectId => {
      const since = readMap[projectId]
      const count = await prisma.chatMessage.count({
        where: {
          projectId,
          deletedAt: null,
          authorId: { not: identity.id },   // don't count own messages
          ...(since ? { createdAt: { gt: since } } : {}),
        },
      })
      if (count > 0) {
        perProject[projectId] = count
        total += count
      }
    })
  )

  return NextResponse.json({ total, perProject })
}
