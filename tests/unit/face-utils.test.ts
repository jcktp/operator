/**
 * Unit tests for lib/face-utils.ts
 * Pure functions only — no DB, no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { homedir } from 'os'
import { join } from 'path'

// ── Mock reports-folder so getReportsRoot() returns a fixed value in tests ────
const MOCK_ROOT = join(homedir(), 'Documents', 'Operator Reports')

vi.mock('@/lib/reports-folder', () => ({
  getReportsRoot: () => MOCK_ROOT,
}))

import {
  validateImagePath,
  parseBbox,
  serializeEmbedding,
  deserializeEmbedding,
} from '@/lib/media/face-utils'

// ── validateImagePath ─────────────────────────────────────────────────────────

describe('validateImagePath', () => {
  it('accepts a path inside the reports root', () => {
    const valid = join(MOCK_ROOT, 'Story Alpha', 'Photos', 'photo.jpg')
    expect(validateImagePath(valid)).toBe(true)
  })

  it('rejects a path traversal to /etc/passwd', () => {
    expect(validateImagePath('/etc/passwd')).toBe(false)
  })

  it('rejects a relative traversal that escapes the root', () => {
    const malicious = join(MOCK_ROOT, '..', '..', 'etc', 'passwd')
    expect(validateImagePath(malicious)).toBe(false)
  })

  it('rejects a path that is exactly the root (not inside it)', () => {
    expect(validateImagePath(MOCK_ROOT)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(validateImagePath('')).toBe(false)
  })
})

// ── parseBbox ─────────────────────────────────────────────────────────────────

describe('parseBbox', () => {
  it('parses a valid [x, y, w, h] array', () => {
    expect(parseBbox('[10, 20, 80, 90]')).toEqual([10, 20, 80, 90])
  })

  it('parses floating-point values', () => {
    expect(parseBbox('[0.5, 1.5, 40.0, 50.25]')).toEqual([0.5, 1.5, 40.0, 50.25])
  })

  it('returns null for an array with wrong length', () => {
    expect(parseBbox('[10, 20, 80]')).toBeNull()
    expect(parseBbox('[10, 20, 80, 90, 100]')).toBeNull()
  })

  it('returns null for a non-array JSON value', () => {
    expect(parseBbox('{"x":10}')).toBeNull()
    expect(parseBbox('"string"')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseBbox('not json')).toBeNull()
  })

  it('returns null if any element is not a finite number', () => {
    expect(parseBbox('[10, 20, null, 90]')).toBeNull()
    expect(parseBbox('[10, 20, "a", 90]')).toBeNull()
  })
})

// ── serializeEmbedding / deserializeEmbedding round-trip ─────────────────────

describe('serializeEmbedding', () => {
  it('serializes a float array to a JSON string', () => {
    const emb = [0.1, 0.2, 0.3]
    const json = serializeEmbedding(emb)
    expect(typeof json).toBe('string')
    expect(JSON.parse(json)).toEqual(emb)
  })

  it('handles an empty array', () => {
    expect(serializeEmbedding([])).toBe('[]')
  })
})

describe('deserializeEmbedding', () => {
  it('deserializes a JSON string back to a float array', () => {
    const emb = [0.12, 0.34, 0.56]
    expect(deserializeEmbedding(JSON.stringify(emb))).toEqual(emb)
  })
})

describe('round-trip: serialize → deserialize', () => {
  it('reconstructs the original 512-dim embedding', () => {
    const original = Array.from({ length: 512 }, (_, i) => i / 512)
    const json = serializeEmbedding(original)
    const recovered = deserializeEmbedding(json)
    expect(recovered).toHaveLength(512)
    expect(recovered[0]).toBeCloseTo(original[0], 10)
    expect(recovered[511]).toBeCloseTo(original[511], 10)
  })
})
