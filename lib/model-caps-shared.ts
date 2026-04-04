/**
 * Static model capability data — safe to import in both server and client code.
 * No Node.js-specific imports. Server-side utilities (RAM check, routing) live
 * in lib/model-capabilities.ts which imports from this file.
 */

export interface ModelCaps {
  vision: boolean
  audio: boolean
  /** Native context window in tokens */
  contextWindow: number
  /** Approximate disk/VRAM footprint in GB (0 = unknown) */
  sizeGB: number
}

export const MODEL_CAPS_REGISTRY: Record<string, ModelCaps> = {
  // ── Text-only ──────────────────────────────────────────────────────────────
  'phi4-mini':        { vision: false, audio: false, contextWindow:  16_384, sizeGB: 2.5 },
  'phi4':             { vision: false, audio: false, contextWindow:  16_384, sizeGB: 9.0 },
  'phi3':             { vision: false, audio: false, contextWindow:   4_096, sizeGB: 2.3 },
  'phi3.5':           { vision: false, audio: false, contextWindow:   8_192, sizeGB: 2.2 },
  'qwen3:0.6b':       { vision: false, audio: false, contextWindow:  32_768, sizeGB: 0.5 },
  'qwen3:1.7b':       { vision: false, audio: false, contextWindow:  32_768, sizeGB: 1.2 },
  'qwen3:4b':         { vision: false, audio: false, contextWindow:  32_768, sizeGB: 2.6 },
  'qwen3:8b':         { vision: false, audio: false, contextWindow:  32_768, sizeGB: 5.2 },
  'qwen3:14b':        { vision: false, audio: false, contextWindow:  32_768, sizeGB: 9.3 },
  'qwen2.5:3b':       { vision: false, audio: false, contextWindow:  32_768, sizeGB: 2.0 },
  'qwen2.5:7b':       { vision: false, audio: false, contextWindow:  32_768, sizeGB: 4.7 },
  'llama3.2:1b':      { vision: false, audio: false, contextWindow: 131_072, sizeGB: 1.3 },
  'llama3.2:3b':      { vision: false, audio: false, contextWindow: 131_072, sizeGB: 2.0 },
  'llama3.1:8b':      { vision: false, audio: false, contextWindow: 131_072, sizeGB: 4.9 },
  'llama3.3:70b':     { vision: false, audio: false, contextWindow: 131_072, sizeGB: 42.0 },
  'gemma2:2b':        { vision: false, audio: false, contextWindow:   8_192, sizeGB: 1.6 },
  'gemma2:9b':        { vision: false, audio: false, contextWindow:   8_192, sizeGB: 5.4 },
  'gemma2:27b':       { vision: false, audio: false, contextWindow:   8_192, sizeGB: 16.0 },
  'mistral:7b':       { vision: false, audio: false, contextWindow:  32_768, sizeGB: 4.1 },
  'mistral:latest':   { vision: false, audio: false, contextWindow:  32_768, sizeGB: 4.1 },
  'deepseek-r1:1.5b': { vision: false, audio: false, contextWindow: 131_072, sizeGB: 1.1 },
  'deepseek-r1:7b':   { vision: false, audio: false, contextWindow: 131_072, sizeGB: 4.7 },
  // ── Vision-only ────────────────────────────────────────────────────────────
  'llava':            { vision: true,  audio: false, contextWindow:   4_096, sizeGB: 4.7 },
  'llava:7b':         { vision: true,  audio: false, contextWindow:   4_096, sizeGB: 4.7 },
  'llava:13b':        { vision: true,  audio: false, contextWindow:   4_096, sizeGB: 8.0 },
  'llava-phi3':       { vision: true,  audio: false, contextWindow:   4_096, sizeGB: 2.9 },
  'llava-llama3':     { vision: true,  audio: false, contextWindow:   8_192, sizeGB: 4.7 },
  'moondream':        { vision: true,  audio: false, contextWindow:   2_048, sizeGB: 1.7 },
  'minicpm-v':        { vision: true,  audio: false, contextWindow:   8_192, sizeGB: 5.5 },
  'qwen2-vl:7b':      { vision: true,  audio: false, contextWindow:  32_768, sizeGB: 4.4 },
  // ── Audio + Vision ─────────────────────────────────────────────────────────
  'gemma4:e2b':       { vision: true,  audio: true,  contextWindow: 131_072, sizeGB: 7.2 },
  'gemma4:e4b':       { vision: true,  audio: true,  contextWindow: 131_072, sizeGB: 9.6 },
  // Larger gemma4 — vision but no audio encoder
  'gemma4:12b':       { vision: true,  audio: false, contextWindow: 131_072, sizeGB: 7.9 },
  'gemma4:27b':       { vision: true,  audio: false, contextWindow: 131_072, sizeGB: 17.1 },
}

/**
 * Look up capability profile for a model (exact match, then prefix match).
 */
export function getModelCapsClient(modelId: string): ModelCaps {
  const lower = modelId.toLowerCase().replace(/:latest$/, '')
  if (MODEL_CAPS_REGISTRY[lower]) return MODEL_CAPS_REGISTRY[lower]
  for (const [key, caps] of Object.entries(MODEL_CAPS_REGISTRY)) {
    if (lower.startsWith(key) || key.startsWith(lower)) return caps
  }
  return { vision: false, audio: false, contextWindow: 8_192, sizeGB: 0 }
}

/**
 * Per-model RAM warning for client use.
 * @param modelId  Model ID to check
 * @param ramGb    System RAM in GB (fetched from /api/health machine.ramGb)
 */
export function modelRamWarning(
  modelId: string,
  ramGb: number,
): { level: 'warn' | 'error'; message: string } | null {
  const caps = getModelCapsClient(modelId)
  if (caps.sizeGB === 0) return null
  const needed = caps.sizeGB * 1.3
  if (needed > ramGb) {
    return {
      level: 'error',
      message: `Needs ~${caps.sizeGB} GB — your machine has ${ramGb} GB RAM. It likely won't load.`,
    }
  }
  if (needed > ramGb * 0.75) {
    return {
      level: 'warn',
      message: `Uses ~${caps.sizeGB} GB of your ${ramGb} GB RAM — will run but may be slow.`,
    }
  }
  return null
}

/** Format context window as a human-readable string. */
export function formatContextWindow(tokens: number): string {
  if (tokens >= 131_072) return '128K ctx'
  if (tokens >= 32_768) return '32K ctx'
  if (tokens >= 16_384) return '16K ctx'
  if (tokens >= 8_192)  return '8K ctx'
  if (tokens >= 4_096)  return '4K ctx'
  return `${Math.round(tokens / 1024)}K ctx`
}
