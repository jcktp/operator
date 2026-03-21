import { Ollama } from 'ollama'

function getClient() {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
  return new Ollama({ host })
}

function getModel() {
  return process.env.OLLAMA_MODEL ?? 'llama3.2:3b'
}

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

function extractJson(text: string): string {
  // Try to find a JSON block between ```json ... ``` or just { ... }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()

  // Find the outermost { ... }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1)
  }
  throw new Error('No JSON found in response')
}

export async function analyzeReport(
  content: string,
  reportTitle: string,
  area: string,
  directName?: string
): Promise<ReportAnalysis> {
  const ollama = getClient()
  const model = getModel()

  // Keep content short for lightweight models
  const truncated = content.slice(0, 6000)

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

  const response = await ollama.chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    options: { temperature: 0.1 },
  })

  const text = response.message.content
  const json = extractJson(text)
  const parsed = JSON.parse(json) as ReportAnalysis

  // Ensure arrays exist
  return {
    summary: parsed.summary ?? '',
    metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
  }
}

export async function generateDashboardInsights(
  reports: Array<{ area: string; summary: string; metrics: string; insights: string }>
): Promise<{ crossInsights: Insight[]; topQuestions: Question[]; healthSignal: string }> {
  if (reports.length === 0) {
    return { crossInsights: [], topQuestions: [], healthSignal: 'No reports available.' }
  }

  const ollama = getClient()
  const model = getModel()

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

  const response = await ollama.chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    options: { temperature: 0.1 },
  })

  const text = response.message.content
  const json = extractJson(text)
  const parsed = JSON.parse(json)

  return {
    healthSignal: parsed.healthSignal ?? '',
    crossInsights: Array.isArray(parsed.crossInsights) ? parsed.crossInsights : [],
    topQuestions: Array.isArray(parsed.topQuestions) ? parsed.topQuestions : [],
  }
}
