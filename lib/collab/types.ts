/** A single record in a sync payload. */
export interface SyncRecord {
  table: string
  id: string
  data: Record<string, unknown>
  updatedAt: string   // ISO 8601
  removed?: boolean
  removedBy?: string
  removedAt?: string
}

/** Full payload sent from one instance to another during sync. */
export interface SyncPayload {
  fromInstanceId: string
  projectId: string
  sentAt: string          // ISO 8601 timestamp of when the payload was built
  records: SyncRecord[]
  signature: string       // hex — signs fromInstanceId+projectId+sentAt+SHA256(records JSON)
}

/** Serialisable peer descriptor stored in the mDNS cache. */
export interface NearbyPeer {
  instanceId: string
  displayName: string
  version: string
  localUrl: string
  sharedProjectIds: string[]
  seenAt: string
}

/** Decoded invite string. */
export interface InviteData {
  instanceId: string
  publicKey: string       // PEM
  tunnelUrl: string | null
  displayName: string
}
