import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { getOrCreateIdentity } from '@/lib/collab/identity'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const body = await req.json() as { projectId: string; lastReadMsgId?: string }
  if (!body.projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const identity = await getOrCreateIdentity()

  await prisma.chatReadState.upsert({
    where: { projectId_instanceId: { projectId: body.projectId, instanceId: identity.id } },
    update: {
      lastReadAt: new Date(),
      lastReadMsgId: body.lastReadMsgId ?? null,
    },
    create: {
      projectId: body.projectId,
      instanceId: identity.id,
      lastReadAt: new Date(),
      lastReadMsgId: body.lastReadMsgId ?? null,
    },
  })

  return NextResponse.json({ ok: true })
}
