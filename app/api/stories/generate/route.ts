import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import { chat } from '@/lib/ai-providers'
import { extractJsonFromText, parseJsonSafe, parseMetrics } from '@/lib/utils'
import type { Insight } from '@/lib/utils'

interface GeneratedBrief {
  narrative: string
  events: Array<{ id: string; date: string; description: string; actors: string[]; claimId: string }>
  claims: Array<{ id: string; text: string; status: 'unverified' | 'verified' | 'disputed' | 'awaiting' }>
}

// POST /api/stories/generate
// Stateless brief generator — accepts reportIds, returns narrative/events/claims.
// The caller (StoryStructurePanel) is responsible for persisting via PATCH /api/projects/[id]/story.
export async function POST(req: Request) {
  const deny = await requireAuth(req)
  if (deny) return deny

  const body = await req.json() as { reportIds: string[] }
  if (!body.reportIds?.length) {
    return NextResponse.json({ error: 'reportIds required' }, { status: 400 })
  }

  const reports = await prisma.report.findMany({
    where: { id: { in: body.reportIds } },
    select: { id: true, title: true, area: true, summary: true, metrics: true, insights: true },
  })
  if (reports.length === 0) {
    return NextResponse.json({ error: 'No reports found' }, { status: 404 })
  }

  const modeRow = await prisma.setting.findUnique({ where: { key: 'app_mode' } })
  const modeConfig = getModeConfig(modeRow?.value)

  const reportsText = reports.map(r => {
    const metrics = parseMetrics(r.metrics).slice(0, 4).map(m => `${m.label}: ${m.value}`).join(', ')
    const insights = parseJsonSafe<Insight[]>(r.insights, []).slice(0, 3).map(i => `[${i.type}] ${i.text}`).join('; ')
    return `${r.title} (${r.area}): ${r.summary ?? 'No summary'}${metrics ? ` | Metrics: ${metrics}` : ''}${insights ? ` | Flags: ${insights}` : ''}`
  }).join('\n')

  const prompt = `You are a senior ${modeConfig.label.toLowerCase()} analyst building a story brief from multiple ${modeConfig.documentLabelPlural.toLowerCase()}.

DOCUMENTS:
${reportsText}

Generate a structured story brief. Reply with ONLY valid JSON:
{
  "narrative": "4-6 paragraph narrative covering: what the story is about, key actors, chronology, principal claims, and what is still unclear. Write as a memo to a senior editor.",
  "events": [{"id":"e1","date":"date text","description":"what happened","actors":["name"],"claimId":"c1"}],
  "claims": [{"id":"c1","text":"specific verifiable claim","status":"unverified"}]
}

Limits: max 8 events, max 8 claims. Use only information from the documents above.`

  let text: string
  try {
    text = await chat([{ role: 'user', content: prompt }], 0.2, true)
  } catch {
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 })
  }

  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  let parsed: GeneratedBrief
  try {
    parsed = JSON.parse(extractJsonFromText(stripped)) as GeneratedBrief
  } catch {
    try {
      const retry = await chat([{ role: 'user', content: prompt }], 0.1, false)
      parsed = JSON.parse(extractJsonFromText(retry.replace(/<think>[\s\S]*?<\/think>/g, '').trim())) as GeneratedBrief
    } catch {
      return NextResponse.json({ error: 'AI model could not produce a structured brief. Try fewer documents or a cloud provider.' }, { status: 502 })
    }
  }

  return NextResponse.json({
    narrative: typeof parsed.narrative === 'string' ? parsed.narrative : '',
    events: Array.isArray(parsed.events) ? parsed.events : [],
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
  })
}
