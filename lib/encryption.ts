import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { readFileSync, writeFileSync, chmodSync, existsSync } from 'fs'
import { join } from 'path'

const KEY_FILE = join(process.cwd(), 'prisma', '.operator_key')

let _key: Buffer | null = null

function getKey(): Buffer {
  if (_key) return _key
  if (existsSync(KEY_FILE)) {
    _key = Buffer.from(readFileSync(KEY_FILE, 'utf8').trim(), 'hex')
    return _key
  }
  const key = randomBytes(32)
  writeFileSync(KEY_FILE, key.toString('hex'), 'utf8')
  try { chmodSync(KEY_FILE, 0o600) } catch { /* non-POSIX fs — ignore */ }
  _key = key
  return key
}

/** Encrypts a plaintext string using AES-256-GCM. Returns '' for empty input. */
export function encrypt(plaintext: string): string {
  if (!plaintext) return ''
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/** Decrypts an AES-256-GCM encrypted string.
 *  Returns the value as-is for legacy unencrypted values so existing data still works. */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return ''
  const parts = ciphertext.split(':')
  if (parts.length !== 3) return ciphertext // legacy plaintext — pass through
  try {
    const key = getKey()
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const data = Buffer.from(parts[2], 'hex')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(data).toString('utf8') + decipher.final('utf8')
  } catch {
    return ciphertext // decryption failed — treat as legacy plaintext
  }
}
