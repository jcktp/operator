import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getModeConfig } from '@/lib/mode'
import { chat } from '@/lib/ai-providers'
import { extractJsonFromText, parseJsonSafe } from '@/lib/utils'
import type { Metric, Insight } from '@/lib/utils'

interface GeneratedBrief {
  narrative: string
  events: Array<{ id: string; date: string; description: string; actors: string[]; claimId: string }>
  claims: Array<{ id: string; text: string; status: 'unverified' | 'verified' | 'disputed' | 'awaiting' }>
}

export async function POST(req: Request) {
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
    const metrics = parseJsonSafe<Metric[]>(r.metrics, []).slice(0, 4).map(m => `${m.label}: ${m.value}`).join(', ')
    const insights = parseJsonSafe<Insight[]>(r.insights, []).slice(0, 3).map(i => `[${i.type}] ${i.text}`).join('; ')
    return `${r.title} (${r.area}): ${r.summary ?? 'No summary'}${metrics ? ` | Metrics: ${metrics}` : ''}${insights ? ` | Flags: ${insights}` : ''}`
  }).join('\n')

  const prompt = `You are a senior ${modeConfig.label.toLowerCase()} analyst building a story brief from multiple ${modeConfig.documentLabelPlural.toLowerCase()}.

DOCUMENTS:
${reportsText}

Generate a structured story brief. Reply with ONLY valid JSON:
{
  "narrative": "4-6 paragraph narrative covering: what the story is about, key actors and their roles, the main chronology of events, principal claims being made, and what is still unclear or unverified. Write as a memo to a senior editor.",
  "events": [{"id":"e1","date":"date text","description":"what happened","actors":["name"],"claimId":"c1"}],
  "claims": [{"id":"c1","text":"specific verifiable claim","status":"unverified"}]
}

Limits: max 8 events, max 8 claims. Use only information from the documents above. status must be "unverified" for all new claims.`

  let text: string
  try {
    text = await chat([{ role: 'user', content: prompt }], 0.2, true)
  } catch (e) {
    console.error('Story brief AI call failed:', e)
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 })
  }

  let parsed: GeneratedBrief
  try {
    const json = extractJsonFromText(text)
    parsed = JSON.parse(json) as GeneratedBrief
  } catch {
    console.error('Story brief JSON parse failed. Raw output:', text.slice(0, 500))
    return NextResponse.json({ error: 'AI returned malformed output — try again' }, { status: 502 })
  }

  return NextResponse.json({
    narrative: typeof parsed.narrative === 'string' ? parsed.narrative : '',
    events: Array.isArray(parsed.events) ? parsed.events : [],
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
  })
}
