import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const resolved = searchParams.get('resolved')

  const where: { projectId?: string; resolved?: boolean } = {}
  if (projectId) where.projectId = projectId
  if (resolved !== null) where.resolved = resolved === 'true'

  const conflicts = await prisma.syncConflict.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Count unresolved per project for the badge
  const unresolved = await prisma.syncConflict.count({
    where: { ...(projectId ? { projectId } : {}), resolved: false },
  })

  return NextResponse.json({ conflicts, unresolvedCount: unresolved })
}
