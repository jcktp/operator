/**
 * Outbound sync: pushes local changes to peers.
 */

import { prisma } from '@/lib/db'
import type { SyncPayload } from './types'
import { getOrCreateIdentity, getPrivateKeyPem } from './identity'
import { signPayload } from './signing'
import { buildSyncPayload } from './sync'

// ── Helpers ──────────────────────────────────────────────────────────────────

export async function isLanOnly(): Promise<boolean> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'collab_lan_only' } })
    return row?.value === 'true'
  } catch { return false }
}

// ── Push to a single peer ────────────────────────────────────────────────────

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

    // 202 = receiver got the intro, not yet trusted — not an error
    if (res.status === 202) return { ok: true }

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

// ── Push to all peers ────────────────────────────────────────────────────────

/**
 * Pushes to all trusted peers for a project. Called from the periodic sync
 * loop or manually triggered via the API.
 */
export async function pushToAllPeers(projectId: string): Promise<void> {
  const [shares, lanOnly] = await Promise.all([
    prisma.projectShare.findMany({ where: { projectId } }),
    isLanOnly(),
  ])
  for (const share of shares) {
    const peer = await prisma.peer.findUnique({ where: { id: share.peerId } })
    if (!peer?.trusted) continue
    // LAN-only: skip peers that only have a tunnel URL, use local URL only
    const peerUrl = lanOnly ? peer.localUrl : (peer.tunnelUrl ?? peer.localUrl)
    if (!peerUrl) continue
    await pushToPeer(projectId, peer.id, peerUrl)
  }
}
