import { createHash, sign, verify, createPrivateKey, createPublicKey } from 'crypto'
import type { SyncPayload } from './types'

/** Builds the canonical string that is signed / verified. */
function signingInput(payload: Omit<SyncPayload, 'signature'>): Buffer {
  const records = JSON.stringify(payload.records)
  const recordsHash = createHash('sha256').update(records).digest('hex')
  const canonical = [payload.fromInstanceId, payload.projectId, payload.sentAt, recordsHash].join('\n')
  return Buffer.from(canonical, 'utf8')
}

/** Signs a SyncPayload (minus the signature field) using the EC private key PEM. */
export function signPayload(
  payload: Omit<SyncPayload, 'signature'>,
  privateKeyPem: string
): string {
  const key = createPrivateKey(privateKeyPem)
  const sig = sign('SHA256', signingInput(payload), key)
  return sig.toString('hex')
}

/** Verifies the signature on an incoming SyncPayload. Returns true if valid. */
export function verifyPayload(payload: SyncPayload, publicKeyPem: string): boolean {
  try {
    const key = createPublicKey(publicKeyPem)
    const { signature, ...rest } = payload
    return verify('SHA256', signingInput(rest), key, Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}
