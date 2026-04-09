import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { requireCollabEnabled } from '@/lib/collab/feature-flag'
import { getOrCreateIdentity } from '@/lib/collab/identity'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST — resolve a conflict.
 * Body: { resolution: 'kept_local' | 'kept_remote' | 'kept_both' }
 *
 * 'kept_remote': applies the remote value to the local record.
 * 'kept_local':  marks resolved without changing anything.
 * 'kept_both':   duplicates the record with the remote value (where applicable).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const disabled = await requireCollabEnabled()
  if (disabled) return disabled

  const { id } = await params
  const body = await req.json() as { resolution?: string }

  const VALID = new Set(['kept_local', 'kept_remote', 'kept_both'])
  if (!body.resolution || !VALID.has(body.resolution)) {
    return NextResponse.json({ error: 'resolution must be kept_local | kept_remote | kept_both' }, { status: 400 })
  }

  const conflict = await prisma.syncConflict.findUnique({ where: { id } })
  if (!conflict) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (conflict.resolved) return NextResponse.json({ error: 'Already resolved' }, { status: 409 })

  const identity = await getOrCreateIdentity()

  if (body.resolution === 'kept_remote' && conflict.remoteValue !== null) {
    await applyRemoteValue(conflict)
  }

  if (body.resolution === 'kept_both' && conflict.remoteValue !== null) {
    await duplicateWithRemoteValue(conflict)
  }

  await prisma.syncConflict.update({
    where: { id },
    data: {
      resolved: true,
      resolution: body.resolution,
      resolvedAt: new Date(),
      resolvedBy: identity.id,
    },
  })

  return NextResponse.json({ ok: true })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function applyRemoteValue(conflict: {
  tableName: string
  recordId: string
  fieldName: string
  remoteValue: string | null
}): Promise<void> {
  const { tableName, recordId, fieldName, remoteValue } = conflict

  switch (tableName) {
    case 'Report':
      await prisma.report.updateMany({
        where: { id: recordId },
        data: { [fieldName]: remoteValue },
      })
      break
    case 'Claim':
      await prisma.claim.updateMany({
        where: { id: recordId },
        data: { [fieldName]: remoteValue },
      })
      break
    case 'FoiaRequest':
      await prisma.foiaRequest.updateMany({
        where: { id: recordId },
        data: { [fieldName]: remoteValue },
      })
      break
    default:
      break
  }
}

async function duplicateWithRemoteValue(conflict: {
  tableName: string
  recordId: string
  fieldName: string
  remoteValue: string | null
}): Promise<void> {
  const { tableName, recordId, fieldName, remoteValue } = conflict

  switch (tableName) {
    case 'ReportEntity': {
      const original = await prisma.reportEntity.findUnique({ where: { id: recordId } })
      if (original) {
        await prisma.reportEntity.create({
          data: {
            id: crypto.randomUUID(),
            reportId: original.reportId,
            type: original.type,
            name: fieldName === 'name' ? (remoteValue ?? original.name) : original.name,
            context: fieldName === 'context' ? remoteValue : original.context,
          },
        })
      }
      break
    }
    default:
      // For non-entity tables, 'kept_both' falls back to keeping local
      break
  }
}
