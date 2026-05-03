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
 *   JournalEntry    — gated on shared===true; full sync; updatedAt for LWW
 *   EntryStructure  — only when parent JournalEntry is shared; full sync; updatedAt for LWW
 */

import { prisma } from '@/lib/db'
import type { SyncPayload, SyncRecord } from './types'
import { getOrCreateIdentity } from './identity'
import { getTunnelUrl, getLocalNetworkUrl } from '@/lib/tunnel'

// Re-export sub-modules so existing imports from '@/lib/collab/sync' keep working
export { applySyncPayload, logConflict, CONFLICT_WINDOW_MS } from './sync-apply'
export { pushToPeer, pushToAllPeers, isLanOnly } from './sync-push'

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

  // ChatMessages — append-only (edits bump updatedAt)
  const chatWhere = since
    ? { projectId, updatedAt: { gt: since } }
    : { projectId }
  const chatMsgs = await prisma.chatMessage.findMany({ where: chatWhere })
  for (const msg of chatMsgs) {
    records.push({
      table: 'ChatMessage',
      id: msg.id,
      data: msg as unknown as Record<string, unknown>,
      updatedAt: msg.updatedAt.toISOString(),
    })
  }

  // JournalEntries — only those with shared=true (per-entry opt-in)
  const journalWhere = since
    ? { projectId, shared: true, updatedAt: { gt: since } }
    : { projectId, shared: true }
  const entries = await prisma.journalEntry.findMany({
    where: journalWhere,
    include: { structure: true },
  })
  for (const entry of entries) {
    const { structure, ...entryData } = entry
    records.push({
      table: 'JournalEntry',
      id: entry.id,
      data: entryData as unknown as Record<string, unknown>,
      updatedAt: entry.updatedAt.toISOString(),
    })
    if (structure) {
      records.push({
        table: 'EntryStructure',
        id: structure.id,
        data: structure as unknown as Record<string, unknown>,
        updatedAt: structure.updatedAt.toISOString(),
      })
    }
  }

  const { isLanOnly } = await import('./sync-push')
  const lanOnly = await isLanOnly()
  return {
    fromInstanceId: identity.id,
    projectId,
    sentAt,
    records,
    senderInfo: {
      publicKey: identity.publicKey,
      displayName: identity.displayName,
      tunnelUrl: lanOnly ? null : getTunnelUrl(),
      localUrl: getLocalNetworkUrl(3000),
    },
  }
}
