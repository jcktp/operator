import { pbkdf2Sync, randomBytes, createHash } from 'crypto'
import { prisma } from './db'

export interface RecoveryCodeStored {
  hash: string
  used: boolean
}

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

// ── Recovery codes ────────────────────────────────────────────────────────────

function hashCode(code: string): string {
  return createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex')
}

function generateOneCode(): string {
  const hex = randomBytes(5).toString('hex').toUpperCase()
  return `${hex.slice(0, 5)}-${hex.slice(5, 10)}`
}

export function generateRecoveryCodes(): { codes: string[]; stored: RecoveryCodeStored[] } {
  const codes: string[] = []
  const stored: RecoveryCodeStored[] = []
  for (let i = 0; i < 8; i++) {
    const code = generateOneCode()
    codes.push(code)
    stored.push({ hash: hashCode(code), used: false })
  }
  return { codes, stored }
}

export async function saveRecoveryCodes(stored: RecoveryCodeStored[]): Promise<void> {
  await upsert('auth_recovery_codes', JSON.stringify(stored))
}

export async function getRecoveryCodeStatus(): Promise<{ total: number; remaining: number }> {
  const row = await prisma.setting.findUnique({ where: { key: 'auth_recovery_codes' } })
  if (!row?.value) return { total: 0, remaining: 0 }
  const codes = JSON.parse(row.value) as RecoveryCodeStored[]
  return { total: codes.length, remaining: codes.filter(c => !c.used).length }
}

export async function validateAndConsumeRecoveryCode(code: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: 'auth_recovery_codes' } })
  if (!row?.value) return false
  const codes = JSON.parse(row.value) as RecoveryCodeStored[]
  const hash = hashCode(code)
  const idx = codes.findIndex(c => !c.used && c.hash === hash)
  if (idx === -1) return false
  codes[idx].used = true
  await upsert('auth_recovery_codes', JSON.stringify(codes))
  return true
}

export async function createPasswordResetToken(): Promise<string> {
  const token = generateToken()
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await Promise.all([
    upsert('auth_reset_token', hashToken(token)),
    upsert('auth_reset_token_expires', expires),
  ])
  return token
}

export async function consumePasswordResetToken(token: string): Promise<boolean> {
  const [tokenRow, expiresRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'auth_reset_token' } }),
    prisma.setting.findUnique({ where: { key: 'auth_reset_token_expires' } }),
  ])
  if (!tokenRow?.value || !expiresRow?.value) return false
  if (tokenRow.value !== hashToken(token)) return false
  if (new Date(expiresRow.value) < new Date()) return false
  await Promise.all([
    upsert('auth_reset_token', ''),
    upsert('auth_reset_token_expires', ''),
  ])
  return true
}

export async function updatePassword(newPassword: string): Promise<void> {
  await upsert('auth_password_hash', hashPassword(newPassword))
}

// ── Account setup ─────────────────────────────────────────────────────────────

export async function setupAuth(name: string, role: string, password: string, mode: string = 'journalism'): Promise<string> {
  const hash = hashPassword(password)
  const token = generateToken()
  await Promise.all([
    upsert('auth_password_hash', hash),
    upsert('auth_session_token', hashToken(token)),
    upsert('auth_failed_attempts', '0'),
    upsert('auth_setup_complete', 'true'),
    name ? upsert('ceo_name', name) : Promise.resolve(),
    role ? upsert('user_role', role) : Promise.resolve(),
    upsert('app_mode', mode),
  ])
  return token
}
