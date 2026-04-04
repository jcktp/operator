import { pbkdf2Sync, randomBytes, createHash } from 'crypto'
import { prisma } from './db'

/** Hash a session token for storage — SHA-256 is sufficient since tokens are already high-entropy random bytes. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const SESSION_COOKIE = 'op_session'
export const MAX_ATTEMPTS = 3

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const h = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex')
  return h === hash
}

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export async function isSetupComplete(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: 'auth_setup_complete' } })
  return row?.value === 'true'
}

export async function getFailedAttempts(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: 'auth_failed_attempts' } })
  return parseInt(row?.value ?? '0')
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const row = await prisma.setting.findUnique({ where: { key: 'auth_session_token' } })
  if (!row?.value) return false
  // Compare hashed token (new sessions store the hash)
  // Also accept raw match for any existing session created before this change
  return row.value === hashToken(token) || row.value === token
}

async function upsert(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { id: crypto.randomUUID(), key, value },
  })
}

export async function createSession(): Promise<string> {
  const token = generateToken()
  await upsert('auth_session_token', hashToken(token))  // store hash, not raw token
  await upsert('auth_failed_attempts', '0')
  return token  // return raw token for the cookie
}

export async function setupAuth(name: string, role: string, password: string, mode?: string): Promise<string> {
  const hash = hashPassword(password)
  const token = generateToken()
  await Promise.all([
    upsert('auth_password_hash', hash),
    upsert('auth_session_token', hashToken(token)),
    upsert('auth_failed_attempts', '0'),
    upsert('auth_setup_complete', 'true'),
    name ? upsert('ceo_name', name) : Promise.resolve(),
    role ? upsert('user_role', role) : Promise.resolve(),
    mode ? upsert('app_mode', mode) : Promise.resolve(),
  ])
  return token
}
