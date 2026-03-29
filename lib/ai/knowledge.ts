import type { Metric, Insight } from '../utils'
import { getModeConfig } from '../mode'
import { chat } from '../ai-providers'
import { prisma } from '../db'

export interface KnowledgeContext {
  userMemory: string
  glossaryBlock: string
  briefingBlock: string
}

export async function loadKnowledgeForArea(area: string): Promise<KnowledgeContext> {
  try {
    const { seedGlossaryIfEmpty } = await import('../knowledge-seed')
    await seedGlossaryIfEmpty()
  } catch { /* non-blocking */ }

  const mode = process.env.APP_MODE ?? 'executive'

  const [memoryRow, glossaryTerms, briefingRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'user_memory' } }),
    prisma.glossaryTerm.findMany({
      where: {
        scope: { in: ['global', `mode:${mode}`, `area:${area}`] },
      },
      orderBy: [{ scope: 'asc' }, { term: 'asc' }],
    }),
    prisma.areaBriefing.findUnique({ where: { area_mode: { area, mode } } }),
  ])

  const userMemory = memoryRow?.value?.trim() ?? ''

  const byScope: Record<string, string[]> = {}
  for (const t of glossaryTerms) {
    const label = t.scope === 'global' ? 'Global'
      : t.scope.startsWith('mode:') ? t.scope.replace('mode:', '')
      : t.scope.replace('area:', '')
    byScope[label] = byScope[label] ?? []
    byScope[label].push(`${t.term} = ${t.definition}`)
  }
  const glossaryBlock = Object.entries(byScope)
    .map(([label, terms]) => `VOCABULARY — ${label}: ${terms.join(' | ')}`)
    .join('\n')

  const briefingParts: string[] = []
  if (briefingRow?.content) briefingParts.push(briefingRow.content)
  if (briefingRow?.userNotes) briefingParts.push(`User notes: ${briefingRow.userNotes}`)
  const briefingBlock = briefingParts.length > 0
    ? `CURRENT STATE — ${area}: ${briefingParts.join('\n')}`
    : ''

  return { userMemory, glossaryBlock, briefingBlock }
}

export async function generateAreaBriefing(
  area: string,
  mode: string,
  reports: Array<{ summary?: string | null; metrics?: string | null; insights?: string | null; createdAt: Date }>
): Promise<string> {
  const modeConfig = getModeConfig(mode)

  const framingByMode: Record<string, string> = {
    executive:      'Focus on: metrics trends, financial/operational health, key contacts, risks and opportunities.',
    consulting:     'Focus on: metrics trends, financial/operational health, key contacts, risks and opportunities.',
    journalism:     'Focus on: open story threads, sources and entities in play, angles being pursued, pending follow-ups.',
    legal:          'Focus on: active parties, claims, evidence patterns, procedural stage, timeline state.',
    'team-lead':    'Focus on: velocity norms, recurring blockers, team dynamics, delivery patterns, sprint health.',
    'market-research': 'Focus on: recurring themes, respondent patterns, open research questions, data quality signals.',
  }
  const framing = framingByMode[mode] ?? framingByMode.executive

  const reportsText = reports.slice(0, 10).map((r, i) => {
    let metricsData: Metric[] = []
    let insightsData: Insight[] = []
    try { metricsData = JSON.parse(r.metrics ?? '[]') } catch {}
    try { insightsData = JSON.parse(r.insights ?? '[]') } catch {}
    const metricStr = metricsData.slice(0, 4).map(m => `${m.label}: ${m.value}`).join(', ')
    const riskStr = insightsData.filter(ins => ins.type === 'risk' || ins.type === 'anomaly').slice(0, 2).map(ins => ins.text).join('; ')
    return `Report ${i + 1} (${r.createdAt.toISOString().slice(0, 10)}): ${r.summary ?? ''}${metricStr ? ` | ${metricStr}` : ''}${riskStr ? ` | Risks: ${riskStr}` : ''}`
  }).join('\n')

  const prompt = `You are generating a concise current-state briefing for the "${area}" area, to be injected into future AI analysis for a ${modeConfig.label.toLowerCase()}.

${framing}

Write a single paragraph of ~250 words (max 300). Be factual and specific. Only state what is directly evidenced by the reports. End with 1 sentence on the most important open thread or next thing to watch.

${modeConfig.documentLabelPlural} (most recent first):
${reportsText}`

  const content = await chat([{ role: 'user', content: prompt }], 0.2)
  const trimmed = content.trim()

  await prisma.areaBriefing.upsert({
    where: { area_mode: { area, mode } },
    update: { content: trimmed, reportCount: reports.length, updatedAt: new Date() },
    create: { id: crypto.randomUUID(), area, mode, content: trimmed, reportCount: reports.length, updatedAt: new Date() },
  })

  return trimmed
}
