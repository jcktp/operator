import { parseJsonSafe, extractJsonFromText } from './utils'
import type { Metric, Insight, Question } from './utils'
import { getPersonasForMode, type PersonaId } from './personas'
import { getModeConfig } from './mode'
import { chat, chatWithTools, chatWithToolsStream, getProvider, maxContentLength, type AIProvider, type ChatResult } from './ai-providers'
import { buildPatternSummary, formatPatternSummary } from './patterns'
import { prisma } from './db'

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

// ── Smart content truncation (fix #8) ───────────────────────────────────────
// Cuts at a paragraph or sentence boundary instead of a raw byte offset.

function smartTruncate(content: string, maxLen: number): string {
  if (content.length <= maxLen) return content
  const slice = content.slice(0, maxLen)
  const lastPara = slice.lastIndexOf('\n\n')
  if (lastPara > maxLen * 0.5) return slice.slice(0, lastPara)
  const lastSentence = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('.\n'),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  )
  if (lastSentence > maxLen * 0.5) return slice.slice(0, lastSentence + 1)
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace > maxLen * 0.7) return slice.slice(0, lastSpace)
  return slice
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

// ── Ollama chunked analysis ──────────────────────────────────────────────────
// Cloud models have 128k–1M token windows so they read the full document.
// Ollama small models cap at ~5k chars per call, so we split the document into
// overlapping chunks, analyse each one, then synthesise the results.

const OLLAMA_CHUNK_SIZE = 4500
const CHUNK_OVERLAP = 150

function splitIntoChunks(content: string): string[] {
  if (content.length <= OLLAMA_CHUNK_SIZE) return [content]
  const chunks: string[] = []
  let pos = 0
  while (pos < content.length) {
    let end = Math.min(pos + OLLAMA_CHUNK_SIZE, content.length)
    if (end < content.length) {
      // Break at the nearest paragraph, newline, or sentence boundary
      const slice = content.slice(pos, end)
      const lastPara = slice.lastIndexOf('\n\n')
      const lastLine = slice.lastIndexOf('\n')
      const lastSentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '))
      if (lastPara > OLLAMA_CHUNK_SIZE * 0.5) end = pos + lastPara + 2
      else if (lastLine > OLLAMA_CHUNK_SIZE * 0.7) end = pos + lastLine + 1
      else if (lastSentence > OLLAMA_CHUNK_SIZE * 0.5) end = pos + lastSentence + 2
    }
    chunks.push(content.slice(pos, end))
    const next = end - CHUNK_OVERLAP
    if (next <= pos) break // safety: always advance
    pos = next
    if (pos >= content.length) break
  }
  return chunks
}

interface ChunkResult {
  chunkSummary: string
  metrics: Metric[]
  insights: Insight[]
}

async function analyzeChunk(
  chunk: string,
  reportTitle: string,
  area: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<ChunkResult> {
  const prompt = `Excerpt ${chunkIndex} of ${totalChunks} from "${reportTitle}" (${area}).
Extract only facts visible in this text — never infer or calculate.

${chunk}

Reply with ONLY valid JSON:
{
  "chunkSummary": "2-3 sentences covering the key content of this excerpt",
  "metrics": [{"label": "name", "value": "exact value from text", "context": "if stated", "trend": "up|down|flat|unknown", "status": "positive|negative|neutral|warning"}],
  "insights": [{"type": "observation|anomaly|risk|opportunity", "text": "factual observation", "area": "${area.toLowerCase()}"}]
}
Limits: max 5 metrics, 3 insights.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJsonFromText(text)
    const parsed = JSON.parse(json) as ChunkResult
    return {
      chunkSummary: typeof parsed.chunkSummary === 'string' ? parsed.chunkSummary : '',
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    }
  } catch {
    return { chunkSummary: '', metrics: [], insights: [] }
  }
}

async function synthesizeChunks(
  chunks: ChunkResult[],
  reportTitle: string,
  area: string,
  directName?: string,
): Promise<ReportAnalysis> {
  const modeConfig = getModeConfig(process.env.APP_MODE)
  const from = directName ? ` (submitted by ${directName})` : ''

  // Cap synthesis input so it fits in Ollama's context window
  const MAX_SYNTH = OLLAMA_CHUNK_SIZE - 800
  const chunkLines = chunks
    .map((c, i) => {
      const metrics = c.metrics.map(m => `${m.label}: ${m.value}`).join(', ')
      const flags = c.insights.map(i => i.text).join('; ')
      return `Section ${i + 1}: ${c.chunkSummary}${metrics ? ` | Metrics: ${metrics}` : ''}${flags ? ` | Flags: ${flags}` : ''}`
    })
    .join('\n')
  const synthInput = smartTruncate(chunkLines, MAX_SYNTH)

  const prompt = `Synthesise a complete analysis of "${reportTitle}" (${area})${from} for a ${modeConfig.label.toLowerCase()} from these ${chunks.length} section summaries.

${synthInput}

Reply with ONLY valid JSON:
{
  "summary": "4-6 sentence narrative covering the full document — lead with the most important findings, note key themes, flag any concerns",
  "metrics": [{"label": "name", "value": "value", "context": "if stated", "trend": "up|down|flat|unknown", "status": "positive|negative|neutral|warning"}],
  "insights": [{"type": "observation|anomaly|risk|opportunity", "text": "cross-document observation", "area": "${area.toLowerCase()}"}],
  "questions": [{"text": "follow-up question", "why": "why it matters", "priority": "high|medium|low"}]
}
Limits: max 10 metrics, 5 insights, 4 questions. Only use data from the section summaries.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.2, true)
    const json = extractJsonFromText(text)
    const parsed = JSON.parse(json) as ReportAnalysis
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    }
  } catch {
    // Fallback: aggregate directly from chunks
    return {
      summary: chunks.map(c => c.chunkSummary).filter(Boolean).join(' '),
      metrics: chunks.flatMap(c => c.metrics).slice(0, 10),
      insights: chunks.flatMap(c => c.insights).slice(0, 5),
      questions: [],
    }
  }
}

// ── Analysis functions ──────────────────────────────────────────────────────

export async function analyzeReport(
  content: string,
  reportTitle: string,
  area: string,
  directName?: string
): Promise<ReportAnalysis> {
  const modeConfig = getModeConfig(process.env.APP_MODE)
  const from = directName ? `\nSubmitted by: ${directName}` : ''

  // Ollama: chunk the document so every page gets read, then synthesise
  if (!isCloudProvider() && content.length > OLLAMA_CHUNK_SIZE) {
    const chunks = splitIntoChunks(content)
    const chunkResults: ChunkResult[] = []
    for (const [i, chunk] of chunks.entries()) {
      // Sequential — Ollama can only run one inference at a time
      chunkResults.push(await analyzeChunk(chunk, reportTitle, area, i + 1, chunks.length))
    }
    return synthesizeChunks(chunkResults, reportTitle, area, directName)
  }

  // Cloud: send the full document (up to 100k chars — covers ~75 pages)
  // Ollama short docs: single pass as before
  const truncated = smartTruncate(content, maxContentLength())

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
    const json = extractJsonFromText(text)
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

  const modeConfig = getModeConfig(process.env.APP_MODE)
  const prompt = `Compare two ${area} ${modeConfig.documentLabelPlural.toLowerCase()} for a ${modeConfig.label.toLowerCase()}. Identify what changed, improved, or declined.

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
  const json = extractJsonFromText(text)
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
    const json = extractJsonFromText(text)
    const parsed = JSON.parse(json) as { resolved: number[] }
    if (!Array.isArray(parsed.resolved)) return []
    return parsed.resolved
      .filter(i => typeof i === 'number' && i >= 1 && i <= previousFlags.length)
      .map(i => previousFlags[i - 1].text)
  } catch {
    return []
  }
}

export type { ChatResult }

// fix #6: note tool is always available — the model decides when to use it
// based on its description, so client-side regex detection is no longer needed.
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
  return chatWithTools(messages, systemPrompt, persona.temperature)
}

// fix #5: streaming version of dispatchChat — returns a ReadableStream of
// NDJSON lines: { t:"chunk", v:"text" } and { t:"done", noteSaved:... }
export function dispatchChatStream(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: string,
  personaId: PersonaId = 'dispatch',
  userMemory = '',
): ReadableStream<Uint8Array> {
  const personas = getPersonasForMode(process.env.APP_MODE)
  const persona = personas[personaId]
  const hasSearch = !!process.env.BRAVE_SEARCH_KEY
  const systemPrompt = persona.buildSystemPrompt(context, userMemory, hasSearch)

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const innerStream = chatWithToolsStream(messages, systemPrompt, persona.temperature)
      const reader = innerStream.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        controller.enqueue(value) // pass bytes through to caller
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const ev = JSON.parse(line) as Record<string, unknown>
            if (ev.t === 'chunk') fullContent += ev.v as string
          } catch {}
        }
      }
      controller.close()

      // Background: extract new memory facts (fire and forget)
      extractMemoryFacts([...messages, { role: 'assistant', content: fullContent }], userMemory)
        .then(async newFacts => {
          if (newFacts.length === 0) return
          const existing = userMemory
          const updated = existing ? `${existing}\n${newFacts.join('\n')}` : newFacts.join('\n')
          await prisma.setting.upsert({
            where: { key: 'user_memory' },
            update: { value: updated },
            create: { id: crypto.randomUUID(), key: 'user_memory', value: updated },
          })
        })
        .catch(() => {})
    },
  })
}

// ── Memory extraction ────────────────────────────────────────────────────────

export async function extractMemoryFacts(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  existingMemory: string
): Promise<string[]> {
  if (messages.length < 2) return []

  const recent = messages.slice(-6)
  const modeConfig = getModeConfig(process.env.APP_MODE)
  const prompt = `You are reading a short conversation between a ${modeConfig.label.toLowerCase()} and an AI assistant. Extract any NEW facts about this person's work, goals, or preferences that would be useful to remember in future conversations.

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
    const json = extractJsonFromText(text)
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

