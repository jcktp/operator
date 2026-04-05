/**
 * Integration tests for lib/auth.ts — functions that read and write the database.
 * Uses a real SQLite test database (created in globalSetup).
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { createTestClient } from '../helpers/db.js'

// ── DB mock ───────────────────────────────────────────────────────────────────
// Declare module-level variable; the getter pattern lets vi.mock capture it lazily
// so the actual client can be assigned in beforeAll (after the mock is registered).
let _prisma: PrismaClient

vi.mock('@/lib/db', () => ({
  get prisma() { return _prisma },
}))

// Static imports of the module under test — they will receive the mocked @/lib/db
import {
  setupAuth,
  isValidSession,
  createSession,
  getFailedAttempts,
  hashPassword,
} from '@/lib/auth'

// ── Test lifecycle ────────────────────────────────────────────────────────────

beforeAll(() => {
  _prisma = createTestClient()
})

afterAll(async () => {
  await _prisma.$disconnect()
})

beforeEach(async () => {
  // Wipe auth-related settings between tests for full isolation
  await _prisma.setting.deleteMany()
})

// ── setupAuth ─────────────────────────────────────────────────────────────────

describe('setupAuth', () => {
  it('creates auth settings in the database and returns a token', async () => {
    const token = await setupAuth('Alice', 'Editor', 'password123')
    expect(typeof token).toBe('string')
    expect(token.length).toBe(64)

    const rows = await _prisma.setting.findMany()
    const keys = rows.map(r => r.key)

    expect(keys).toContain('auth_password_hash')
    expect(keys).toContain('auth_session_token')
    expect(keys).toContain('auth_failed_attempts')
    expect(keys).toContain('auth_setup_complete')
    expect(keys).toContain('ceo_name')
    expect(keys).toContain('user_role')
  })

  it('stores auth_setup_complete = "true"', async () => {
    await setupAuth('Bob', 'Admin', 'pass456')
    const row = await _prisma.setting.findUnique({ where: { key: 'auth_setup_complete' } })
    expect(row?.value).toBe('true')
  })

  it('stores the password as a hash, not plaintext', async () => {
    const password = 'super-secret'
    await setupAuth('Carol', 'Viewer', password)
    const row = await _prisma.setting.findUnique({ where: { key: 'auth_password_hash' } })
    expect(row?.value).not.toBe(password)
    expect(row?.value).toContain(':') // salt:hash format
  })

  it('stores the session token as a SHA-256 hash, not the raw token', async () => {
    const token = await setupAuth('Dan', 'Lead', 'pass789')
    const row = await _prisma.setting.findUnique({ where: { key: 'auth_session_token' } })
    // The stored value should be the hash, not the raw token
    expect(row?.value).not.toBe(token)
    expect(row?.value?.length).toBe(64) // SHA-256 hex = 64 chars
  })

  it('stores the optional appMode when provided', async () => {
    await setupAuth('Eve', 'Analyst', 'pass', 'journalism')
    const row = await _prisma.setting.findUnique({ where: { key: 'app_mode' } })
    expect(row?.value).toBe('journalism')
  })

  it('resets failed attempts to 0', async () => {
    await setupAuth('Frank', 'Dev', 'mypass')
    const row = await _prisma.setting.findUnique({ where: { key: 'auth_failed_attempts' } })
    expect(row?.value).toBe('0')
  })
})

// ── isValidSession ────────────────────────────────────────────────────────────

describe('isValidSession', () => {
  it('returns true for a valid session token created by setupAuth', async () => {
    const token = await setupAuth('Grace', 'Admin', 'password')
    expect(await isValidSession(token)).toBe(true)
  })

  it('returns false for an incorrect token', async () => {
    await setupAuth('Heidi', 'Admin', 'password')
    expect(await isValidSession('wrong-token-value')).toBe(false)
  })

  it('returns false for undefined', async () => {
    await setupAuth('Ivan', 'Admin', 'password')
    expect(await isValidSession(undefined)).toBe(false)
  })

  it('returns false when no session exists in the DB', async () => {
    // No setupAuth called — DB is empty
    expect(await isValidSession('any-token')).toBe(false)
  })

  it('returns true for a token created by createSession', async () => {
    // Set up initial auth first (createSession needs auth_session_token to exist)
    await setupAuth('Judy', 'Admin', 'password')
    const newToken = await createSession()
    expect(await isValidSession(newToken)).toBe(true)
  })
})

// ── createSession ─────────────────────────────────────────────────────────────

describe('createSession', () => {
  it('returns a new 64-char hex token', async () => {
    await setupAuth('Karl', 'Admin', 'password') // ensure DB is ready
    const token = await createSession()
    expect(token).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(token)).toBe(true)
  })

  it('stores the new session as a hash and invalidates the previous one', async () => {
    const firstToken = await setupAuth('Lena', 'Admin', 'password')
    const secondToken = await createSession()

    // Old token should no longer be valid
    expect(await isValidSession(firstToken)).toBe(false)
    // New token should be valid
    expect(await isValidSession(secondToken)).toBe(true)
  })

  it('resets failed attempts to 0', async () => {
    await setupAuth('Mike', 'Admin', 'password')
    // Simulate some failed attempts
    await _prisma.setting.upsert({
      where: { key: 'auth_failed_attempts' },
      update: { value: '2' },
      create: { key: 'auth_failed_attempts', value: '2' },
    })
    await createSession()
    const row = await _prisma.setting.findUnique({ where: { key: 'auth_failed_attempts' } })
    expect(row?.value).toBe('0')
  })
})

// ── getFailedAttempts ─────────────────────────────────────────────────────────

describe('getFailedAttempts', () => {
  it('returns 0 when no record exists', async () => {
    expect(await getFailedAttempts()).toBe(0)
  })

  it('returns the stored count', async () => {
    await _prisma.setting.create({
      data: { key: 'auth_failed_attempts', value: '2' },
    })
    expect(await getFailedAttempts()).toBe(2)
  })
})
