import { parseJsonSafe } from './utils'
import type { Metric, Insight, Question } from './utils'
import { getPersonasForMode, type PersonaId } from './personas'
import { getModeConfig } from './mode'
import { chat, chatWithTools, getProvider, maxContentLength, type AIProvider, type ChatResult } from './ai-providers'
import { buildPatternSummary, formatPatternSummary } from './patterns'

export type { AIProvider }

// Re-export journalism and vision functions so existing callers don't break
export { describeImage } from './ai-vision'
export {
  extractEntities, extractTimeline, detectRedactions,
  compareDocumentsJournalism, generateVerificationChecklist,
  type NamedEntity, type JournalismTimelineEvent, type RedactionEntry,
  type JournalismPassage, type JournalismFigureChange, type JournalismComparison,
  type VerificationItem,
} from './ai-journalism'

// ── JSON extraction ─────────────────────────────────────────────────────────

function extractJson(text: string): string {
  const t = text.trim()
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    const candidate = fenced[1].trim()
    try { JSON.parse(candidate); return candidate } catch {}
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start !== -1 && end > start) {
    const candidate = t.slice(start, end + 1)
    try { JSON.parse(candidate); return candidate } catch {}
  }
  throw new Error(`No valid JSON in response (len=${t.length}, preview=${t.slice(0, 100)})`)
}

// ── Public interfaces ──────────────────────────────────────────────────────

export type { Metric, Insight, Question }

export interface ReportAnalysis {
  summary: string
  metrics: Metric[]
  insights: Insight[]
  questions: Question[]
}

export interface ComparisonChange {
  metric: string
  previous: string
  current: string
  direction: 'improved' | 'declined' | 'unchanged' | 'new' | 'removed'
  significance: 'high' | 'medium' | 'low'
  note?: string
}

export interface ReportComparison {
  headline: string
  changes: ComparisonChange[]
  newTopics: string[]
  removedTopics: string[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isCloudProvider(): boolean {
  return getProvider() !== 'ollama'
}

// ── Analysis functions ──────────────────────────────────────────────────────

export async function analyzeReport(
  content: string,
  reportTitle: string,
  area: string,
  directName?: string
): Promise<ReportAnalysis> {
  const modeConfig = getModeConfig(process.env.APP_MODE)
  const truncated = content.slice(0, maxContentLength())
  const from = directName ? `\nSubmitted by: ${directName}` : ''

  const cloudPrompt = `You are a senior analyst reviewing a ${modeConfig.documentLabel.toLowerCase()} for a ${modeConfig.label.toLowerCase()}.

Document: ${reportTitle}
Area: ${area}${from}

${modeConfig.analysisFraming}

STRICT RULES:
- Only surface numbers and facts that appear verbatim in the document. Never calculate, infer, or estimate figures.
- Do not invent metrics, trends, or observations not explicitly stated.
- If a value is not present, omit it rather than guessing.

Document content:
${truncated}

Return ONLY valid JSON with this exact structure:
{
  "summary": "4-6 sentence narrative summary written in a direct, conversational tone for the ${modeConfig.label.toLowerCase()}. Cover what this report is about, the key findings or themes, any notable strengths or concerns, and what stands out most. Write as if briefing the reader verbally — not a dry abstract.",
  "metrics": [
    {"label": "metric name", "value": "exact value as written in document", "context": "comparison or target if stated", "trend": "up|down|flat|unknown", "status": "positive|negative|neutral|warning"}
  ],
  "insights": [
    {"type": "observation|anomaly|risk|opportunity", "text": "specific factual observation directly from the document", "area": "${area.toLowerCase()}"}
  ],
  "questions": [
    {"text": "specific follow-up question", "why": "why this matters to the ${modeConfig.label.toLowerCase()}", "priority": "high|medium|low"}
  ]
}

Limits: max 10 metrics, 5 insights, 4 questions. Use only data from the document.`

  const ollamaPrompt = `Analyze this ${modeConfig.documentLabel.toLowerCase()}. Extract only facts that appear in the text — never calculate or invent numbers.

Document: ${reportTitle} (${area})${from}

${truncated}

Reply with ONLY valid JSON:
{
  "summary": "4-6 sentence narrative summary covering what this report is about, key findings, notable strengths or concerns, and what stands out most — conversational tone, as if briefing the reader verbally",
  "metrics": [{"label": "name", "value": "exact value from text", "context": "context if stated", "trend": "up|down|flat|unknown", "status": "positive|negative|neutral|warning"}],
  "insights": [{"type": "observation|anomaly|risk|opportunity", "text": "observation from document", "area": "${area.toLowerCase()}"}],
  "questions": [{"text": "follow-up question", "why": "why it matters", "priority": "high|medium|low"}]
}
Limits: max 10 metrics, 5 insights, 4 questions.`

  const prompt = isCloudProvider() ? cloudPrompt : ollamaPrompt
  const text = await chat([{ role: 'user', content: prompt }], 0.1, true)

  let parsed: ReportAnalysis
  try {
    const json = extractJson(text)
    parsed = JSON.parse(json) as ReportAnalysis
  } catch (e) {
    console.error('analyzeReport JSON parse failed:', e, 'raw response:', text.slice(0, 500))
    return { summary: '', metrics: [], insights: [], questions: [] }
  }

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
  }
}

export async function compareReports(
  previousSummary: string,
  previousMetrics: string,
  currentSummary: string,
  currentMetrics: string,
  area: string
): Promise<ReportComparison> {
  const prevMetrics = parseJsonSafe<Metric[]>(previousMetrics, [])
  const currMetrics = parseJsonSafe<Metric[]>(currentMetrics, [])

  const prevText = `Summary: ${previousSummary}\nMetrics: ${prevMetrics.map(m => `${m.label}: ${m.value}`).join(', ')}`
  const currText = `Summary: ${currentSummary}\nMetrics: ${currMetrics.map(m => `${m.label}: ${m.value}`).join(', ')}`

  const prompt = `Compare two ${area} reports for a CEO. Identify what changed, improved, or declined.

PREVIOUS REPORT:
${prevText}

CURRENT REPORT:
${currText}

Reply with ONLY valid JSON:
{
  "headline": "1 sentence summarising the most important change",
  "changes": [{"metric": "metric or topic name", "previous": "previous value/state", "current": "current value/state", "direction": "improved|declined|unchanged|new|removed", "significance": "high|medium|low", "note": "optional context"}],
  "newTopics": ["topics or metrics that appear in current but not previous"],
  "removedTopics": ["topics or metrics in previous but missing from current"]
}

Limits: max 8 changes, max 4 newTopics, max 4 removedTopics.`

  const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
  const json = extractJson(text)
  const parsed = JSON.parse(json) as ReportComparison
  return {
    headline: parsed.headline ?? '',
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    newTopics: Array.isArray(parsed.newTopics) ? parsed.newTopics : [],
    removedTopics: Array.isArray(parsed.removedTopics) ? parsed.removedTopics : [],
  }
}

export async function checkResolvedFlags(
  previousFlags: Array<{ text: string; type: string }>,
  newContent: string,
  newInsights: Insight[]
): Promise<string[]> {
  if (previousFlags.length === 0) return []
  const flagsList = previousFlags.map((f, i) => `${i + 1}. [${f.type}] ${f.text}`).join('\n')
  const newInsightsList = newInsights.map(i => `[${i.type}] ${i.text}`).join('\n') || 'None'
  const prompt = `Previous report flags:
${flagsList}

New report content (excerpt):
${newContent.slice(0, 3000)}

New report flags:
${newInsightsList}

Which numbered previous flags appear resolved or no longer a concern based on the new report?
Reply with ONLY valid JSON: {"resolved": [1, 3]} — empty array if none.`

  try {
    const text = await chat([{ role: 'user', content: prompt }])
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { resolved: number[] }
    if (!Array.isArray(parsed.resolved)) return []
    return parsed.resolved
      .filter(i => typeof i === 'number' && i >= 1 && i <= previousFlags.length)
      .map(i => previousFlags[i - 1].text)
  } catch {
    return []
  }
}

// ── Intent detection ────────────────────────────────────────────────────────

const NOTE_SAVE_PATTERNS = [
  /add\s+a?\s*note\s+to\s+(my\s+)?(journal|notebook|research notes|case notes)/i,
  /save\s+(a?\s*note|this)\s+to\s+(my\s+)?(journal|notebook|research notes|case notes)/i,
  /add\s+this\s+to\s+(my\s+)?(journal|notebook|research notes|case notes)/i,
  /create\s+a?\s*note\s+(in|for)\s+(my\s+)?(journal|notebook|research notes|case notes)/i,
  /make\s+a?\s*note\s+(about|in|for)/i,
  /save\s+(this|that|it)\s+as\s+a\s+note/i,
  /log\s+(this|that|it)\s+in\s+(my\s+)?(journal|notebook)/i,
]

function hasNoteSaveIntent(messages: Array<{ role: string; content: string }>): boolean {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUser) return false
  return NOTE_SAVE_PATTERNS.some(p => p.test(lastUser.content))
}

export type { ChatResult }

export async function dispatchChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: string,
  personaId: PersonaId = 'dispatch',
  userMemory = ''
): Promise<ChatResult> {
  const personas = getPersonasForMode(process.env.APP_MODE)
  const persona = personas[personaId]
  const hasSearch = !!process.env.BRAVE_SEARCH_KEY
  const systemPrompt = persona.buildSystemPrompt(context, userMemory, hasSearch)
  const enableNoteTool = hasNoteSaveIntent(messages)
  return chatWithTools(messages, systemPrompt, persona.temperature, enableNoteTool)
}

// ── Memory extraction ────────────────────────────────────────────────────────

export async function extractMemoryFacts(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  existingMemory: string
): Promise<string[]> {
  if (messages.length < 2) return []

  const recent = messages.slice(-6)
  const prompt = `You are reading a short business conversation between a CEO and an AI assistant. Extract any NEW facts about this person's business, goals, or preferences that would be useful to remember in future conversations.

Rules:
- Only extract concrete, specific facts (not vague observations)
- Only extract things NOT already in the existing memory
- Maximum 2 facts
- Each fact must be 1 short sentence
- If nothing new and concrete is worth remembering, return an empty array

Existing memory:
${existingMemory || '(none)'}

Conversation:
${recent.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 300)}`).join('\n')}

Reply with ONLY valid JSON: {"facts": ["fact 1", "fact 2"]} — or {"facts": []} if nothing new.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { facts?: unknown }
    if (!Array.isArray(parsed.facts)) return []
    return (parsed.facts as unknown[])
      .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
      .slice(0, 2)
  } catch {
    return []
  }
}

// ── Dashboard insights ───────────────────────────────────────────────────────

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

  const prompt = `You are advising a CEO based on recent reports from their direct reports.

Reports:
${reportsText}

Reply with ONLY valid JSON, no other text:
{
  "healthSignal": "1-2 sentence overall company health assessment",
  "crossInsights": [{"type": "observation|anomaly|risk|opportunity", "text": "cross-area pattern or key signal", "area": "areas involved"}],
  "topQuestions": [{"text": "most important question for the CEO to ask", "why": "why it matters", "priority": "high|medium|low"}]
}

Limits: max 4 crossInsights, 4 topQuestions. Only use what the reports contain.`

  const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
  const json = extractJson(text)
  const parsed = JSON.parse(json)
  return {
    healthSignal: parsed.healthSignal ?? '',
    crossInsights: Array.isArray(parsed.crossInsights) ? parsed.crossInsights : [],
    topQuestions: Array.isArray(parsed.topQuestions) ? parsed.topQuestions : [],
  }
}

// ── Catch-me-up digest ───────────────────────────────────────────────────────

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

  // Build cross-report pattern summary
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

