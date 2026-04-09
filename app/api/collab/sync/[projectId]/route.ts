/**
 * Inbound sync endpoint — receives a SyncPayload from a remote peer.
 *
 * Auth: NOT session-cookie based. Instead, verifies the cryptographic
 * signature against the sender's stored public key. Only trusted peers
 * are accepted.
 *
 * Permissions: read_write peers may push data; read_only peers are
 * rejected with 403.
 */
import { NextResponse } from 'next/server'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { applySyncPayload, pushToAllPeers } from '@/lib/collab/sync'
import { prisma } from '@/lib/db'
import type { SyncPayload } from '@/lib/collab/types'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const disabled = requireCollabEnabled()
  if (disabled) return disabled

  const { projectId } = await params
  const fromInstanceId = req.headers.get('X-Collab-From')
  if (!fromInstanceId) {
    return NextResponse.json({ error: 'Missing X-Collab-From header' }, { status: 400 })
  }

  // Look up sender — must be known and trusted
  const peer = await prisma.peer.findUnique({ where: { id: fromInstanceId } })
  if (!peer) {
    return NextResponse.json({ error: 'Unknown peer' }, { status: 401 })
  }
  if (!peer.trusted) {
    return NextResponse.json({ error: 'Peer not trusted' }, { status: 401 })
  }

  // Check this project is actually shared with this peer
  const share = await prisma.projectShare.findUnique({
    where: { projectId_peerId: { projectId, peerId: fromInstanceId } },
  })
  if (!share) {
    return NextResponse.json({ error: 'Project not shared with this peer' }, { status: 403 })
  }
  if (share.permission === 'read_only') {
    return NextResponse.json({ error: 'Peer has read-only permission' }, { status: 403 })
  }

  let payload: SyncPayload
  try {
    payload = await req.json() as SyncPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload.projectId !== projectId) {
    return NextResponse.json({ error: 'projectId mismatch' }, { status: 400 })
  }

  // Update peer last seen
  await prisma.peer.update({
    where: { id: fromInstanceId },
    data: { lastSeen: new Date() },
  })

  let result: { applied: number; conflicts: number }
  try {
    result = await applySyncPayload(payload, peer.publicKey)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 422 })
  }

  // Update sync state
  await prisma.syncState.upsert({
    where: { projectId_peerId: { projectId, peerId: fromInstanceId } },
    update: { lastSync: new Date(), status: result.conflicts > 0 ? 'conflict' : 'idle' },
    create: { projectId, peerId: fromInstanceId, lastSync: new Date(), status: result.conflicts > 0 ? 'conflict' : 'idle' },
  })

  // Push our changes back to the sender (bidirectional sync)
  const peerUrl = peer.tunnelUrl ?? peer.localUrl
  if (peerUrl) {
    // Fire-and-forget — don't await to avoid circular blocking
    pushToAllPeers(projectId).catch(() => {})
  }

  return NextResponse.json({ ok: true, applied: result.applied, conflicts: result.conflicts })
}

/** Manual trigger: push all pending changes to all peers for this project. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const { requireAuth } = await import('@/lib/api-auth')
  const deny = await requireAuth(req)
  if (deny) return deny

  const disabled = requireCollabEnabled()
  if (disabled) return disabled

  const { projectId } = await params
  await pushToAllPeers(projectId)
  return NextResponse.json({ ok: true })

  void cookieHeader
}
