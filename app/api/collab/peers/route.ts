import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = requireCollabEnabled()
  if (disabled) return disabled

  const peers = await prisma.peer.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ peers })
}

export async function POST(req: NextRequest) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = requireCollabEnabled()
  if (disabled) return disabled

  const body = await req.json() as {
    id?: string
    displayName?: string
    publicKey?: string
    tunnelUrl?: string
    localUrl?: string
    discoveryMethod?: string
    trusted?: boolean
  }

  if (!body.id || !body.publicKey) {
    return NextResponse.json({ error: 'id and publicKey required' }, { status: 400 })
  }

  const peer = await prisma.peer.upsert({
    where: { id: body.id },
    update: {
      displayName: body.displayName,
      publicKey: body.publicKey,
      tunnelUrl: body.tunnelUrl ?? null,
      localUrl: body.localUrl ?? null,
      discoveryMethod: body.discoveryMethod ?? null,
      trusted: body.trusted ?? false,
      lastSeen: new Date(),
    },
    create: {
      id: body.id,
      displayName: body.displayName,
      publicKey: body.publicKey,
      tunnelUrl: body.tunnelUrl ?? null,
      localUrl: body.localUrl ?? null,
      discoveryMethod: body.discoveryMethod ?? null,
      trusted: body.trusted ?? false,
      lastSeen: new Date(),
    },
  })

  return NextResponse.json({ peer })
}
