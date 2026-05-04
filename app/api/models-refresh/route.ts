import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getModelCapsClient } from '@/lib/models/caps-shared'

// Fallback curated list — used when ollama.com is unreachable
const FALLBACK_MODELS = [
  { id: 'phi4-mini',        label: 'Phi 4 Mini',        note: 'Recommended default — fast, high quality structured output',  tags: ['fast', 'quality'] },
  { id: 'qwen3:4b',         label: 'Qwen3 4B',           note: 'Strong instruction following and structured output',          tags: ['quality', 'structured'] },
  { id: 'qwen3:8b',         label: 'Qwen3 8B',           note: 'Higher quality, needs ~6 GB RAM',                            tags: ['quality'] },
  { id: 'qwen3.5:4b',       label: 'Qwen3.5 4B',         note: 'Latest Qwen generation, fast and capable',                  tags: ['quality', 'fast'] },
  { id: 'llama3.2:3b',      label: 'Llama 3.2 3B',       note: 'Fast and lightweight',                                       tags: ['fast'] },
  { id: 'llama3.2:1b',      label: 'Llama 3.2 1B',       note: 'Fastest, lightest',                                          tags: ['fast'] },
  { id: 'llama3.1:8b',      label: 'Llama 3.1 8B',       note: 'Excellent quality, needs ~6 GB RAM',                         tags: ['quality'] },
  { id: 'qwen2.5:3b',       label: 'Qwen 2.5 3B',        note: 'Great at structured output',                                 tags: ['structured'] },
  { id: 'qwen2.5:7b',       label: 'Qwen 2.5 7B',        note: 'High quality structured output',                             tags: ['quality', 'structured'] },
  { id: 'gemma2:2b',        label: 'Gemma 2 2B',         note: 'Small and capable',                                          tags: ['fast'] },
  { id: 'gemma2:9b',        label: 'Gemma 2 9B',         note: 'Best quality Gemma, ~7 GB RAM',                              tags: ['quality'] },
  { id: 'mistral:7b',       label: 'Mistral 7B',         note: 'Strong reasoning, needs ~5 GB RAM',                          tags: ['quality'] },
  { id: 'phi3.5',           label: 'Phi 3.5',            note: 'Microsoft small model',                                      tags: ['fast'] },
  { id: 'deepseek-r1:1.5b', label: 'DeepSeek R1 1.5B',  note: 'Reasoning model, very lightweight',                          tags: ['reasoning'] },
  { id: 'deepseek-r1:7b',   label: 'DeepSeek R1 7B',    note: 'Strong reasoning, ~5 GB RAM',                                tags: ['reasoning', 'quality'] },
  { id: 'smollm2:1.7b',     label: 'SmolLM2 1.7B',      note: 'Tiny but surprisingly capable',                              tags: ['fast'] },
]

// Human-readable label from model ID
function labelFor(id: string): string {
  return id
    .split(':')[0]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    + (id.includes(':') ? ' ' + id.split(':')[1].toUpperCase() : '')
}

// Parse pull count string like "1.2M" → sortable number
function parsePulls(s: string): number {
  const m = s.match(/([\d.]+)([KMB])?/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (m[2]?.toUpperCase() === 'B') return n * 1_000_000_000
  if (m[2]?.toUpperCase() === 'M') return n * 1_000_000
  if (m[2]?.toUpperCase() === 'K') return n * 1_000
  return n
}

interface LiveModel {
  id: string
  label: string
  note: string
  tags: string[]
  pulls: number
  fromLive: true
}

// Parse ollama.com/search HTML — extract model names, capability tags, pull counts
// The page renders model cards as <li> elements; capability tags are spans with text
// like "vision", "audio", "tools", "thinking", "embedding"
function parseSearchHtml(html: string): LiveModel[] {
  const models: LiveModel[] = []
  const seen = new Set<string>()

  // Each model card has a link like href="/modelname" (library model, no second slash)
  // We split the HTML by these anchors to get per-model blocks
  const anchorSplit = html.split(/(?=<a\s[^>]*href="\/[a-z][a-z0-9._-]*")/i)

  for (const block of anchorSplit) {
    const hrefMatch = block.match(/href="\/([a-z][a-z0-9._-]*)"/i)
    if (!hrefMatch) continue
    const id = hrefMatch[1]

    // Skip navigation links, pagination, non-model anchors
    if (['search', 'library', 'login', 'signin', 'blog', 'docs', 'about', 'pricing'].includes(id)) continue
    if (seen.has(id)) continue
    seen.add(id)

    // Limit block length to avoid bleeding into next model
    const chunk = block.slice(0, 3000)

    // Detect capability tags from badge text
    const caps: string[] = []
    if (/\bvision\b/i.test(chunk)) caps.push('vision')
    if (/\baudio\b/i.test(chunk)) caps.push('audio')
    if (/\btools\b/i.test(chunk)) caps.push('tools')
    if (/\bthinking\b/i.test(chunk)) caps.push('thinking')
    if (/\bembedding\b/i.test(chunk)) caps.push('embedding')
    if (/\bcloud\b/i.test(chunk)) caps.push('cloud')

    // Pull count
    const pullMatch = chunk.match(/([\d.]+[KMB]?)\s+[Pp]ulls/i)
    const pullStr = pullMatch ? pullMatch[1] : '0'
    const pulls = parsePulls(pullStr)

    // Build note from size (from model-caps registry if known) + pull count
    const caps2 = getModelCapsClient(id)
    const sizeNote = caps2.sizeGB > 0 ? `~${caps2.sizeGB} GB · ` : ''
    const pullNote = pullStr !== '0' ? `${pullStr} pulls` : ''
    const note = `${sizeNote}${pullNote}`.trim() || id

    const isAudio = caps.includes('audio')
    const isVision = caps.includes('vision')
    const tags: string[] = []
    if (pulls > 5_000_000) tags.push('popular')
    if (isVision && isAudio) tags.push('multimodal')
    else if (isVision) tags.push('vision')
    if (caps.includes('thinking')) tags.push('reasoning')
    if (caps.includes('tools')) tags.push('structured')

    models.push({ id, label: labelFor(id), note, tags, pulls, fromLive: true })
  }

  return models.sort((a, b) => b.pulls - a.pulls)
}

// In-memory cache: refresh at most once per hour
let cachedAt = 0
let cachedModels: LiveModel[] | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function fetchLiveModels(): Promise<LiveModel[] | null> {
  if (cachedModels && Date.now() - cachedAt < CACHE_TTL) return cachedModels

  try {
    const res = await fetch('https://ollama.com/search', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Operator/1.0)', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const models = parseSearchHtml(html)
    if (models.length < 3) return null // parse failed
    cachedModels = models
    cachedAt = Date.now()
    return models
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const live = await fetchLiveModels()

  if (live && live.length > 0) {
    return NextResponse.json({
      models: live,
      source: 'live',
      cachedAt: new Date(cachedAt).toISOString(),
    })
  }

  // Fallback to curated static list
  return NextResponse.json({
    models: FALLBACK_MODELS,
    source: 'fallback',
    cachedAt: new Date().toISOString(),
  })
}
