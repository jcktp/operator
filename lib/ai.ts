import { Ollama } from 'ollama'

// ── Provider types ──────────────────────────────────────────────────────────

export type AIProvider = 'ollama' | 'anthropic' | 'openai' | 'google' | 'groq'

function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) ?? 'ollama'
}

// Max content length per provider (cloud models handle more context)
function maxContentLength(): number {
  const p = getProvider()
  return p === 'ollama' ? 6000 : 20000
}

// ── Unified chat interface ──────────────────────────────────────────────────

interface Message { role: 'user' | 'assistant'; content: string }

async function chat(messages: Message[], temperature = 0.1): Promise<string> {
  const provider = getProvider()
  switch (provider) {
    case 'anthropic': return chatAnthropic(messages, temperature)
    case 'openai':    return chatOpenAI(messages, temperature)
    case 'groq':      return chatGroq(messages, temperature)
    case 'google':    return chatGoogle(messages, temperature)
    default:          return chatOllama(messages, temperature)
  }
}

async function chatOllama(messages: Message[], temperature: number): Promise<string> {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL ?? 'llama3.2:3b'
  const ollama = new Ollama({ host })
  const response = await ollama.chat({ model, messages, options: { temperature } })
  return response.message.content
}

async function chatAnthropic(messages: Message[], temperature: number): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature,
      messages,
    }),
  })
  const data = await res.json() as { content?: Array<{ text: string }>; error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? 'Anthropic error')
  return data.content![0].text
}

async function chatOpenAI(messages: Message[], temperature: number): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature }),
  })
  const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? 'OpenAI error')
  return data.choices![0].message.content
}

async function chatGroq(messages: Message[], temperature: number): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  const model = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant'
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature }),
  })
  const data = await res.json() as { choices?: Array<{ message: { content: string } }>; error?: { message: string } }
  if (!res.ok) throw new Error(data.error?.message ?? 'Groq error')
  return data.choices![0].message.content
}

async function chatGoogle(messages: Message[], temperature: number): Promise<string> {
  const key = process.env.GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY not set')
  const model = process.env.GOOGLE_MODEL ?? 'gemini-1.5-flash'
  // Combine messages into a single prompt (Gemini API differs)
  const prompt = messages.map(m => m.content).join('\n\n')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature },
      }),
    }
  )
  const data = await res.json() as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>
    error?: { message: string }
  }
  if (!res.ok) throw new Error(data.error?.message ?? 'Google error')
  return data.candidates![0].content.parts[0].text
}

// ── JSON extraction ────────────────────────────────────────────────────────

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1)
  throw new Error('No JSON found in response')
}

// ── Public interfaces ──────────────────────────────────────────────────────

export interface ReportAnalysis {
  summary: string
  metrics: Metric[]
  insights: Insight[]
  questions: Question[]
}

export interface Metric {
  label: string
  value: string
  context?: string
  trend?: 'up' | 'down' | 'flat' | 'unknown'
  status?: 'positive' | 'negative' | 'neutral' | 'warning'
}

export interface Insight {
  type: 'observation' | 'anomaly' | 'risk' | 'opportunity'
  text: string
  area?: string
}

export interface Question {
  text: string
  why: string
  priority: 'high' | 'medium' | 'low'
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

// ── Analysis functions ─────────────────────────────────────────────────────

export async function analyzeReport(
  content: string,
  reportTitle: string,
  area: string,
  directName?: string
): Promise<ReportAnalysis> {
  const truncated = content.slice(0, maxContentLength())

  const prompt = `You are analyzing a business report for a CEO. Extract data exactly as it appears — do not invent numbers.

Report: ${reportTitle}
Area: ${area}${directName ? `\nFrom: ${directName}` : ''}

Content:
${truncated}

Reply with ONLY valid JSON, no other text:
{
  "summary": "2-3 sentence factual summary",
  "metrics": [{"label": "name", "value": "exact value", "context": "vs plan or prior period if mentioned", "trend": "up|down|flat|unknown", "status": "positive|negative|neutral|warning"}],
  "insights": [{"type": "observation|anomaly|risk|opportunity", "text": "factual observation from the report", "area": "business area"}],
  "questions": [{"text": "question to ask the direct", "why": "why it matters", "priority": "high|medium|low"}]
}

Limits: max 10 metrics, 5 insights, 4 questions. Only use data from the report.`

  const text = await chat([{ role: 'user', content: prompt }])
  const json = extractJson(text)
  const parsed = JSON.parse(json) as ReportAnalysis

  return {
    summary: parsed.summary ?? '',
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
  let prevMetrics: Metric[] = []
  let currMetrics: Metric[] = []
  try { prevMetrics = JSON.parse(previousMetrics || '[]') } catch {}
  try { currMetrics = JSON.parse(currentMetrics || '[]') } catch {}

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

Limits: max 8 changes, max 4 newTopics, max 4 removedTopics. Only compare what is actually in the reports.`

  const text = await chat([{ role: 'user', content: prompt }])
  const json = extractJson(text)
  const parsed = JSON.parse(json) as ReportComparison

  return {
    headline: parsed.headline ?? '',
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
    newTopics: Array.isArray(parsed.newTopics) ? parsed.newTopics : [],
    removedTopics: Array.isArray(parsed.removedTopics) ? parsed.removedTopics : [],
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

  const text = await chat([{ role: 'user', content: prompt }])
  const json = extractJson(text)
  const parsed = JSON.parse(json)

  return {
    healthSignal: parsed.healthSignal ?? '',
    crossInsights: Array.isArray(parsed.crossInsights) ? parsed.crossInsights : [],
    topQuestions: Array.isArray(parsed.topQuestions) ? parsed.topQuestions : [],
  }
}
