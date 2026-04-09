import type { InviteData } from './types'

/** Encodes an invite string from identity + current tunnel URL. */
export function encodeInvite(data: InviteData): string {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')
}

/** Decodes an invite string. Returns null if invalid. */
export function decodeInvite(raw: string): InviteData | null {
  try {
    const json = Buffer.from(raw.trim(), 'base64url').toString('utf8')
    const parsed = JSON.parse(json) as Partial<InviteData>
    if (!parsed.instanceId || !parsed.publicKey) return null
    return parsed as InviteData
  } catch {
    return null
  }
}
