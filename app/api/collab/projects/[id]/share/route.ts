import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { getOrCreateIdentity } from '@/lib/collab/identity'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = requireCollabEnabled()
  if (disabled) return disabled

  const { id: projectId } = await params
  const shares = await prisma.projectShare.findMany({
    where: { projectId },
  })

  // Enrich with peer info
  const peerIds = shares.map(s => s.peerId)
  const peers = await prisma.peer.findMany({ where: { id: { in: peerIds } } })
  const peerMap = Object.fromEntries(peers.map(p => [p.id, p]))

  const syncStates = await prisma.syncState.findMany({ where: { projectId } })
  const syncMap = Object.fromEntries(syncStates.map(s => [s.peerId, s]))

  const enriched = shares.map(s => ({
    ...s,
    peer: peerMap[s.peerId] ?? null,
    syncState: syncMap[s.peerId] ?? null,
  }))

  return NextResponse.json({ shares: enriched })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = requireCollabEnabled()
  if (disabled) return disabled

  const { id: projectId } = await params
  const body = await req.json() as { peerId?: string; permission?: string }

  if (!body.peerId) return NextResponse.json({ error: 'peerId required' }, { status: 400 })

  const peer = await prisma.peer.findUnique({ where: { id: body.peerId } })
  if (!peer) return NextResponse.json({ error: 'Unknown peer' }, { status: 404 })

  const identity = await getOrCreateIdentity()
  const share = await prisma.projectShare.upsert({
    where: { projectId_peerId: { projectId, peerId: body.peerId } },
    update: { permission: body.permission ?? 'read_write' },
    create: {
      projectId,
      peerId: body.peerId,
      permission: body.permission ?? 'read_write',
      sharedBy: identity.id,
    },
  })

  return NextResponse.json({ share })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = requireCollabEnabled()
  if (disabled) return disabled

  const { id: projectId } = await params
  const { searchParams } = new URL(req.url)
  const peerId = searchParams.get('peerId')
  if (!peerId) return NextResponse.json({ error: 'peerId required' }, { status: 400 })

  await prisma.projectShare.deleteMany({ where: { projectId, peerId } })
  return NextResponse.json({ ok: true })
}
