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

// POST /api/journal/[id]/structure/generate
// Generates a brief from selected reports and writes it into the entry's structure.
// Body: { reportIds: string[] }
// Returns: { narrative, events, claims, structure }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const deny = await requireAuth(req)
  if (deny) return deny
  const { id } = await params

  const body = await req.json() as { reportIds: string[] }
  if (!body.reportIds?.length) {
    return NextResponse.json({ error: 'reportIds required' }, { status: 400 })
  }

  // Make sure the entry exists and has a structure row.
  const structure = await prisma.entryStructure.findUnique({ where: { entryId: id } })
  if (!structure) return NextResponse.json({ error: 'Entry has no structure attached' }, { status: 404 })

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

  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  let parsed: GeneratedBrief
  try {
    const json = extractJsonFromText(stripped)
    parsed = JSON.parse(json) as GeneratedBrief
  } catch {
    console.warn('Story brief JSON parse failed, retrying without JSON mode. Preview:', stripped.slice(0, 200))
    try {
      const retry = await chat([{ role: 'user', content: prompt }], 0.1, false)
      const retryStripped = retry.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      const json = extractJsonFromText(retryStripped)
      parsed = JSON.parse(json) as GeneratedBrief
    } catch (retryErr) {
      console.error('Story brief retry also failed:', retryErr)
      return NextResponse.json({ error: 'The AI model could not produce a structured brief. Try selecting fewer documents or switching to a cloud provider.' }, { status: 502 })
    }
  }

  const narrative = typeof parsed.narrative === 'string' ? parsed.narrative : ''
  const events = Array.isArray(parsed.events) ? parsed.events : []
  const claims = Array.isArray(parsed.claims) ? parsed.claims : []

  // Persist into structure (events + claims + reportIds). Narrative is appended to the
  // entry's content as paragraphs so the writer can edit it in Tiptap.
  const updatedStructure = await prisma.entryStructure.update({
    where: { entryId: id },
    data: {
      events: JSON.stringify(events),
      claimStatuses: JSON.stringify(claims),
      reportIds: JSON.stringify(body.reportIds),
    },
  })

  return NextResponse.json({
    narrative,
    events,
    claims,
    structure: updatedStructure,
  })
}
