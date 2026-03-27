import { parseJsonSafe } from './utils'
import type { Metric, Insight, Question } from './utils'
import { getPersonasForMode, type PersonaId } from './personas'
import { getModeConfig } from './mode'
import { chat, chatWithTools, getProvider, maxContentLength, type AIProvider, type Message } from './ai-providers'

export type { AIProvider }


// ── JSON extraction ─────────────────────────────────────────────────────────

function extractJson(text: string): string {
  // Strip leading/trailing whitespace
  const t = text.trim()

  // Try fenced code blocks first (```json ... ``` or ``` ... ```)
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    const candidate = fenced[1].trim()
    try { JSON.parse(candidate); return candidate } catch {}
  }

  // Find outermost { }
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

// ── Analysis functions ──────────────────────────────────────────────────────

// ── Image description (vision) ──────────────────────────────────────────────

export async function describeImage(buffer: Buffer, mimeType: string): Promise<string> {
  const provider = getProvider()
  const b64 = buffer.toString('base64')

  try {
    if (provider === 'anthropic') {
      const key = process.env.ANTHROPIC_API_KEY
      if (!key) throw new Error('No key')
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 1024,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
            { type: 'text', text: 'Describe this image in detail. Include any visible text, numbers, people (without identifying them), objects, and context that would be useful for research or reporting purposes.' },
          ] }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text: string }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.content?.[0]?.text ?? '[Image stored]'
    }

    if (provider === 'openai') {
      const key = process.env.OPENAI_API_KEY
      if (!key) throw new Error('No key')
      const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
            { type: 'text', text: 'Describe this image in detail. Include any visible text, numbers, people (without identifying them), objects, and context that would be useful for research or reporting purposes.' },
          ] }],
        }),
      })
      const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.choices?.[0]?.message.content ?? '[Image stored]'
    }

    if (provider === 'google') {
      const key = process.env.GOOGLE_API_KEY
      if (!key) throw new Error('No key')
      const model = process.env.GOOGLE_MODEL ?? 'gemini-2.5-flash'
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: b64 } },
            { text: 'Describe this image in detail. Include any visible text, numbers, people (without identifying them), objects, and context that would be useful for research or reporting purposes.' },
          ] }] }),
        }
      )
      const data = await res.json() as { candidates?: Array<{ content: { parts: Array<{ text: string }> } }>; error?: { message: string } }
      if (!res.ok) throw new Error(data.error?.message)
      return data.candidates?.[0]?.content.parts[0]?.text ?? '[Image stored]'
    }
  } catch (e) {
    console.warn('Image description failed:', e)
  }

  // Ollama and unsupported providers — store without description
  return '[Image stored — switch to a cloud AI provider (Anthropic, OpenAI, or Google) to enable automatic image descriptions]'
}

function isCloudProvider(): boolean {
  return getProvider() !== 'ollama'
}

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

export async function dispatchChat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: string,
  personaId: PersonaId = 'dispatch',
  userMemory = ''
): Promise<string> {
  const personas = getPersonasForMode(process.env.APP_MODE)
  const persona = personas[personaId]
  const hasSearch = !!process.env.BRAVE_SEARCH_KEY
  const systemPrompt = persona.buildSystemPrompt(context, userMemory, hasSearch)
  return chatWithTools(messages, systemPrompt, persona.temperature)
}

/**
 * Extracts 1–3 short factual statements worth remembering from a conversation.
 * Returns an empty array if nothing noteworthy was found.
 * Runs as a lightweight background call — failures are safe to ignore.
 */
export async function extractMemoryFacts(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  existingMemory: string
): Promise<string[]> {
  if (messages.length < 2) return []

  const recent = messages.slice(-6) // last 3 turns
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

export async function generateCatchMeUp(
  reports: Array<{ area: string; directName?: string; date: string; summary: string; metrics: string; insights: string }>
): Promise<string> {
  if (reports.length === 0) return 'No reports to catch up on yet.'

  const modeConfig = getModeConfig(process.env.APP_MODE)

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

  const prompt = `You are briefing a ${modeConfig.label.toLowerCase()} who hasn't checked their reports in a while. Write a "catch me up" digest — a flowing narrative of 4-6 paragraphs covering what's been happening across the business. Lead with the most important developments, then cover each key area, and close with the top things they should act on or ask about. Write conversationally, as if speaking to them directly. No bullet points.

Recent ${modeConfig.documentLabelPlural.toLowerCase()}:
${reportsText}`

  return chat([{ role: 'user', content: prompt }], 0.4)
}

// ── Journalism: Named Entity Extraction ──────────────────────────────────────

export interface NamedEntity {
  type: 'person' | 'organisation' | 'location' | 'date' | 'financial'
  name: string
  context?: string
}

export async function extractEntities(
  content: string,
  title: string,
  area: string
): Promise<NamedEntity[]> {
  const truncated = content.slice(0, maxContentLength())
  const prompt = `Extract all named entities from this document. Record each entity's type and exact name as it appears.

Document: ${title} (${area})

Content:
${truncated}

Return ONLY valid JSON:
{
  "entities": [
    {"type": "person|organisation|location|date|financial", "name": "exact name from document", "context": "optional: title, role, or brief context if stated"}
  ]
}

Types:
- person: full names of individuals, including titles or roles if mentioned alongside the name
- organisation: companies, government bodies, NGOs, agencies, institutions
- location: countries, cities, addresses, named places
- date: specific dates, time periods, or date references (e.g. "Q3 2023", "15 March 2024")
- financial: monetary amounts, financial figures (e.g. "$4.2 million", "€500k")

Limits: max 30 entities. Only include entities explicitly named in the document. Do not infer.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { entities?: unknown[] }
    if (!Array.isArray(parsed.entities)) return []
    const VALID_ENTITY_TYPES = new Set<string>(['person', 'organisation', 'location', 'date', 'financial'])
    return (parsed.entities as NamedEntity[]).filter(
      e => e && VALID_ENTITY_TYPES.has(e.type) && typeof e.name === 'string' && e.name.trim().length > 0
    )
  } catch (e) {
    console.error('extractEntities failed:', e)
    return []
  }
}

// ── Journalism: Timeline Extraction ──────────────────────────────────────────

export interface JournalismTimelineEvent {
  dateText: string
  dateSortKey?: string | null
  event: string
}

export async function extractTimeline(
  content: string,
  title: string
): Promise<JournalismTimelineEvent[]> {
  const truncated = content.slice(0, maxContentLength())
  const prompt = `Extract all dated events and chronological references from this document.

Document: ${title}

Content:
${truncated}

Return ONLY valid JSON:
{
  "events": [
    {
      "dateText": "date as it appears in the document, e.g. '15 March 2024' or 'Q3 2023'",
      "dateSortKey": "YYYY-MM-DD ISO date if determinable, or null if only approximate",
      "event": "brief factual description of what happened on this date, as stated in the document"
    }
  ]
}

Limits: max 20 events. Only include events with a clear date reference. Exclude vague references without any time anchor. Do not invent dates or events.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { events?: unknown[] }
    if (!Array.isArray(parsed.events)) return []
    return (parsed.events as JournalismTimelineEvent[]).filter(
      e => e && typeof e.dateText === 'string' && typeof e.event === 'string' && e.event.trim().length > 0
    )
  } catch (e) {
    console.error('extractTimeline failed:', e)
    return []
  }
}

// ── Journalism: Redaction Detection ──────────────────────────────────────────

export interface RedactionEntry {
  type: 'blackout' | 'placeholder' | 'gap' | 'missing_reference'
  location: string
  context: string
}

export async function detectRedactions(
  content: string,
  title: string
): Promise<RedactionEntry[]> {
  const truncated = content.slice(0, maxContentLength())
  const prompt = `Examine this document for signs of redaction or deliberately withheld information.

Document: ${title}

Content:
${truncated}

Look for:
1. Explicit redaction markers: [REDACTED], [WITHHELD], [EXEMPTED], ████, ***, (b)(6), s.40, or similar
2. Unusual numbering discontinuities, missing page numbers, or skipped sections
3. Text that appears cut off mid-sentence or paragraph
4. References to content (exhibits, attachments, sections) that are not present in this document
5. Repetitive replacement characters or unusual spacing suggesting removed text

Return ONLY valid JSON:
{
  "redactions": [
    {
      "type": "blackout|placeholder|gap|missing_reference",
      "location": "where in the document (e.g. 'Page 3, paragraph 2' or 'Section 4.1' or 'near reference to X')",
      "context": "the surrounding text that survived, giving context for what was redacted (up to 100 words)"
    }
  ]
}

Types:
- blackout: text replaced with black bars, asterisks, or repeated characters
- placeholder: explicit [REDACTED]-style markers
- gap: unusual discontinuity in numbering, pagination, or flow
- missing_reference: document references content that is not present

Return an empty array if no genuine signs of redaction are found. Do not flag normal editorial choices or formatting.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json) as { redactions?: unknown[] }
    if (!Array.isArray(parsed.redactions)) return []
    return (parsed.redactions as RedactionEntry[]).filter(
      r => r && typeof r.type === 'string' && typeof r.location === 'string' && typeof r.context === 'string'
    )
  } catch (e) {
    console.error('detectRedactions failed:', e)
    return []
  }
}

// ── Journalism: Document Comparison ──────────────────────────────────────────

export interface JournalismPassage {
  text: string
  appearsIn: 'previous' | 'current'
}

export interface JournalismFigureChange {
  label: string
  previous: string
  current: string
}

export interface JournalismComparison {
  headline: string
  passages: JournalismPassage[]
  figures: JournalismFigureChange[]
  entitiesAdded: string[]
  entitiesRemoved: string[]
  possibleRedactions: string[]
}

export async function compareDocumentsJournalism(
  prevContent: string,
  prevTitle: string,
  currContent: string,
  currTitle: string
): Promise<JournalismComparison> {
  const maxLen = Math.floor(maxContentLength() / 2)
  const prevTrunc = prevContent.slice(0, maxLen)
  const currTrunc = currContent.slice(0, maxLen)

  const prompt = `You are a journalist comparing two versions of a document. Identify what changed between them.

PREVIOUS DOCUMENT: ${prevTitle}
${prevTrunc}

---

CURRENT DOCUMENT: ${currTitle}
${currTrunc}

Identify:
1. Specific claims or passages that appear in one document but not the other
2. Figures or numbers that changed between versions
3. Named people, organisations, or locations that were added or removed
4. Sections or content that appear to have been removed or redacted

Return ONLY valid JSON:
{
  "headline": "1 sentence summarising the most significant difference between the two documents",
  "passages": [
    {"text": "brief description of the passage or claim", "appearsIn": "previous|current"}
  ],
  "figures": [
    {"label": "what the figure refers to", "previous": "value in previous doc", "current": "value in current doc"}
  ],
  "entitiesAdded": ["names that appear in current but not previous"],
  "entitiesRemoved": ["names present in previous but absent from current"],
  "possibleRedactions": ["description of anything that appears to have been removed or redacted between versions"]
}

Limits: max 5 passages, 5 figures, 5 entitiesAdded, 5 entitiesRemoved, 3 possibleRedactions. Only flag genuine differences.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json) as Partial<JournalismComparison>
    return {
      headline: typeof parsed.headline === 'string' ? parsed.headline : '',
      passages: Array.isArray(parsed.passages) ? parsed.passages : [],
      figures: Array.isArray(parsed.figures) ? parsed.figures : [],
      entitiesAdded: Array.isArray(parsed.entitiesAdded) ? parsed.entitiesAdded : [],
      entitiesRemoved: Array.isArray(parsed.entitiesRemoved) ? parsed.entitiesRemoved : [],
      possibleRedactions: Array.isArray(parsed.possibleRedactions) ? parsed.possibleRedactions : [],
    }
  } catch (e) {
    console.error('compareDocumentsJournalism failed:', e)
    return { headline: '', passages: [], figures: [], entitiesAdded: [], entitiesRemoved: [], possibleRedactions: [] }
  }
}

// ── Claim verification scaffolding ───────────────────────────────────────────

export interface VerificationItem {
  claim: string
  claimType: 'statistical' | 'attribution' | 'event' | 'legal'
  evidenceNeeded: string
  suggestedSources: string[]
}

export async function generateVerificationChecklist(
  content: string,
  title: string,
  area: string
): Promise<VerificationItem[]> {
  const truncated = content.slice(0, maxContentLength())

  const prompt = `You are a verification editor reviewing a document before publication. Your task is to identify key claims that require verification.

DOCUMENT TITLE: ${title}
AREA: ${area}

DOCUMENT CONTENT:
${truncated}

Identify up to 8 key claims in this document that a journalist would need to verify before publishing. For each claim:
- Classify it as one of: statistical (a number, percentage, or data point), attribution (a quote or statement attributed to someone), event (something that allegedly happened), legal (a legal status, ruling, or allegation)
- Describe specifically what evidence would be needed to verify or refute it
- List 2-4 types of sources or documents that could provide that evidence

Return ONLY valid JSON as an array:
[
  {
    "claim": "the specific claim as stated or closely paraphrased",
    "claimType": "statistical|attribution|event|legal",
    "evidenceNeeded": "specific description of what evidence would verify or refute this",
    "suggestedSources": ["source type 1", "source type 2"]
  }
]

Only include claims that genuinely need verification — skip obvious background facts. Max 8 items.`

  try {
    const text = await chat([{ role: 'user', content: prompt }], 0.1, true)
    const json = extractJson(text)
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item: unknown) => item && typeof item === 'object')
      .map((item: Record<string, unknown>) => ({
        claim: typeof item.claim === 'string' ? item.claim : '',
        claimType: (['statistical', 'attribution', 'event', 'legal'].includes(item.claimType as string)
          ? item.claimType
          : 'event') as VerificationItem['claimType'],
        evidenceNeeded: typeof item.evidenceNeeded === 'string' ? item.evidenceNeeded : '',
        suggestedSources: Array.isArray(item.suggestedSources) ? item.suggestedSources.map(String) : [],
      }))
      .filter((item) => item.claim.length > 0)
  } catch (e) {
    console.error('generateVerificationChecklist failed:', e)
    return []
  }
}
