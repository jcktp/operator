/**
 * Server-side model capability utilities.
 * Uses Node.js `os` module — do NOT import in client components.
 * Client components should import from lib/model-caps-shared.ts instead.
 */

import { totalmem } from 'os'
import { getModelCapsClient, type ModelCaps } from './model-caps-shared'

export type { ModelCaps }
export { getModelCapsClient as getModelCaps }

// ── Dynamic context window lookup from Ollama ────────────────────────────────

const _ctxCache = new Map<string, number>()

/**
 * Fetch the context window for a model from Ollama's /api/show.
 * Falls back to the registry value if Ollama is unreachable.
 */
export async function fetchOllamaContextWindow(host: string, modelId: string): Promise<number> {
  const cacheKey = `${host}|${modelId}`
  if (_ctxCache.has(cacheKey)) return _ctxCache.get(cacheKey)!
  const fallback = getModelCapsClient(modelId).contextWindow
  try {
    const res = await fetch(`${host}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelId }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) { _ctxCache.set(cacheKey, fallback); return fallback }
    const data = await res.json() as {
      model_info?: { 'llama.context_length'?: number }
      parameters?: string
    }
    const fromInfo = data.model_info?.['llama.context_length']
    if (fromInfo && fromInfo > 0) { _ctxCache.set(cacheKey, fromInfo); return fromInfo }
    const paramMatch = data.parameters?.match(/num_ctx\s+(\d+)/i)
    if (paramMatch) {
      const n = parseInt(paramMatch[1], 10)
      _ctxCache.set(cacheKey, n)
      return n
    }
  } catch { /* ignore */ }
  _ctxCache.set(cacheKey, fallback)
  return fallback
}

/**
 * Maximum document characters to send per Ollama model call.
 * 70% of context window at ~4 chars/token, capped at 80k, min 4k.
 */
export function maxCharsForModel(modelId: string): number {
  const caps = getModelCapsClient(modelId)
  // Cap at 20K chars for local inference — large-context models (gemma4, llama3.2) can
  // technically handle 80K+ chars but local CPU/unified-memory inference is slow at that
  // size. 20K chars (~4-5K words) covers most real-world documents in a single pass.
  return Math.max(Math.min(Math.floor(caps.contextWindow * 4 * 0.70), 20_000), 4_000)
}

// ── RAM checks ───────────────────────────────────────────────────────────────

/** System total RAM in GB (server-side, reads from os.totalmem). */
export function getSystemRamGB(): number {
  return Math.round(totalmem() / (1024 ** 3) * 10) / 10
}

/**
 * Returns a severity + message if the model is risky given available RAM.
 * Returns null if the model looks fine.
 */
export function ramWarning(modelId: string): { level: 'warn' | 'error'; message: string } | null {
  const caps = getModelCapsClient(modelId)
  if (caps.sizeGB === 0) return null
  const ramGB = getSystemRamGB()
  const needed = caps.sizeGB * 1.3
  if (needed > ramGB) {
    return {
      level: 'error',
      message: `This model needs ~${caps.sizeGB} GB — your machine has ${ramGB} GB RAM. It likely won't load.`,
    }
  }
  if (needed > ramGB * 0.75) {
    return {
      level: 'warn',
      message: `This model uses ~${caps.sizeGB} GB of your ${ramGB} GB RAM — will run but may be slow.`,
    }
  }
  return null
}

// ── Model routing ─────────────────────────────────────────────────────────────

/**
 * Returns the model ID to use for image analysis (vision).
 * Prefers primary model if it supports vision; falls back to OLLAMA_VISION_MODEL.
 */
export function routeVisionModel(): string {
  const primary = (process.env.OLLAMA_MODEL ?? 'phi4-mini').trim()
  if (getModelCapsClient(primary).vision) return primary
  return (process.env.OLLAMA_VISION_MODEL ?? 'llava-phi3').trim()
}

/**
 * Returns the model ID to use for audio transcription (Ollama path).
 * Returns null if no audio-capable model is configured.
 *
 * Priority:
 *   1. Primary model, if it supports audio
 *   2. OLLAMA_AUDIO_MODEL env var, if set
 *   3. Vision model, if it supports audio (e.g. gemma4:e2b)
 */
export function routeAudioModel(): string | null {
  const primary = (process.env.OLLAMA_MODEL ?? 'phi4-mini').trim()
  if (getModelCapsClient(primary).audio) return primary
  const dedicated = (process.env.OLLAMA_AUDIO_MODEL ?? '').trim()
  if (dedicated) return dedicated
  const vision = (process.env.OLLAMA_VISION_MODEL ?? '').trim()
  if (vision && getModelCapsClient(vision).audio) return vision
  return null
}

/**
 * Returns true if the current provider + model config can transcribe audio.
 * Use as a pre-flight check before saving or processing an audio upload.
 *
 * - OpenAI:   always (Whisper)
 * - Google:   always (Gemini multimodal)
 * - Ollama:   only if routeAudioModel() returns a model
 * - Others:   no audio API → false
 */
export function canTranscribeAudio(): boolean {
  const provider = process.env.AI_PROVIDER ?? 'ollama'
  if (provider === 'openai') return true
  if (provider === 'google') return true
  if (provider === 'ollama') return routeAudioModel() !== null
  return false   // anthropic, groq, xai, perplexity, mistral have no audio API
}

/**
 * Human-readable explanation of why audio transcription isn't available.
 * Call only when canTranscribeAudio() is false.
 */
export function audioUnavailableReason(): string {
  const provider = process.env.AI_PROVIDER ?? 'ollama'
  if (provider === 'anthropic') {
    return 'Audio transcription is not supported with the Anthropic provider. Switch to Ollama (gemma4:e2b), OpenAI, or Google in Settings.'
  }
  if (provider === 'ollama') {
    return 'Audio transcription requires a model that supports audio (e.g. gemma4:e2b). In Settings → Ollama, set your primary or vision model to gemma4:e2b, or set OLLAMA_AUDIO_MODEL.'
  }
  return `Audio transcription is not supported with the ${provider} provider. Switch to Ollama (gemma4:e2b), OpenAI, or Google in Settings.`
}
