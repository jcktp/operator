import { createHash, generateKeyPairSync } from 'crypto'
import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/encryption'

/** Derives a short human-readable ID from a PEM public key string. */
export function deriveInstanceId(publicKeyPem: string): string {
  const hash = createHash('sha256').update(publicKeyPem).digest('hex')
  return `op-${hash.slice(0, 6)}`
}

/** Returns the existing identity row, or creates one if none exists. */
export async function getOrCreateIdentity(): Promise<{
  id: string
  publicKey: string
  privateKeyEncrypted: string
  displayName: string
}> {
  const existing = await prisma.instanceIdentity.findFirst()
  if (existing) return existing

  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  const id = deriveInstanceId(publicKey as string)
  const privateKeyEncrypted = encrypt(privateKey as string)

  // Read display name from settings if available
  const nameSetting = await prisma.setting.findUnique({ where: { key: 'ceo_name' } })
  const displayName = nameSetting?.value || 'Operator'

  const identity = await prisma.instanceIdentity.create({
    data: {
      id,
      publicKey: publicKey as string,
      privateKeyEncrypted,
      displayName,
    },
  })

  return identity
}

/** Returns the decrypted private key PEM for signing. */
export function getPrivateKeyPem(encrypted: string): string {
  return decrypt(encrypted)
}
