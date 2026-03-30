import { NextResponse } from 'next/server'
import { cpus, loadavg, homedir, totalmem, arch } from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/db'

const PROVIDER_LABELS: Record<string, string> = {
  ollama:     'Ollama',
  anthropic:  'Anthropic',
  openai:     'OpenAI',
  groq:       'Groq',
  google:     'Google Gemini',
  xai:        'Grok',
  perplexity: 'Perplexity',
}

type Level = 'ok' | 'warn' | 'error'

function folderSizeBytes(dir: string): number {
  try {
    let total = 0
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) total += folderSizeBytes(full)
      else total += fs.statSync(full).size
    }
    return total
  } catch { return 0 }
}

function worst(...levels: Level[]): Level {
  if (levels.includes('error')) return 'error'
  if (levels.includes('warn')) return 'warn'
  return 'ok'
}

export async function GET() {
  // ── Machine suitability ───────────────────────────────────────────────────
  // Static hardware check — is this machine capable of running the app well?
  const cpuList = cpus()
  const coreCount = cpuList.length
  const cpuModel = cpuList[0]?.model ?? 'Unknown CPU'
  const architecture = arch()                          // arm64, x64, etc.
  const systemRamMb = Math.round(totalmem() / 1024 / 1024)
  const systemRamGb = Math.round(systemRamMb / 1024 * 10) / 10

  // RAM tiers: <4 GB = can't really run this; <8 GB = tight for local AI; 8+ = fine
  const ramStatus: Level = systemRamGb < 4 ? 'error' : systemRamGb < 8 ? 'warn' : 'ok'
  // Core tiers: 1 core = error; 2-3 = warn; 4+ = ok
  const coresStatus: Level = coreCount < 2 ? 'error' : coreCount < 4 ? 'warn' : 'ok'
  const machineStatus: Level = worst(ramStatus, coresStatus)

  // Human-readable tier label
  const ramTier = systemRamGb >= 16 ? 'Good' : systemRamGb >= 8 ? 'Adequate' : systemRamGb >= 4 ? 'Limited' : 'Insufficient'
  const ramNote = systemRamGb < 8
    ? systemRamGb < 4
      ? 'Below minimum — app will struggle'
      : 'Tight for local AI models (Ollama needs 8 GB+)'
    : systemRamGb < 16
      ? 'Fine for cloud AI; tight for large local models'
      : 'Good — sufficient for local AI'

  // ── App memory (runtime) ──────────────────────────────────────────────────
  // Thresholds relative to system RAM — only warn when genuinely problematic.
  // warn at 35% of system RAM, error at 55%.
  const mem = process.memoryUsage()
  const rss  = Math.round(mem.rss / 1024 / 1024)
  const heap = Math.round(mem.heapUsed / 1024 / 1024)
  const warnMb  = Math.round(systemRamMb * 0.35)
  const errorMb = Math.round(systemRamMb * 0.55)
  const memStatus: Level = rss > errorMb ? 'error' : rss > warnMb ? 'warn' : 'ok'

  // ── CPU load ──────────────────────────────────────────────────────────────
  const load1   = loadavg()[0]
  const loadPct = Math.round((load1 / coreCount) * 100)
  const cpuStatus: Level = loadPct > 95 ? 'error' : loadPct > 85 ? 'warn' : 'ok'

  // ── Settings ──────────────────────────────────────────────────────────────
  let s: Record<string, string> = {}
  try {
    const rows = await prisma.setting.findMany()
    s = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]))
  } catch { /* leave s empty */ }

  // ── Storage usage ─────────────────────────────────────────────────────────
  const dbPath      = path.join(process.cwd(), 'prisma', 'dev.db')
  const reportsPath = path.join(homedir(), 'Documents', 'Operator Reports')
  const dbBytes     = (() => { try { return fs.statSync(dbPath).size } catch { return 0 } })()
  const reportsBytes = folderSizeBytes(reportsPath)
  const totalBytes  = dbBytes + reportsBytes
  const totalGb     = totalBytes / (1024 ** 3)
  const totalMb     = Math.round(totalBytes / (1024 ** 2))

  const thresholdGb   = parseFloat(s['storage_threshold_gb'] ?? '5')
  const storageStatus: Level = totalGb > thresholdGb ? 'error' : totalGb > thresholdGb * 0.8 ? 'warn' : 'ok'

  // ── AI reachability ───────────────────────────────────────────────────────
  let aiStatus: Level = 'ok'
  let aiLabel = 'Unknown'
  let aiDetail = ''

  try {
    const provider = s.ai_provider ?? 'ollama'
    aiLabel = PROVIDER_LABELS[provider] ?? provider

    if (provider === 'ollama') {
      const host = s.ollama_host ?? 'http://localhost:11434'
      const model = s.ollama_model ?? 'phi4-mini'
      aiLabel = model
      try {
        const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const data = await res.json() as { models?: Array<{ name: string }> }
          const count = data.models?.length ?? 0
          aiStatus = 'ok'
          aiDetail = `${count} model${count !== 1 ? 's' : ''} available`
        } else {
          aiStatus = 'error'
          aiDetail = `HTTP ${res.status}`
        }
      } catch {
        aiStatus = 'error'
        aiDetail = 'Not running'
      }
    } else {
      const hasSavedKey = !!s[`${provider}_key`]
      aiStatus = hasSavedKey ? 'ok' : 'warn'
      aiDetail = hasSavedKey ? 'API key configured' : 'No API key saved'
    }
  } catch {
    aiStatus = 'error'
    aiLabel = 'AI'
    aiDetail = 'Could not read settings'
  }

  return NextResponse.json({
    status: worst(aiStatus, memStatus, cpuStatus, storageStatus, machineStatus),
    ai:      { status: aiStatus, label: aiLabel, detail: aiDetail },
    memory:  { rss, heap, status: memStatus, systemRamMb, warnMb, errorMb },
    cpu:     { load: Math.round(load1 * 10) / 10, loadPct, status: cpuStatus, cores: coreCount },
    storage: { totalMb, totalGb: Math.round(totalGb * 10) / 10, status: storageStatus, thresholdGb },
    machine: {
      status:       machineStatus,
      ramGb:        systemRamGb,
      ramStatus,
      ramTier,
      ramNote,
      cores:        coreCount,
      coresStatus,
      cpuModel,
      arch:         architecture,
    },
  })
}
