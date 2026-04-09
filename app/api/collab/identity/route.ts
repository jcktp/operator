import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { getOrCreateIdentity } from '@/lib/collab/identity'
import { encodeInvite } from '@/lib/collab/invite'
import { getTunnelUrl } from '@/lib/tunnel'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const identity = await getOrCreateIdentity()
  const tunnelUrl = getTunnelUrl()

  const inviteString = encodeInvite({
    instanceId: identity.id,
    publicKey: identity.publicKey,
    tunnelUrl,
    displayName: identity.displayName,
  })

  return NextResponse.json({
    id: identity.id,
    displayName: identity.displayName,
    publicKey: identity.publicKey,
    tunnelUrl,
    inviteString,
  })
}
