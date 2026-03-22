import { NextResponse } from 'next/server'
import { cpus, loadavg } from 'os'
import { prisma } from '@/lib/db'

type Level = 'ok' | 'warn' | 'error'

function worst(...levels: Level[]): Level {
  if (levels.includes('error')) return 'error'
  if (levels.includes('warn')) return 'warn'
  return 'ok'
}

export async function GET() {
  // ── App memory ────────────────────────────────────────────────────────────
  const mem = process.memoryUsage()
  const rss = Math.round(mem.rss / 1024 / 1024)       // MB
  const heap = Math.round(mem.heapUsed / 1024 / 1024) // MB
  const memStatus: Level = rss > 1000 ? 'error' : rss > 500 ? 'warn' : 'ok'

  // ── CPU load ──────────────────────────────────────────────────────────────
  const load1 = loadavg()[0]
  const cores = cpus().length
  const loadPct = Math.round((load1 / cores) * 100)
  const cpuStatus: Level = loadPct > 90 ? 'error' : loadPct > 70 ? 'warn' : 'ok'

  // ── AI reachability ───────────────────────────────────────────────────────
  let aiStatus: Level = 'ok'
  let aiLabel = 'Unknown'
  let aiDetail = ''

  try {
    const rows = await prisma.setting.findMany()
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]))
    const provider = s.ai_provider ?? 'ollama'

    if (provider === 'ollama') {
      const host = s.ollama_host ?? 'http://localhost:11434'
      aiLabel = 'Ollama'
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
      // Cloud provider — check if a key is saved (encrypted sentinel)
      const keyField = `${provider}_key`
      const hasSavedKey = !!s[keyField]
      aiLabel = provider.charAt(0).toUpperCase() + provider.slice(1)
      aiStatus = hasSavedKey ? 'ok' : 'warn'
      aiDetail = hasSavedKey ? 'API key configured' : 'No API key saved'
    }
  } catch {
    aiStatus = 'error'
    aiLabel = 'AI'
    aiDetail = 'Could not read settings'
  }

  return NextResponse.json({
    status: worst(aiStatus, memStatus, cpuStatus),
    ai: { status: aiStatus, label: aiLabel, detail: aiDetail },
    memory: { rss, heap, status: memStatus },
    cpu: { load: Math.round(load1 * 10) / 10, loadPct, status: cpuStatus },
  })
}
