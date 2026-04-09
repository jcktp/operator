import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { decodeInvite } from '@/lib/collab/invite'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const body = await req.json() as { inviteString?: string }
  if (!body.inviteString) {
    return NextResponse.json({ error: 'inviteString required' }, { status: 400 })
  }

  const invite = decodeInvite(body.inviteString)
  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite string' }, { status: 400 })
  }

  // Add or update the peer — not trusted yet (user must explicitly trust)
  const peer = await prisma.peer.upsert({
    where: { id: invite.instanceId },
    update: {
      displayName: invite.displayName ?? null,
      publicKey: invite.publicKey,
      tunnelUrl: invite.tunnelUrl ?? null,
      discoveryMethod: 'remote',
      lastSeen: new Date(),
    },
    create: {
      id: invite.instanceId,
      displayName: invite.displayName ?? null,
      publicKey: invite.publicKey,
      tunnelUrl: invite.tunnelUrl ?? null,
      discoveryMethod: 'remote',
      trusted: false,
      lastSeen: new Date(),
    },
  })

  return NextResponse.json({ peer })
}
