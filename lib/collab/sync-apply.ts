/**
 * Inbound sync: applies an incoming SyncPayload from a trusted peer.
 * Handles per-table conflict detection and record creation/update.
 */

import { prisma } from '@/lib/db'
import type { SyncPayload, SyncRecord } from './types'
import { verifyPayload } from './signing'

/** Two modifications within this window on the same record = conflict. */
export const CONFLICT_WINDOW_MS = 5 * 60 * 1000   // 5 minutes

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Applies an incoming SyncPayload from a trusted peer.
 * Verifies signature, then applies each record with conflict detection.
 */
export async function applySyncPayload(
  payload: SyncPayload,
  peerPublicKey: string
): Promise<{ applied: number; conflicts: number }> {
  if (!verifyPayload(payload, peerPublicKey)) {
    throw new Error('Signature verification failed')
  }

  let applied = 0
  let conflicts = 0

  for (const record of payload.records) {
    try {
      const hadConflict = await applyRecord(record, payload.fromInstanceId, payload.projectId)
      if (hadConflict) { conflicts++ } else { applied++ }
    } catch (err) {
      console.error(`[collab] Failed to apply ${record.table}/${record.id}:`, err)
    }
  }

  return { applied, conflicts }
}

// ── Record dispatcher ────────────────────────────────────────────────────────

async function applyRecord(
  record: SyncRecord,
  fromInstanceId: string,
  projectId: string
): Promise<boolean> {
  const remoteTs = new Date(record.updatedAt)

  switch (record.table) {
    case 'Report':     return applyReport(record, remoteTs, fromInstanceId, projectId)
    case 'ReportEntity': return applyAppendOnly('ReportEntity', record)
    case 'TimelineEvent': return applyAppendOnly('TimelineEvent', record)
    case 'Claim':      return applyClaim(record, remoteTs, fromInstanceId, projectId)
    case 'FoiaRequest': return applyFoia(record, remoteTs, fromInstanceId, projectId)
    case 'ChatMessage': return applyChatMessage(record)
    default:
      console.warn(`[collab] Unknown sync table: ${record.table}`)
      return false
  }
}

// ── Per-table apply logic ────────────────────────────────────────────────────

async function applyReport(
  record: SyncRecord,
  remoteTs: Date,
  fromInstanceId: string,
  projectId: string
): Promise<boolean> {
  const data = record.data as {
    title?: string; summary?: string; insights?: string; questions?: string
    area?: string; fileName?: string; fileType?: string; fileSize?: number
    rawContent?: string; mode?: string; removedAt?: string | null; removedBy?: string | null
  }

  // Deletion consensus — a removal never triggers a conflict; it just sets the flag
  if (record.removed && record.removedAt) {
    await prisma.report.updateMany({
      where: { id: record.id, removedAt: null },
      data: { removedAt: new Date(record.removedAt), removedBy: record.removedBy ?? fromInstanceId },
    })
    return false
  }

  const local = await prisma.report.findUnique({ where: { id: record.id } })

  if (!local) {
    // New report from peer — create
    await prisma.report.create({
      data: {
        id: record.id,
        title: data.title ?? 'Untitled',
        fileName: data.fileName ?? '',
        fileType: data.fileType ?? '',
        fileSize: data.fileSize ?? 0,
        rawContent: data.rawContent ?? '',
        summary: (data.summary as string | undefined) ?? null,
        insights: (data.insights as string | undefined) ?? null,
        questions: (data.questions as string | undefined) ?? null,
        area: data.area ?? '',
        mode: data.mode ?? '',
        projectId,
        createdAt: record.data.createdAt ? new Date(record.data.createdAt as string) : new Date(),
        updatedAt: remoteTs,
      },
    })
    return false
  }

  // Conflict detection
  const localTs = local.updatedAt
  const timeDiff = Math.abs(localTs.getTime() - remoteTs.getTime())

  if (timeDiff <= CONFLICT_WINDOW_MS) {
    // Both modified within the conflict window — check if any field actually differs
    const conflictFields: Array<keyof typeof data> = ['summary', 'insights', 'questions', 'area']
    let hasConflict = false
    for (const field of conflictFields) {
      const localVal = (local as Record<string, unknown>)[field]
      const remoteVal = data[field]
      if (localVal !== remoteVal && remoteVal !== undefined) {
        await logConflict({
          projectId,
          tableName: 'Report',
          recordId: record.id,
          fieldName: field,
          localValue: localVal != null ? String(localVal) : null,
          remoteValue: remoteVal != null ? String(remoteVal) : null,
          localPeerId: null,
          remotePeerId: fromInstanceId,
          localTimestamp: localTs,
          remoteTimestamp: remoteTs,
        })
        hasConflict = true
      }
    }
    if (hasConflict) return true
  }

  // LWW — remote wins if newer
  if (remoteTs > localTs) {
    await prisma.report.update({
      where: { id: record.id },
      data: {
        summary: data.summary,
        insights: data.insights,
        questions: data.questions,
        area: data.area,
        updatedAt: remoteTs,
      },
    })
  }
  return false
}

async function applyAppendOnly(
  table: 'ReportEntity' | 'TimelineEvent',
  record: SyncRecord
): Promise<boolean> {
  // Append-only: skip if record already exists
  if (table === 'ReportEntity') {
    const exists = await prisma.reportEntity.findUnique({ where: { id: record.id } })
    if (!exists) {
      const d = record.data as {
        reportId: string; type: string; name: string; context?: string
      }
      await prisma.reportEntity.create({
        data: { id: record.id, reportId: d.reportId, type: d.type, name: d.name, context: d.context ?? null },
      })
    }
  } else {
    const exists = await prisma.timelineEvent.findUnique({ where: { id: record.id } })
    if (!exists) {
      const d = record.data as {
        reportId: string; dateText: string; dateSortKey?: string; event: string
      }
      await prisma.timelineEvent.create({
        data: { id: record.id, reportId: d.reportId, dateText: d.dateText, dateSortKey: d.dateSortKey ?? null, event: d.event },
      })
    }
  }
  return false
}

async function applyClaim(
  record: SyncRecord,
  remoteTs: Date,
  fromInstanceId: string,
  projectId: string
): Promise<boolean> {
  const data = record.data as { text?: string; status?: string; notes?: string; source?: string }
  const local = await prisma.claim.findUnique({ where: { id: record.id } })

  if (!local) {
    await prisma.claim.create({
      data: {
        id: record.id,
        text: data.text ?? '',
        status: data.status ?? 'unverified',
        notes: data.notes ?? null,
        source: data.source ?? null,
        projectId,
        createdAt: record.data.createdAt ? new Date(record.data.createdAt as string) : new Date(),
        updatedAt: remoteTs,
      },
    })
    return false
  }

  const localTs = local.updatedAt
  const timeDiff = Math.abs(localTs.getTime() - remoteTs.getTime())
  if (timeDiff <= CONFLICT_WINDOW_MS && local.status !== data.status && data.status !== undefined) {
    await logConflict({
      projectId, tableName: 'Claim', recordId: record.id, fieldName: 'status',
      localValue: local.status, remoteValue: data.status ?? null,
      localPeerId: null, remotePeerId: fromInstanceId,
      localTimestamp: localTs, remoteTimestamp: remoteTs,
    })
    return true
  }

  if (remoteTs > localTs) {
    await prisma.claim.update({
      where: { id: record.id },
      data: { status: data.status, notes: data.notes, updatedAt: remoteTs },
    })
  }
  return false
}

async function applyFoia(
  record: SyncRecord,
  remoteTs: Date,
  fromInstanceId: string,
  projectId: string
): Promise<boolean> {
  const data = record.data as {
    agency?: string; subject?: string; status?: string; notes?: string
    description?: string
  }
  const local = await prisma.foiaRequest.findUnique({ where: { id: record.id } })

  if (!local) {
    await prisma.foiaRequest.create({
      data: {
        id: record.id,
        agency: data.agency ?? '',
        subject: data.subject ?? '',
        status: data.status ?? 'draft',
        notes: data.notes ?? null,
        description: data.description ?? null,
        projectId,
        createdAt: record.data.createdAt ? new Date(record.data.createdAt as string) : new Date(),
        updatedAt: remoteTs,
      },
    })
    return false
  }

  const localTs = local.updatedAt
  const timeDiff = Math.abs(localTs.getTime() - remoteTs.getTime())
  if (timeDiff <= CONFLICT_WINDOW_MS && local.status !== data.status && data.status !== undefined) {
    await logConflict({
      projectId, tableName: 'FoiaRequest', recordId: record.id, fieldName: 'status',
      localValue: local.status, remoteValue: data.status ?? null,
      localPeerId: null, remotePeerId: fromInstanceId,
      localTimestamp: localTs, remoteTimestamp: remoteTs,
    })
    return true
  }

  if (remoteTs > localTs) {
    await prisma.foiaRequest.update({
      where: { id: record.id },
      data: { status: data.status, notes: data.notes, updatedAt: remoteTs },
    })
  }
  return false
}

async function applyChatMessage(record: SyncRecord): Promise<boolean> {
  const d = record.data as {
    projectId: string; threadId?: string | null; content: string
    authorId: string; authorName: string; references?: string | null
    editedAt?: string | null; deletedAt?: string | null; syncClock: number
    createdAt: string
  }

  const existing = await prisma.chatMessage.findUnique({ where: { id: record.id } })

  if (!existing) {
    // Insert new message
    await prisma.chatMessage.create({
      data: {
        id: record.id,
        projectId: d.projectId,
        threadId: d.threadId ?? null,
        content: d.content,
        authorId: d.authorId,
        authorName: d.authorName,
        references: d.references ?? null,
        editedAt: d.editedAt ? new Date(d.editedAt) : null,
        deletedAt: d.deletedAt ? new Date(d.deletedAt) : null,
        syncClock: d.syncClock,
        createdAt: new Date(d.createdAt),
      },
    })
    return false
  }

  // Only apply if incoming syncClock is higher
  if (d.syncClock <= existing.syncClock) return false

  // Apply deletion from any author (deletion consensus)
  if (d.deletedAt && !existing.deletedAt) {
    await prisma.chatMessage.update({
      where: { id: record.id },
      data: { deletedAt: new Date(d.deletedAt), syncClock: d.syncClock },
    })
    return false
  }

  // Apply edit — only from same author
  if (d.editedAt && d.authorId === existing.authorId) {
    await prisma.chatMessage.update({
      where: { id: record.id },
      data: {
        content: d.content,
        references: d.references ?? existing.references,
        editedAt: new Date(d.editedAt),
        syncClock: d.syncClock,
      },
    })
  }

  return false
}

// ── Conflict logging ─────────────────────────────────────────────────────────

export async function logConflict(args: {
  projectId: string
  tableName: string
  recordId: string
  fieldName: string
  localValue: string | null
  remoteValue: string | null
  localPeerId: string | null
  remotePeerId: string | null
  localTimestamp: Date
  remoteTimestamp: Date
}): Promise<void> {
  // Deduplicate — don't log the same conflict twice if sync runs multiple times
  const existing = await prisma.syncConflict.findFirst({
    where: {
      projectId: args.projectId,
      tableName: args.tableName,
      recordId: args.recordId,
      fieldName: args.fieldName,
      resolved: false,
    },
  })
  if (existing) return

  await prisma.syncConflict.create({
    data: {
      id: crypto.randomUUID(),
      projectId: args.projectId,
      tableName: args.tableName,
      recordId: args.recordId,
      fieldName: args.fieldName,
      localValue: args.localValue,
      remoteValue: args.remoteValue,
      localPeerId: args.localPeerId,
      remotePeerId: args.remotePeerId,
      localTimestamp: args.localTimestamp,
      remoteTimestamp: args.remoteTimestamp,
    },
  })
}
