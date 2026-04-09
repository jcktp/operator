/**
 * mDNS peer discovery for Operator collaboration.
 *
 * Broadcasts this instance on the local network using _operator._tcp.local
 * and maintains a cache of discovered nearby peers.
 *
 * Depends on the `multicast-dns` package (npm install multicast-dns).
 * Runs server-side only (Node.js runtime). Called from instrumentation.ts.
 */

import { createRequire } from 'module'
import type { NearbyPeer } from './types'
import { getLocalNetworkUrl } from '@/lib/tunnel'

// Declaration for the optional multicast-dns package
interface MdnsAnswer { name: string; type: string; data: unknown }
interface MdnsQuestion { name: string; type: string }
interface MdnsResponse { answers: MdnsAnswer[]; address?: string }
interface MdnsQuery { questions: MdnsQuestion[] }
interface MdnsSocket {
  respond(opts: { answers: MdnsAnswer[] }): void
  query(opts: { questions: MdnsQuestion[] }): void
  on(event: 'response', h: (r: MdnsResponse) => void): void
  on(event: 'query', h: (q: MdnsQuery) => void): void
  destroy?(): void
}

const _req = createRequire(import.meta.url)

const SERVICE_TYPE = '_operator._tcp.local'
const ANNOUNCE_INTERVAL_MS = 30_000
const PEER_TIMEOUT_MS = 90_000          // remove peers not seen in 90 s

const _nearbyCache = new Map<string, NearbyPeer>()
let _mdns: MdnsSocket | null = null
let _announceTimer: ReturnType<typeof setInterval> | null = null

interface MdnsPayload {
  instanceId: string
  displayName: string
  version: string
  port: number
  sharedProjectIds: string[]
}

function buildPayload(
  instanceId: string,
  displayName: string,
  sharedProjectIds: string[]
): MdnsPayload {
  return {
    instanceId,
    displayName,
    version: '0.1',
    port: 3000,
    sharedProjectIds,
  }
}

/** Returns a snapshot of currently visible nearby peers. */
export function getNearbyPeers(): NearbyPeer[] {
  const cutoff = Date.now() - PEER_TIMEOUT_MS
  for (const [id, peer] of _nearbyCache.entries()) {
    if (new Date(peer.seenAt).getTime() < cutoff) _nearbyCache.delete(id)
  }
  return Array.from(_nearbyCache.values())
}

/** Starts the mDNS broadcaster + listener. Call once from instrumentation.ts. */
export async function startMdns(
  instanceId: string,
  displayName: string,
  getSharedProjectIds: () => Promise<string[]>
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mdnsFn: ((...args: unknown[]) => MdnsSocket) | null = null
  try {
    // Use createRequire so Turbopack does not statically analyse this import
    // and fail the build when multicast-dns is not yet installed.
    const mod = _req('multicast-dns') as ((...args: unknown[]) => MdnsSocket) | { default: (...args: unknown[]) => MdnsSocket }
    mdnsFn = typeof mod === 'function' ? mod : (mod as { default: (...args: unknown[]) => MdnsSocket }).default
  } catch {
    console.warn('[collab] multicast-dns not installed — mDNS discovery disabled')
    return
  }

  const localUrl = getLocalNetworkUrl(3000) ?? `http://localhost:3000`
  const m: MdnsSocket = mdnsFn()
  _mdns = m

  const announce = async () => {
    const sharedProjectIds = await getSharedProjectIds()
    const payload = buildPayload(instanceId, displayName, sharedProjectIds)
    const txt = Buffer.from(JSON.stringify(payload), 'utf8')
    m.respond({
      answers: [
        {
          name: SERVICE_TYPE,
          type: 'TXT',
          data: txt,
        },
      ],
    })
  }

  m.on('response', (response: MdnsResponse) => {
    for (const answer of response.answers) {
      if (answer.name !== SERVICE_TYPE || answer.type !== 'TXT') continue
      try {
        const raw = Buffer.isBuffer(answer.data)
          ? (answer.data as Buffer).toString('utf8')
          : String(answer.data)
        const payload = JSON.parse(raw) as MdnsPayload
        if (!payload.instanceId || payload.instanceId === instanceId) continue
        const peer: NearbyPeer = {
          instanceId: payload.instanceId,
          displayName: payload.displayName ?? 'Unknown',
          version: payload.version ?? '',
          localUrl: `http://${response.address ?? 'unknown'}:${payload.port ?? 3000}`,
          sharedProjectIds: payload.sharedProjectIds ?? [],
          seenAt: new Date().toISOString(),
        }
        _nearbyCache.set(peer.instanceId, peer)
      } catch {
        // malformed — ignore
      }
    }
  })

  m.on('query', (query: MdnsQuery) => {
    if (query.questions.some(q => q.name === SERVICE_TYPE)) {
      announce().catch(() => {})
    }
  })

  // Initial announce + periodic
  await announce()
  _announceTimer = setInterval(() => announce().catch(() => {}), ANNOUNCE_INTERVAL_MS)

  // Probe for peers immediately
  m.query({ questions: [{ name: SERVICE_TYPE, type: 'TXT' }] })

  console.log(`[collab] mDNS started — ${localUrl} (${instanceId})`)
}

export function stopMdns(): void {
  if (_announceTimer) { clearInterval(_announceTimer); _announceTimer = null }
  if (_mdns) { _mdns.destroy?.(); _mdns = null }
}
