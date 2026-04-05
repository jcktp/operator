/**
 * Unit tests for the pure crypto functions in lib/auth.ts.
 * These functions have no database dependencies.
 */
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, generateToken } from '@/lib/auth'

describe('hashPassword', () => {
  it('returns a string in "salt:hash" format', () => {
    const result = hashPassword('my-password')
    expect(typeof result).toBe('string')
    const parts = result.split(':')
    expect(parts).toHaveLength(2)
    expect(parts[0].length).toBeGreaterThan(0) // salt
    expect(parts[1].length).toBeGreaterThan(0) // hash
  })

  it('produces different salts on each call (non-deterministic)', () => {
    const h1 = hashPassword('same')
    const h2 = hashPassword('same')
    // Same password → different salt → different stored value
    expect(h1).not.toBe(h2)
  })

  it('handles empty string passwords', () => {
    const result = hashPassword('')
    expect(result.includes(':')).toBe(true)
  })

  it('handles long passwords', () => {
    const long = 'a'.repeat(1000)
    const result = hashPassword(long)
    expect(result.includes(':')).toBe(true)
  })

  it('handles unicode passwords', () => {
    const result = hashPassword('pässwörd-日本語-🔑')
    expect(result.includes(':')).toBe(true)
  })
})

describe('verifyPassword', () => {
  it('returns true for the correct password', () => {
    const stored = hashPassword('correct-password')
    expect(verifyPassword('correct-password', stored)).toBe(true)
  })

  it('returns false for an incorrect password', () => {
    const stored = hashPassword('correct-password')
    expect(verifyPassword('wrong-password', stored)).toBe(false)
  })

  it('is case-sensitive', () => {
    const stored = hashPassword('Password')
    expect(verifyPassword('password', stored)).toBe(false)
    expect(verifyPassword('Password', stored)).toBe(true)
  })

  it('returns false for an empty stored value', () => {
    expect(verifyPassword('password', '')).toBe(false)
  })

  it('returns false for a malformed stored value (no colon)', () => {
    expect(verifyPassword('password', 'notasalthashformat')).toBe(false)
  })

  it('handles a round-trip with unicode passwords', () => {
    const pw = 'sécurité-密码-🔐'
    const stored = hashPassword(pw)
    expect(verifyPassword(pw, stored)).toBe(true)
    expect(verifyPassword('wrong', stored)).toBe(false)
  })
})

describe('generateToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateToken()
    expect(typeof token).toBe('string')
    expect(token).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(token)).toBe(true)
  })

  it('generates a different token on each call', () => {
    const tokens = new Set(Array.from({ length: 10 }, generateToken))
    expect(tokens.size).toBe(10)
  })
})
