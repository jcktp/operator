/**
 * Sync engine for Operator collaboration.
 *
 * Transport: HTTP POST to peer's tunnelUrl or localUrl.
 * Conflict model: explicit surface — when two peers modify the same record
 * within CONFLICT_WINDOW_MS of each other and values differ, we log a
 * SyncConflict and do NOT silently overwrite either side.
 *
 * Synced tables (append-only or updatable):
 *   Report          — full sync; updatedAt for LWW; removedAt for deletion consensus
 *   ReportEntity    — append-only (no updatedAt; createdAt only)
 *   TimelineEvent   — append-only
 *   Claim           — full sync; updatedAt for LWW
 *   FoiaRequest     — full sync; updatedAt for LWW
 */

import { prisma } from '@/lib/db'
import type { SyncPayload, SyncRecord } from './types'
import { getOrCreateIdentity, getPrivateKeyPem } from './identity'
import { signPayload, verifyPayload } from './signing'

/** Two modifications within this window on the same record = conflict. */
const CONFLICT_WINDOW_MS = 5 * 60 * 1000   // 5 minutes

// ── Diff builder ──────────────────────────────────────────────────────────────

/**
 * Builds a SyncPayload containing all shared-table records in `projectId`
 * that have been created/updated since `since` (or all records if null).
 */
export async function buildSyncPayload(
  projectId: string,
  since: Date | null
): Promise<Omit<SyncPayload, 'signature'>> {
  const identity = await getOrCreateIdentity()
  const sentAt = new Date().toISOString()
  const records: SyncRecord[] = []

  // Reports (full sync — has updatedAt)
  const reportWhere = since
    ? { projectId, updatedAt: { gt: since } }
    : { projectId }
  const reports = await prisma.report.findMany({ where: reportWhere })
  for (const r of reports) {
    records.push({
      table: 'Report',
      id: r.id,
      data: r as unknown as Record<string, unknown>,
      updatedAt: r.updatedAt.toISOString(),
      removed: r.removedAt != null,
      removedBy: r.removedBy ?? undefined,
      removedAt: r.removedAt?.toISOString(),
    })
  }

  // ReportEntities — append-only; send all created since `since`
  const entityReports = reports.map(r => r.id)
  if (entityReports.length > 0) {
    const entityWhere = since
      ? { reportId: { in: entityReports }, createdAt: { gt: since } }
      : { reportId: { in: entityReports } }
    const entities = await prisma.reportEntity.findMany({ where: entityWhere })
    for (const e of entities) {
      records.push({
        table: 'ReportEntity',
        id: e.id,
        data: e as unknown as Record<string, unknown>,
        updatedAt: e.createdAt.toISOString(),
      })
    }

    const timelineWhere = since
      ? { reportId: { in: entityReports }, createdAt: { gt: since } }
      : { reportId: { in: entityReports } }
    const events = await prisma.timelineEvent.findMany({ where: timelineWhere })
    for (const ev of events) {
      records.push({
        table: 'TimelineEvent',
        id: ev.id,
        data: ev as unknown as Record<string, unknown>,
        updatedAt: ev.createdAt.toISOString(),
      })
    }
  }

  // Claims — full sync
  const claimWhere = since
    ? { projectId, updatedAt: { gt: since } }
    : { projectId }
  const claims = await prisma.claim.findMany({ where: claimWhere })
  for (const c of claims) {
    records.push({
      table: 'Claim',
      id: c.id,
      data: c as unknown as Record<string, unknown>,
      updatedAt: c.updatedAt.toISOString(),
    })
  }

  // FoiaRequests — full sync
  const foiaWhere = since
    ? { projectId, updatedAt: { gt: since } }
    : { projectId }
  const foias = await prisma.foiaRequest.findMany({ where: foiaWhere })
  for (const f of foias) {
    records.push({
      table: 'FoiaRequest',
      id: f.id,
      data: f as unknown as Record<string, unknown>,
      updatedAt: f.updatedAt.toISOString(),
    })
  }

  return { fromInstanceId: identity.id, projectId, sentAt, records }
}

// ── Inbound apply ─────────────────────────────────────────────────────────────

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
    default:
      console.warn(`[collab] Unknown sync table: ${record.table}`)
      return false
  }
}

// ── Per-table apply logic ─────────────────────────────────────────────────────

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

// ── Conflict logging ──────────────────────────────────────────────────────────

async function logConflict(args: {
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

// ── Outbound push ─────────────────────────────────────────────────────────────

/**
 * Pushes local changes for `projectId` to a peer at `peerUrl`.
 * Updates SyncState on success.
 */
export async function pushToPeer(
  projectId: string,
  peerId: string,
  peerUrl: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const identity = await getOrCreateIdentity()
    const syncState = await prisma.syncState.findUnique({
      where: { projectId_peerId: { projectId, peerId } },
    })
    const since = syncState?.lastSync ?? null

    const partialPayload = await buildSyncPayload(projectId, since)
    if (partialPayload.records.length === 0) return { ok: true }

    const privateKeyPem = getPrivateKeyPem(identity.privateKeyEncrypted)
    const signature = signPayload(partialPayload, privateKeyPem)
    const payload: SyncPayload = { ...partialPayload, signature }

    const res = await fetch(`${peerUrl}/api/collab/sync/${projectId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Collab-From': identity.id,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${body}` }
    }

    // Update sync state
    await prisma.syncState.upsert({
      where: { projectId_peerId: { projectId, peerId } },
      update: { lastSync: new Date(), status: 'idle' },
      create: { projectId, peerId, lastSync: new Date(), status: 'idle' },
    })

    return { ok: true }
  } catch (err) {
    await prisma.syncState.upsert({
      where: { projectId_peerId: { projectId, peerId } },
      update: { status: 'error' },
      create: { projectId, peerId, status: 'error' },
    })
    return { ok: false, error: String(err) }
  }
}

/**
 * Pushes to all trusted peers for a project. Called from the periodic sync
 * loop or manually triggered via the API.
 */
export async function pushToAllPeers(projectId: string): Promise<void> {
  const shares = await prisma.projectShare.findMany({ where: { projectId } })
  for (const share of shares) {
    const peer = await prisma.peer.findUnique({ where: { id: share.peerId } })
    if (!peer?.trusted) continue
    const peerUrl = peer.tunnelUrl ?? peer.localUrl
    if (!peerUrl) continue
    await pushToPeer(projectId, peer.id, peerUrl)
  }
}
