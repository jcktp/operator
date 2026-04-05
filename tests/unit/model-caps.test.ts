import { describe, it, expect } from 'vitest'
import {
  getModelCapsClient,
  modelRamWarning,
  formatContextWindow,
  MODEL_CAPS_REGISTRY,
} from '@/lib/model-caps-shared'

// ── getModelCapsClient ────────────────────────────────────────────────────────

describe('getModelCapsClient', () => {
  it('returns caps for an exact registry match', () => {
    const caps = getModelCapsClient('phi4-mini')
    expect(caps.vision).toBe(false)
    expect(caps.audio).toBe(false)
    expect(caps.contextWindow).toBe(16_384)
    expect(caps.sizeGB).toBe(2.5)
  })

  it('strips :latest suffix before looking up', () => {
    const caps = getModelCapsClient('mistral:latest')
    const direct = getModelCapsClient('mistral:7b')
    // Both should return a valid entry (not fallback)
    expect(caps.sizeGB).toBeGreaterThan(0)
    expect(caps.contextWindow).toBeGreaterThan(0)
  })

  it('is case-insensitive', () => {
    const lower = getModelCapsClient('phi4-mini')
    const upper = getModelCapsClient('PHI4-MINI')
    expect(lower).toEqual(upper)
  })

  it('returns vision=true for a vision model', () => {
    const caps = getModelCapsClient('llava-phi3')
    expect(caps.vision).toBe(true)
  })

  it('returns audio=true for a multimodal model with audio', () => {
    const caps = getModelCapsClient('gemma4:e2b')
    expect(caps.audio).toBe(true)
    expect(caps.vision).toBe(true)
  })

  it('returns the default fallback for an unrecognised model', () => {
    const caps = getModelCapsClient('some-unknown-model:99b')
    expect(caps.vision).toBe(false)
    expect(caps.audio).toBe(false)
    expect(caps.contextWindow).toBe(8_192)
    expect(caps.sizeGB).toBe(0)
  })

  it('all registry entries have non-negative contextWindow and sizeGB', () => {
    for (const [model, caps] of Object.entries(MODEL_CAPS_REGISTRY)) {
      expect(caps.contextWindow, `contextWindow for ${model}`).toBeGreaterThanOrEqual(0)
      expect(caps.sizeGB, `sizeGB for ${model}`).toBeGreaterThanOrEqual(0)
    }
  })
})

// ── modelRamWarning ───────────────────────────────────────────────────────────

describe('modelRamWarning', () => {
  it('returns null when model fits comfortably in available RAM', () => {
    // phi4-mini needs ~2.5 GB × 1.3 = 3.25 GB; machine has 32 GB → fits fine
    expect(modelRamWarning('phi4-mini', 32)).toBeNull()
  })

  it('returns a warn-level warning when model uses > 75% of RAM', () => {
    // phi4-mini (2.5 GB) on a 4 GB machine: needs 3.25 GB → > 75% of 4 = 3 GB
    const w = modelRamWarning('phi4-mini', 4)
    expect(w).not.toBeNull()
    expect(w!.level).toBe('warn')
    expect(w!.message).toContain('GB')
  })

  it('returns an error-level warning when model exceeds available RAM', () => {
    // llama3.3:70b (42 GB) on a 16 GB machine: needs 54.6 GB → exceeds 16 GB
    const w = modelRamWarning('llama3.3:70b', 16)
    expect(w).not.toBeNull()
    expect(w!.level).toBe('error')
    expect(w!.message).toContain('won\'t load')
  })

  it('returns null for models with sizeGB = 0 (unknown size)', () => {
    // Unknown models return sizeGB = 0 → no warning possible
    expect(modelRamWarning('unknown-model', 8)).toBeNull()
  })

  it('returns null for unknown models (sizeGB = 0)', () => {
    expect(modelRamWarning('some-unknown-model', 8)).toBeNull()
  })
})

// ── formatContextWindow ───────────────────────────────────────────────────────

describe('formatContextWindow', () => {
  it('returns "128K ctx" for 131072+ tokens', () => {
    expect(formatContextWindow(131_072)).toBe('128K ctx')
    expect(formatContextWindow(200_000)).toBe('128K ctx')
  })

  it('returns "32K ctx" for 32768–131071 tokens', () => {
    expect(formatContextWindow(32_768)).toBe('32K ctx')
  })

  it('returns "16K ctx" for 16384–32767 tokens', () => {
    expect(formatContextWindow(16_384)).toBe('16K ctx')
  })

  it('returns "8K ctx" for 8192–16383 tokens', () => {
    expect(formatContextWindow(8_192)).toBe('8K ctx')
  })

  it('returns "4K ctx" for 4096–8191 tokens', () => {
    expect(formatContextWindow(4_096)).toBe('4K ctx')
  })

  it('returns an approximate value for smaller windows', () => {
    const result = formatContextWindow(2_048)
    expect(result).toContain('ctx')
    expect(result).toContain('2')
  })
})
