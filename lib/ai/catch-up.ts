import { extractJsonFromText } from '../utils'
import type { Metric, Insight, Question } from '../utils'
import { getModeConfig } from '../mode'
import { chat } from '../ai-providers'
import { buildPatternSummary, formatPatternSummary } from '../patterns'

export async function generateDashboardInsights(
  reports: Array<{ area: string; summary: string; metrics: string; insights: string }>
): Promise<{ crossInsights: Insight[]; topQuestions: Question[]; healthSignal: string }> {
  if (reports.length === 0) {
    return { crossInsights: [], topQuestions: [], healthSignal: 'No reports available.' }
  }

  const reportsText = reports
    .slice(0, 8)
    .map(r => {
      let metricsData: Metric[] = []
      let insightsData: Insight[] = []
      try { metricsData = JSON.parse(r.metrics || '[]') } catch {}
      try { insightsData = JSON.parse(r.insights || '[]') } catch {}
      return `${r.area}: ${r.summary}. Metrics: ${metricsData.slice(0, 4).map(m => `${m.label} ${m.value}`).join(', ')}. Flags: ${insightsData.slice(0, 3).map(i => i.text).join('; ')}`
    })
    .join('\n')

  const modeConfig = getModeConfig(process.env.APP_MODE)
  const prompt = `You are advising a ${modeConfig.label.toLowerCase()} based on recent ${modeConfig.documentLabelPlural.toLowerCase()} from their ${modeConfig.personLabelPlural.toLowerCase()}.

${modeConfig.documentLabelPlural}:
${reportsText}

Reply with ONLY valid JSON, no other text:
{
  "healthSignal": "1-2 sentence overall health assessment",
  "crossInsights": [{"type": "observation|anomaly|risk|opportunity", "text": "cross-area pattern or key signal", "area": "areas involved"}],
  "topQuestions": [{"text": "most important question for the ${modeConfig.label.toLowerCase()} to ask", "why": "why it matters", "priority": "high|medium|low"}]
}

Limits: max 4 crossInsights, 4 topQuestions. Only use what the ${modeConfig.documentLabelPlural.toLowerCase()} contain.`

  const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
  const json = extractJsonFromText(text)
  const parsed = JSON.parse(json)
  return {
    healthSignal: parsed.healthSignal ?? '',
    crossInsights: Array.isArray(parsed.crossInsights) ? parsed.crossInsights : [],
    topQuestions: Array.isArray(parsed.topQuestions) ? parsed.topQuestions : [],
  }
}

export async function generateCatchMeUp(
  reports: Array<{
    area: string
    title?: string
    directName?: string
    date: string
    summary: string
    metrics: string
    insights: string
    questions?: string
    reportDate?: string | null
    createdAt?: string
  }>
): Promise<string> {
  if (reports.length === 0) return 'No reports to catch up on yet.'

  const modeConfig = getModeConfig(process.env.APP_MODE)

  const patternReports = reports.map(r => ({
    area: r.area,
    title: r.title ?? r.area,
    reportDate: r.reportDate ?? null,
    createdAt: r.createdAt ?? r.date,
    summary: r.summary ?? null,
    metrics: r.metrics ?? null,
    insights: r.insights ?? null,
    questions: r.questions ?? null,
  }))
  const patterns = buildPatternSummary(patternReports)
  const patternBlock = formatPatternSummary(patterns, modeConfig.documentLabel.toLowerCase())

  const reportsText = reports.slice(0, 15).map(r => {
    let metricsData: Metric[] = []
    let insightsData: Insight[] = []
    try { metricsData = JSON.parse(r.metrics || '[]') } catch {}
    try { insightsData = JSON.parse(r.insights || '[]') } catch {}
    const from = r.directName ? ` from ${r.directName}` : ''
    const metricStr = metricsData.slice(0, 3).map(m => `${m.label} ${m.value}`).join(', ')
    const riskStr = insightsData.filter(i => i.type === 'risk' || i.type === 'anomaly').slice(0, 2).map(i => i.text).join('; ')
    return `[${r.area}${from}, ${r.date}] ${r.summary}${metricStr ? ` | Metrics: ${metricStr}` : ''}${riskStr ? ` | Flags: ${riskStr}` : ''}`
  }).join('\n')

  const patternSection = patternBlock
    ? `\nThe following patterns have been automatically detected across multiple ${modeConfig.documentLabelPlural.toLowerCase()} — reference them specifically in your narrative when relevant:\n\n${patternBlock}\n`
    : ''

  const prompt = `You are briefing a ${modeConfig.label.toLowerCase()} who hasn't checked their reports in a while. Write a "catch me up" digest — a flowing narrative of 4-6 paragraphs covering what's been happening across the business. Lead with the most important developments, then cover each key area, and close with the top things they should act on or ask about. Write conversationally, as if speaking to them directly. No bullet points.${patternSection}

Recent ${modeConfig.documentLabelPlural.toLowerCase()}:
${reportsText}`

  return chat([{ role: 'user', content: prompt }], 0.4)
}
