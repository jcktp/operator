import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { id } = await params
  const peer = await prisma.peer.findUnique({ where: { id } })
  if (!peer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ peer })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { id } = await params
  const body = await req.json() as {
    trusted?: boolean
    displayName?: string
    tunnelUrl?: string
    localUrl?: string
  }

  const peer = await prisma.peer.update({
    where: { id },
    data: {
      trusted: body.trusted,
      displayName: body.displayName,
      tunnelUrl: body.tunnelUrl,
      localUrl: body.localUrl,
    },
  })
  return NextResponse.json({ peer })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { id } = await params
  // Also remove all project shares for this peer
  await prisma.projectShare.deleteMany({ where: { peerId: id } })
  await prisma.syncState.deleteMany({ where: { peerId: id } })
  await prisma.peer.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
