import { extractJsonFromText, parseJsonSafe } from '../utils'
import type { Metric, Insight, Question } from '../utils'
import { getModeConfig } from '../mode'
import { chat, getProvider, maxContentLength } from '../ai-providers'
import { loadKnowledgeForArea } from './knowledge'

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

// ── Smart content truncation ─────────────────────────────────────────────────

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

function isCloudProvider(): boolean {
  return getProvider() !== 'ollama'
}

// ── Ollama chunked analysis ──────────────────────────────────────────────────

const OLLAMA_CHUNK_SIZE = 4500
const CHUNK_OVERLAP = 150

function splitIntoChunks(content: string): string[] {
  if (content.length <= OLLAMA_CHUNK_SIZE) return [content]
  const chunks: string[] = []
  let pos = 0
  while (pos < content.length) {
    let end = Math.min(pos + OLLAMA_CHUNK_SIZE, content.length)
    if (end < content.length) {
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
    if (next <= pos) break
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
Extract only facts visible in this text — never infer or calculate. Always respond in English regardless of the document language.

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

  const MAX_SYNTH = OLLAMA_CHUNK_SIZE - 800
  const chunkLines = chunks
    .map((c, i) => {
      const metrics = c.metrics.map(m => `${m.label}: ${m.value}`).join(', ')
      const flags = c.insights.map(ins => ins.text).join('; ')
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
    return {
      summary: chunks.map(c => c.chunkSummary).filter(Boolean).join(' '),
      metrics: chunks.flatMap(c => c.metrics).slice(0, 10),
      insights: chunks.flatMap(c => c.insights).slice(0, 5),
      questions: [],
    }
  }
}

// ── Public analysis functions ────────────────────────────────────────────────

export async function analyzeReport(
  content: string,
  reportTitle: string,
  area: string,
  directName?: string,
  mode?: string
): Promise<ReportAnalysis> {
  const modeConfig = getModeConfig(mode ?? process.env.APP_MODE)
  const from = directName ? `\nSubmitted by: ${directName}` : ''

  let knowledgePrefix = ''
  try {
    const { userMemory, glossaryBlock, briefingBlock } = await loadKnowledgeForArea(area)
    const parts: string[] = []
    if (userMemory) parts.push(`USER CONTEXT:\n${userMemory}`)
    if (glossaryBlock) parts.push(glossaryBlock)
    if (briefingBlock) parts.push(briefingBlock)
    if (parts.length > 0) knowledgePrefix = parts.join('\n\n') + '\n\n'
  } catch { /* knowledge injection is best-effort */ }

  if (!isCloudProvider() && content.length > OLLAMA_CHUNK_SIZE) {
    const chunks = splitIntoChunks(content)
    const chunkResults: ChunkResult[] = []
    for (const [i, chunk] of chunks.entries()) {
      chunkResults.push(await analyzeChunk(chunk, reportTitle, area, i + 1, chunks.length))
    }
    return synthesizeChunks(chunkResults, reportTitle, area, directName)
  }

  const truncated = smartTruncate(content, maxContentLength())

  const cloudPrompt = `${knowledgePrefix}You are a senior analyst reviewing a ${modeConfig.documentLabel.toLowerCase()} for a ${modeConfig.label.toLowerCase()}.

Document: ${reportTitle}
Area: ${area}${from}

${modeConfig.analysisFraming}

STRICT RULES:
- Always respond in English, regardless of the language the document is written in. Translate all extracted content into English.
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

  const ollamaPrompt = `${knowledgePrefix}Analyze this ${modeConfig.documentLabel.toLowerCase()}. Extract only facts that appear in the text — never calculate or invent numbers. Always respond in English regardless of the document language — translate all content into English.

${modeConfig.analysisFraming}

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
    console.error('analyzeReport JSON parse failed:', e, 'raw response:', text?.slice(0, 500))
    return {
      summary: 'Analysis could not be completed — the AI model did not return a structured response. Try re-uploading the document, or switch to a different AI provider in Settings.',
      metrics: [],
      insights: [],
      questions: [],
    }
  }

  // Normalize metrics: some models return "name" instead of "label"
  const rawMetrics = Array.isArray(parsed.metrics) ? (parsed.metrics as unknown as Record<string, unknown>[]) : []
  const metrics = rawMetrics.map(m => ({
    ...m,
    label: (((m.label ?? m.name) as string | undefined) ?? '').trim(),
  })).filter(m => (m.label as string).length > 0) as typeof parsed.metrics

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    metrics,
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
  }
}

export async function compareReports(
  previousSummary: string,
  previousMetrics: string,
  currentSummary: string,
  currentMetrics: string,
  area: string,
  mode?: string
): Promise<ReportComparison> {
  const prevMetrics = parseJsonSafe<Metric[]>(previousMetrics, [])
  const currMetrics = parseJsonSafe<Metric[]>(currentMetrics, [])

  const prevText = `Summary: ${previousSummary}\nMetrics: ${prevMetrics.map(m => `${m.label}: ${m.value}`).join(', ')}`
  const currText = `Summary: ${currentSummary}\nMetrics: ${currMetrics.map(m => `${m.label}: ${m.value}`).join(', ')}`

  const modeConfig = getModeConfig(mode ?? process.env.APP_MODE)
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
  let parsed: ReportComparison
  try {
    const json = extractJsonFromText(text)
    parsed = JSON.parse(json) as ReportComparison
  } catch {
    return { headline: '', changes: [], newTopics: [], removedTopics: [] }
  }
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
