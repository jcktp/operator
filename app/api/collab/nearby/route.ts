import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { getNearbyPeers } from '@/lib/collab/mdns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = requireCollabEnabled()
  if (disabled) return disabled

  const peers = getNearbyPeers()
  return NextResponse.json({ peers })
}
